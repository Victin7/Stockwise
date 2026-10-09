/**
 * Entidades de domínio do StockWise.
 *
 * Todas as datas são armazenadas como strings ISO 8601 para que o estado
 * possa ser serializado em JSON sem perda de informação.
 */

export type ID = string
export type ISODate = string

export interface Category {
  id: ID
  name: string
  description: string
  /** Cor de identificação em hexadecimal (#RRGGBB). */
  color: string
  createdAt: ISODate
  updatedAt: ISODate
}

export const UNITS = ['un', 'cx', 'pct', 'kg', 'g', 'l', 'ml', 'm', 'rolo', 'par', 'resma'] as const
export type Unit = (typeof UNITS)[number]

export interface Product {
  id: ID
  sku: string
  name: string
  description: string
  categoryId: ID
  unit: Unit
  /** Custo unitário em centavos. */
  unitCost: number
  /** Preço de venda em centavos (opcional). */
  salePrice: number | null
  /** Saldo atual. Só é alterado por movimentações. */
  quantity: number
  minStock: number
  maxStock: number | null
  supplierId: ID | null
  location: string
  barcode: string | null
  /** Data de validade (yyyy-MM-dd), quando aplicável. */
  expiryDate: string | null
  active: boolean
  createdAt: ISODate
  updatedAt: ISODate
}

export interface Supplier {
  id: ID
  companyName: string
  contactName: string
  email: string
  phone: string
  cnpj: string | null
  address: string
  notes: string
  active: boolean
  createdAt: ISODate
  updatedAt: ISODate
}

export const MOVEMENT_TYPES = ['in', 'out', 'adjust_in', 'adjust_out'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export interface StockMovement {
  id: ID
  /** Identificador da operação — impede que a mesma operação seja aplicada duas vezes. */
  operationId: ID
  productId: ID
  type: MovementType
  quantity: number
  occurredAt: ISODate
  reason: string
  responsible: string
  notes: string
  purchaseOrderId: ID | null
  /** Saldo do produto imediatamente após a movimentação. */
  balanceAfter: number
}

export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'pending',
  'approved',
  'partially_received',
  'received',
  'cancelled',
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

export interface PurchaseOrderItem {
  id: ID
  productId: ID
  quantity: number
  /** Custo unitário em centavos. */
  unitCost: number
  receivedQuantity: number
}

export interface PurchaseOrderEvent {
  id: ID
  at: ISODate
  status: PurchaseOrderStatus
  summary: string
}

export interface PurchaseOrder {
  id: ID
  /** Número sequencial legível, ex.: PC-2026-0007. */
  number: string
  supplierId: ID
  createdAt: ISODate
  updatedAt: ISODate
  /** Data prevista de entrega (yyyy-MM-dd). */
  expectedAt: string
  items: PurchaseOrderItem[]
  notes: string
  status: PurchaseOrderStatus
  history: PurchaseOrderEvent[]
}

export const ACTIVITY_ENTITIES = [
  'product',
  'category',
  'supplier',
  'movement',
  'purchase_order',
  'settings',
  'system',
] as const
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number]

export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'activated',
  'deactivated',
  'stock_in',
  'stock_out',
  'stock_adjusted',
  'submitted',
  'approved',
  'received',
  'cancelled',
  'imported',
  'reset',
] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

export interface ActivityEvent {
  id: ID
  at: ISODate
  action: ActivityAction
  entity: ActivityEntity
  entityId: ID | null
  summary: string
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Settings {
  companyName: string
  currency: 'BRL'
  /** Estoque mínimo sugerido para novos produtos. */
  defaultLowStockThreshold: number
  /** Dias de antecedência para alertar sobre vencimento. */
  expiryWarningDays: number
  theme: ThemePreference
  pageSize: 10 | 20 | 50
  compactTables: boolean
  responsibleName: string
}

export interface AppData {
  schemaVersion: number
  products: Product[]
  categories: Category[]
  suppliers: Supplier[]
  movements: StockMovement[]
  purchaseOrders: PurchaseOrder[]
  activity: ActivityEvent[]
  settings: Settings
  /** Operações já aplicadas (limitado) — proteção contra aplicação duplicada. */
  processedOperations: ID[]
  /** Contador para numeração de pedidos de compra. */
  sequences: { purchaseOrder: number }
}
