import type {
  AppData,
  ID,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
} from '@/domain/entities'
import { ORDER_STATUS_LABEL } from '@/domain/labels'
import {
  canTransition,
  DomainError,
  EDITABLE_ORDER_STATUSES,
  isPositiveInteger,
  LIMITS,
  orderTotal,
  RECEIVABLE_ORDER_STATUSES,
  remainingToReceive,
} from '@/domain/rules'
import { formatCurrency } from '@/lib/format'
import { type DomainContext, logActivity, markOperation, wasProcessed } from './context'
import { registerMovement } from './inventory.service'

export interface OrderItemInput {
  productId: ID
  quantity: number
  unitCost: number
}

export interface OrderInput {
  supplierId: ID
  expectedAt: string
  notes: string
  items: OrderItemInput[]
}

export interface ReceiptInput {
  operationId: ID
  responsible: string
  occurredAt?: string
  notes?: string
  lines: { itemId: ID; quantity: number }[]
}

function validateOrder(data: AppData, input: OrderInput): void {
  const supplier = data.suppliers.find((s) => s.id === input.supplierId)
  if (!supplier) throw new DomainError('Selecione um fornecedor.')
  if (!supplier.active) throw new DomainError(`O fornecedor ${supplier.companyName} está inativo.`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expectedAt) || Number.isNaN(Date.parse(input.expectedAt))) {
    throw new DomainError('Informe uma data prevista de entrega válida.')
  }
  if (input.items.length === 0) throw new DomainError('Adicione pelo menos um item ao pedido.')
  const seen = new Set<ID>()
  for (const item of input.items) {
    const product = data.products.find((p) => p.id === item.productId)
    if (!product) throw new DomainError('Um dos itens referencia um produto inexistente.')
    if (!product.active) throw new DomainError(`O produto ${product.name} está inativo e não pode ser comprado.`)
    if (seen.has(item.productId)) {
      throw new DomainError(`O produto ${product.name} aparece mais de uma vez no pedido.`)
    }
    seen.add(item.productId)
    if (!isPositiveInteger(item.quantity) || item.quantity > LIMITS.maxQuantity) {
      throw new DomainError(`Quantidade inválida para ${product.name}.`)
    }
    if (!Number.isInteger(item.unitCost) || item.unitCost < 0 || item.unitCost > LIMITS.maxMoneyCents) {
      throw new DomainError(`Custo unitário inválido para ${product.name}.`)
    }
  }
}

function pushHistory(order: PurchaseOrder, ctx: DomainContext, status: PurchaseOrderStatus, summary: string, at?: string): PurchaseOrder {
  const event = { id: ctx.newId(), at: at ?? ctx.now().toISOString(), status, summary }
  return { ...order, history: [...order.history, event].slice(-LIMITS.purchaseOrderHistory) }
}

function replaceOrder(data: AppData, order: PurchaseOrder): AppData {
  return { ...data, purchaseOrders: data.purchaseOrders.map((o) => (o.id === order.id ? order : o)) }
}

export function formatOrderNumber(year: number, sequence: number): string {
  return `PC-${year}-${String(sequence).padStart(4, '0')}`
}

export function createOrder(
  data: AppData,
  input: OrderInput,
  ctx: DomainContext,
  options: { submit?: boolean } = {},
): { data: AppData; order: PurchaseOrder } {
  validateOrder(data, input)
  const now = ctx.now()
  const sequence = data.sequences.purchaseOrder + 1
  const status: PurchaseOrderStatus = options.submit ? 'pending' : 'draft'
  const items: PurchaseOrderItem[] = input.items.map((i) => ({
    id: ctx.newId(),
    productId: i.productId,
    quantity: i.quantity,
    unitCost: i.unitCost,
    receivedQuantity: 0,
  }))
  let order: PurchaseOrder = {
    id: ctx.newId(),
    number: formatOrderNumber(now.getFullYear(), sequence),
    supplierId: input.supplierId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expectedAt: input.expectedAt,
    items,
    notes: input.notes.trim(),
    status,
    history: [],
  }
  order = pushHistory(
    order,
    ctx,
    status,
    `Pedido criado como ${ORDER_STATUS_LABEL[status].toLowerCase()}. Total: ${formatCurrency(orderTotal(order))}.`,
  )
  const next = logActivity(
    {
      ...data,
      purchaseOrders: [order, ...data.purchaseOrders],
      sequences: { ...data.sequences, purchaseOrder: sequence },
    },
    ctx,
    {
      action: 'created',
      entity: 'purchase_order',
      entityId: order.id,
      summary: `Pedido ${order.number} criado (${items.length} item(ns), ${formatCurrency(orderTotal(order))}).`,
    },
  )
  return { data: next, order }
}

export function updateOrder(data: AppData, id: ID, input: OrderInput, ctx: DomainContext): AppData {
  const current = data.purchaseOrders.find((o) => o.id === id)
  if (!current) throw new DomainError('Pedido não encontrado.')
  if (!EDITABLE_ORDER_STATUSES.includes(current.status)) {
    throw new DomainError(`Pedidos com status ${ORDER_STATUS_LABEL[current.status].toLowerCase()} não podem ser editados.`)
  }
  validateOrder(data, input)
  let order: PurchaseOrder = {
    ...current,
    supplierId: input.supplierId,
    expectedAt: input.expectedAt,
    notes: input.notes.trim(),
    items: input.items.map((i) => ({
      id: current.items.find((ci) => ci.productId === i.productId)?.id ?? ctx.newId(),
      productId: i.productId,
      quantity: i.quantity,
      unitCost: i.unitCost,
      receivedQuantity: 0,
    })),
    updatedAt: ctx.now().toISOString(),
  }
  order = pushHistory(order, ctx, order.status, `Pedido editado. Total: ${formatCurrency(orderTotal(order))}.`)
  return logActivity(replaceOrder(data, order), ctx, {
    action: 'updated',
    entity: 'purchase_order',
    entityId: id,
    summary: `Pedido ${order.number} editado.`,
  })
}

