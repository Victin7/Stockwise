import type { AppData, ID, Product, Unit } from '@/domain/entities'
import { DomainError, LIMITS, normalizeSku } from '@/domain/rules'
import { type DomainContext, logActivity } from './context'
import { registerMovement } from './inventory.service'

export interface ProductInput {
  sku: string
  name: string
  description: string
  categoryId: ID
  unit: Unit
  unitCost: number
  salePrice: number | null
  minStock: number
  maxStock: number | null
  supplierId: ID | null
  location: string
  barcode: string | null
  expiryDate: string | null
  active: boolean
}

export interface CreateProductInput extends ProductInput {
  /** Saldo inicial — gera uma movimentação de entrada "Saldo inicial". */
  initialQuantity: number
  operationId: ID
  responsible: string
}

function validateProduct(data: AppData, input: ProductInput, ignoreId?: ID): ProductInput {
  const sku = normalizeSku(input.sku)
  const name = input.name.trim()
  if (!sku) throw new DomainError('Informe o SKU.')
  if (!name) throw new DomainError('Informe o nome do produto.')
  if (data.products.some((p) => p.id !== ignoreId && normalizeSku(p.sku) === sku)) {
    throw new DomainError(`O SKU ${sku} já está em uso por outro produto.`)
  }
  const barcode = input.barcode?.trim() || null
  if (barcode && data.products.some((p) => p.id !== ignoreId && p.barcode === barcode)) {
    throw new DomainError(`O código de barras ${barcode} já está em uso.`)
  }
  if (!data.categories.some((c) => c.id === input.categoryId)) {
    throw new DomainError('Selecione uma categoria válida.')
  }
  if (input.supplierId && !data.suppliers.some((s) => s.id === input.supplierId)) {
    throw new DomainError('Fornecedor não encontrado.')
  }
  const money = [input.unitCost, input.salePrice ?? 0]
  if (money.some((v) => !Number.isInteger(v) || v < 0 || v > LIMITS.maxMoneyCents)) {
    throw new DomainError('Valores monetários inválidos.')
  }
  if (!Number.isInteger(input.minStock) || input.minStock < 0) {
    throw new DomainError('O estoque mínimo deve ser um inteiro maior ou igual a zero.')
  }
  if (input.maxStock !== null) {
    if (!Number.isInteger(input.maxStock) || input.maxStock <= 0) {
      throw new DomainError('O estoque máximo deve ser um inteiro maior que zero.')
    }
    if (input.maxStock < input.minStock) {
      throw new DomainError('O estoque máximo não pode ser menor que o mínimo.')
    }
  }
  return {
    ...input,
    sku,
    name,
    barcode,
    description: input.description.trim(),
    location: input.location.trim().toUpperCase(),
  }
}

export function createProduct(
  data: AppData,
  input: CreateProductInput,
  ctx: DomainContext,
): { data: AppData; product: Product } {
  const clean = validateProduct(data, input)
  if (!Number.isInteger(input.initialQuantity) || input.initialQuantity < 0) {
    throw new DomainError('O saldo inicial deve ser um inteiro maior ou igual a zero.')
  }
  const now = ctx.now().toISOString()
  const product: Product = {
    id: ctx.newId(),
    sku: clean.sku,
    name: clean.name,
    description: clean.description,
    categoryId: clean.categoryId,
    unit: clean.unit,
    unitCost: clean.unitCost,
    salePrice: clean.salePrice,
    quantity: 0,
    minStock: clean.minStock,
    maxStock: clean.maxStock,
    supplierId: clean.supplierId,
    location: clean.location,
    barcode: clean.barcode,
    expiryDate: clean.expiryDate,
    active: clean.active,
    createdAt: now,
    updatedAt: now,
  }
  let next: AppData = { ...data, products: [product, ...data.products] }
  next = logActivity(next, ctx, {
    action: 'created',
    entity: 'product',
    entityId: product.id,
    summary: `Produto ${product.name} (${product.sku}) cadastrado.`,
  })
  if (input.initialQuantity > 0) {
    next = registerMovement(
      next,
      {
        operationId: input.operationId,
        productId: product.id,
        type: 'in',
        quantity: input.initialQuantity,
        reason: 'Saldo inicial',
        responsible: input.responsible,
      },
      ctx,
    ).data
  }
  const saved = next.products.find((p) => p.id === product.id) ?? product
  return { data: next, product: saved }
}

/** Edita os dados cadastrais. O saldo não é alterado aqui — apenas por movimentações. */
export function updateProduct(data: AppData, id: ID, input: ProductInput, ctx: DomainContext): AppData {
  const current = data.products.find((p) => p.id === id)
  if (!current) throw new DomainError('Produto não encontrado.')
  const clean = validateProduct(data, input, id)
  const updated: Product = {
    ...current,
    ...clean,
    quantity: current.quantity,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: ctx.now().toISOString(),
  }
  return logActivity(
    { ...data, products: data.products.map((p) => (p.id === id ? updated : p)) },
    ctx,
    {
      action: 'updated',
      entity: 'product',
      entityId: id,
      summary: `Produto ${updated.name} (${updated.sku}) editado.`,
    },
  )
}

export function setProductActive(data: AppData, id: ID, active: boolean, ctx: DomainContext): AppData {
  const current = data.products.find((p) => p.id === id)
  if (!current) throw new DomainError('Produto não encontrado.')
  if (current.active === active) return data
  return logActivity(
    {
      ...data,
      products: data.products.map((p) =>
        p.id === id ? { ...p, active, updatedAt: ctx.now().toISOString() } : p,
      ),
    },
    ctx,
    {
      action: active ? 'activated' : 'deactivated',
      entity: 'product',
      entityId: id,
      summary: `Produto ${current.name} (${current.sku}) ${active ? 'ativado' : 'inativado'}.`,
    },
  )
}

/** Indica por que um produto não pode ser excluído (ou null se pode). */
export function productDeletionBlocker(data: AppData, id: ID): string | null {
  const movements = data.movements.filter((m) => m.productId === id).length
  const orders = data.purchaseOrders.filter((o) => o.items.some((i) => i.productId === id)).length
  if (movements === 0 && orders === 0) return null
  const parts: string[] = []
  if (movements) parts.push(`${movements} movimentaç${movements === 1 ? 'ão' : 'ões'}`)
  if (orders) parts.push(`${orders} pedido${orders === 1 ? '' : 's'} de compra`)
  return `Este produto possui ${parts.join(' e ')}. Para preservar o histórico, inative-o em vez de excluir.`
}

export function deleteProduct(data: AppData, id: ID, ctx: DomainContext): AppData {
  const current = data.products.find((p) => p.id === id)
  if (!current) throw new DomainError('Produto não encontrado.')
  const blocker = productDeletionBlocker(data, id)
  if (blocker) throw new DomainError(blocker)
  return logActivity({ ...data, products: data.products.filter((p) => p.id !== id) }, ctx, {
    action: 'deleted',
    entity: 'product',
    entityId: id,
    summary: `Produto ${current.name} (${current.sku}) excluído.`,
  })
}
