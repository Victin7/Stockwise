import type { AppData, ID, MovementType, StockMovement } from '@/domain/entities'
import { MOVEMENT_TYPE_LABEL } from '@/domain/labels'
import { applyMovementToBalance, DomainError, LIMITS, isPositiveInteger } from '@/domain/rules'
import { type DomainContext, logActivity, markOperation, wasProcessed } from './context'

export interface MovementInput {
  /** Gerado quando o formulário é aberto; reenvios com o mesmo ID são rejeitados. */
  operationId: ID
  productId: ID
  type: MovementType
  quantity: number
  reason: string
  responsible: string
  notes?: string
  occurredAt?: string
  purchaseOrderId?: ID | null
}

export interface MovementResult {
  data: AppData
  movement: StockMovement
}

/**
 * Registra uma movimentação de estoque.
 *
 * Todas as regras são validadas antes de qualquer alteração; o novo estado só é
 * retornado se a operação for válida por completo. Esta é a única forma de
 * alterar o saldo de um produto.
 */
export function registerMovement(data: AppData, input: MovementInput, ctx: DomainContext): MovementResult {
  if (wasProcessed(data, input.operationId)) {
    throw new DomainError('Esta operação já foi registrada. Nada foi alterado.')
  }
  if (!isPositiveInteger(input.quantity)) {
    throw new DomainError('Informe uma quantidade inteira maior que zero.')
  }
  if (input.quantity > LIMITS.maxQuantity) {
    throw new DomainError('Quantidade acima do limite permitido.')
  }
  const reason = input.reason.trim()
  if (!reason) throw new DomainError('Informe o motivo da movimentação.')

  const product = data.products.find((p) => p.id === input.productId)
  if (!product) throw new DomainError('Produto não encontrado.')

  const isDecrease = input.type === 'out' || input.type === 'adjust_out'
  if (isDecrease && input.quantity > product.quantity) {
    throw new DomainError(
      `Saldo insuficiente: ${product.name} tem ${product.quantity} ${product.unit} disponíveis.`,
    )
  }
  if (!product.active && input.type === 'out') {
    throw new DomainError('Produto inativo não pode ter saídas registradas. Ative-o primeiro.')
  }

  const balanceAfter = applyMovementToBalance(product.quantity, input.type, input.quantity)
  if (balanceAfter > LIMITS.maxQuantity) {
    throw new DomainError('O saldo resultante excede o limite permitido.')
  }

  const now = ctx.now().toISOString()
  const movement: StockMovement = {
    id: ctx.newId(),
    operationId: input.operationId,
    productId: product.id,
    type: input.type,
    quantity: input.quantity,
    occurredAt: input.occurredAt ?? now,
    reason,
    responsible: input.responsible.trim() || 'Não informado',
    notes: input.notes?.trim() ?? '',
    purchaseOrderId: input.purchaseOrderId ?? null,
    balanceAfter,
  }

  let next: AppData = {
    ...data,
    products: data.products.map((p) =>
      p.id === product.id ? { ...p, quantity: balanceAfter, updatedAt: now } : p,
    ),
    movements: [movement, ...data.movements].slice(0, LIMITS.movements),
  }
  next = markOperation(next, input.operationId)
  next = logActivity(next, ctx, {
    at: movement.occurredAt,
    action: input.type === 'in' ? 'stock_in' : input.type === 'out' ? 'stock_out' : 'stock_adjusted',
    entity: 'movement',
    entityId: movement.id,
    summary: `${MOVEMENT_TYPE_LABEL[input.type]} de ${input.quantity} ${product.unit} em ${product.name} (${product.sku}). Saldo: ${balanceAfter}.`,
  })

  return { data: next, movement }
}