const TRANSITION_ACTION = {
  pending: { action: 'submitted', verb: 'enviado para aprovação' },
  approved: { action: 'approved', verb: 'aprovado' },
  draft: { action: 'updated', verb: 'devolvido para rascunho' },
  cancelled: { action: 'cancelled', verb: 'cancelado' },
} as const

/**
 * Altera o status de um pedido (enviar, aprovar, devolver a rascunho, cancelar).
 * Recebimentos usam {@link receiveOrder}.
 */
export function changeOrderStatus(
  data: AppData,
  id: ID,
  to: 'pending' | 'approved' | 'draft' | 'cancelled',
  ctx: DomainContext,
  reason = '',
): AppData {
  const current = data.purchaseOrders.find((o) => o.id === id)
  if (!current) throw new DomainError('Pedido não encontrado.')
  if (!canTransition(current.status, to)) {
    throw new DomainError(
      `Não é possível mudar de ${ORDER_STATUS_LABEL[current.status].toLowerCase()} para ${ORDER_STATUS_LABEL[to].toLowerCase()}.`,
    )
  }
  if (to === 'approved' && !data.suppliers.find((s) => s.id === current.supplierId)?.active) {
    throw new DomainError('O fornecedor deste pedido está inativo.')
  }
  const { action, verb } = TRANSITION_ACTION[to]
  const detail = reason.trim() ? ` Motivo: ${reason.trim()}` : ''
  let order: PurchaseOrder = { ...current, status: to, updatedAt: ctx.now().toISOString() }
  order = pushHistory(order, ctx, to, `Pedido ${verb}.${detail}`)
  return logActivity(replaceOrder(data, order), ctx, {
    action,
    entity: 'purchase_order',
    entityId: id,
    summary: `Pedido ${order.number} ${verb}.${detail}`,
  })
}

/**
 * Registra o recebimento (total ou parcial) de itens de um pedido aprovado.
 * Cada linha recebida gera uma movimentação de entrada vinculada ao pedido.
 */
export function receiveOrder(data: AppData, id: ID, input: ReceiptInput, ctx: DomainContext): AppData {
  const current = data.purchaseOrders.find((o) => o.id === id)
  if (!current) throw new DomainError('Pedido não encontrado.')
  if (wasProcessed(data, input.operationId)) {
    throw new DomainError('Este recebimento já foi registrado. Nada foi alterado.')
  }
  if (!RECEIVABLE_ORDER_STATUSES.includes(current.status)) {
    throw new DomainError(
      `Pedidos com status ${ORDER_STATUS_LABEL[current.status].toLowerCase()} não podem receber itens.`,
    )
  }
  const lines = input.lines.filter((l) => l.quantity !== 0)
  if (lines.length === 0) throw new DomainError('Informe a quantidade recebida de pelo menos um item.')

  // Valida todas as linhas antes de qualquer alteração
  for (const line of lines) {
    const item = current.items.find((i) => i.id === line.itemId)
    if (!item) throw new DomainError('Item não pertence a este pedido.')
    if (!isPositiveInteger(line.quantity)) throw new DomainError('Quantidades recebidas devem ser inteiros positivos.')
    const remaining = remainingToReceive(item)
    if (line.quantity > remaining) {
      const product = data.products.find((p) => p.id === item.productId)
      throw new DomainError(
        `Recebimento acima do pendente para ${product?.name ?? 'item'}: restam ${remaining}.`,
      )
    }
  }

  const at = input.occurredAt ?? ctx.now().toISOString()
  let next = data
  let receivedUnits = 0
  for (const line of lines) {
    const item = current.items.find((i) => i.id === line.itemId)!
    next = registerMovement(
      next,
      {
        operationId: `${input.operationId}:${item.id}`,
        productId: item.productId,
        type: 'in',
        quantity: line.quantity,
        reason: 'Compra',
        responsible: input.responsible,
        notes: input.notes ?? `Recebimento do pedido ${current.number}`,
        occurredAt: at,
        purchaseOrderId: current.id,
      },
      ctx,
    ).data
    receivedUnits += line.quantity
  }

  const items = current.items.map((item) => {
    const line = lines.find((l) => l.itemId === item.id)
    return line ? { ...item, receivedQuantity: item.receivedQuantity + line.quantity } : item
  })
  const complete = items.every((i) => i.receivedQuantity >= i.quantity)
  const status: PurchaseOrderStatus = complete ? 'received' : 'partially_received'
  let order: PurchaseOrder = { ...current, items, status, updatedAt: at }
  order = pushHistory(
    order,
    ctx,
    status,
    `${complete ? 'Recebimento concluído' : 'Recebimento parcial'}: ${receivedUnits} unidade(s) em ${lines.length} item(ns).`,
    at,
  )
  next = replaceOrder(next, order)
  next = markOperation(next, input.operationId)
  return logActivity(next, ctx, {
    at,
    action: 'received',
    entity: 'purchase_order',
    entityId: id,
    summary: `Pedido ${order.number}: ${complete ? 'recebido por completo' : 'recebimento parcial'} (${receivedUnits} unidade(s)).`,
  })
}
