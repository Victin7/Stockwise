import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  MovementType,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
} from '@/domain/entities'

/** Limites para evitar crescimento excessivo do armazenamento local. */
export const LIMITS = {
  activity: 500,
  movements: 3000,
  processedOperations: 1000,
  purchaseOrderHistory: 50,
  maxQuantity: 1_000_000,
  maxMoneyCents: 100_000_000_00,
} as const

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export type StockStatus = 'ok' | 'low' | 'out' | 'over'

/**
 * Situação do estoque de um produto.
 * - out: saldo zerado
 * - low: saldo igual ou abaixo do mínimo
 * - over: acima do máximo (quando definido)
 */
export function getStockStatus(product: Pick<Product, 'quantity' | 'minStock' | 'maxStock'>): StockStatus {
  if (product.quantity <= 0) return 'out'
  if (product.quantity <= product.minStock) return 'low'
  if (product.maxStock !== null && product.quantity > product.maxStock) return 'over'
  return 'ok'
}

export function isNearExpiry(product: Pick<Product, 'expiryDate'>, now: Date, warningDays: number): boolean {
  if (!product.expiryDate) return false
  const days = differenceInCalendarDays(parseISO(product.expiryDate), now)
  return days <= warningDays
}

export function daysUntilExpiry(product: Pick<Product, 'expiryDate'>, now: Date): number | null {
  if (!product.expiryDate) return null
  return differenceInCalendarDays(parseISO(product.expiryDate), now)
}

/** Sinal aplicado ao saldo por tipo de movimentação. */
export function movementSign(type: MovementType): 1 | -1 {
  return type === 'in' || type === 'adjust_in' ? 1 : -1
}

export function applyMovementToBalance(balance: number, type: MovementType, quantity: number): number {
  return balance + movementSign(type) * quantity
}

export function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function itemTotal(item: Pick<PurchaseOrderItem, 'quantity' | 'unitCost'>): number {
  return item.quantity * item.unitCost
}

export function orderTotal(order: Pick<PurchaseOrder, 'items'>): number {
  return order.items.reduce((sum, item) => sum + itemTotal(item), 0)
}

export function orderReceivedTotal(order: Pick<PurchaseOrder, 'items'>): number {
  return order.items.reduce((sum, item) => sum + item.receivedQuantity * item.unitCost, 0)
}

export function remainingToReceive(item: Pick<PurchaseOrderItem, 'quantity' | 'receivedQuantity'>): number {
  return Math.max(0, item.quantity - item.receivedQuantity)
}

/** Transições de status permitidas para pedidos de compra. */
export const ORDER_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'draft', 'cancelled'],
  approved: ['partially_received', 'received', 'cancelled'],
  partially_received: ['partially_received', 'received', 'cancelled'],
  received: [],
  cancelled: [],
}

export function canTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export const EDITABLE_ORDER_STATUSES: PurchaseOrderStatus[] = ['draft', 'pending']
export const RECEIVABLE_ORDER_STATUSES: PurchaseOrderStatus[] = ['approved', 'partially_received']
export const OPEN_ORDER_STATUSES: PurchaseOrderStatus[] = ['pending', 'approved', 'partially_received']

/** Valor do estoque (custo × saldo) em centavos. */
export function stockValue(product: Pick<Product, 'quantity' | 'unitCost'>): number {
  return product.quantity * product.unitCost
}

/** Normaliza um SKU para comparação (sem espaços extras, maiúsculas). */
export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase()
}
