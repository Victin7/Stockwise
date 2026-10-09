import { z } from 'zod'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
  MOVEMENT_TYPES,
  PURCHASE_ORDER_STATUSES,
  UNITS,
} from '@/domain/entities'
import { LIMITS } from '@/domain/rules'

/**
 * Schemas Zod usados para validar dados recuperados do armazenamento,
 * backups importados e entradas das operações de domínio.
 */

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida')
const dayDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
const id = z.string().min(1)
const cents = z.number().int().min(0).max(LIMITS.maxMoneyCents)
const qty = z.number().int().min(0).max(LIMITS.maxQuantity)
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida')

export const categorySchema = z.object({
  id,
  name: z.string().min(1).max(60),
  description: z.string().max(240),
  color: hexColor,
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const productSchema = z.object({
  id,
  sku: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  description: z.string().max(500),
  categoryId: id,
  unit: z.enum(UNITS),
  unitCost: cents,
  salePrice: cents.nullable(),
  quantity: qty,
  minStock: qty,
  maxStock: qty.nullable(),
  supplierId: id.nullable(),
  location: z.string().max(40),
  barcode: z.string().max(32).nullable(),
  expiryDate: dayDate.nullable(),
  active: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const supplierSchema = z.object({
  id,
  companyName: z.string().min(1).max(120),
  contactName: z.string().max(80),
  email: z.string().max(120),
  phone: z.string().max(30),
  cnpj: z.string().max(18).nullable(),
  address: z.string().max(200),
  notes: z.string().max(500),
  active: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const movementSchema = z.object({
  id,
  operationId: id,
  productId: id,
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.number().int().positive().max(LIMITS.maxQuantity),
  occurredAt: isoDate,
  reason: z.string().min(1).max(80),
  responsible: z.string().max(80),
  notes: z.string().max(500),
  purchaseOrderId: id.nullable(),
  balanceAfter: qty,
})

export const purchaseOrderItemSchema = z.object({
  id,
  productId: id,
  quantity: z.number().int().positive().max(LIMITS.maxQuantity),
  unitCost: cents,
  receivedQuantity: qty,
})

export const purchaseOrderSchema = z.object({
  id,
  number: z.string().min(1),
  supplierId: id,
  createdAt: isoDate,
  updatedAt: isoDate,
  expectedAt: dayDate,
  items: z.array(purchaseOrderItemSchema).min(1),
  notes: z.string().max(500),
  status: z.enum(PURCHASE_ORDER_STATUSES),
  history: z.array(
    z.object({ id, at: isoDate, status: z.enum(PURCHASE_ORDER_STATUSES), summary: z.string() }),
  ),
})

export const activitySchema = z.object({
  id,
  at: isoDate,
  action: z.enum(ACTIVITY_ACTIONS),
  entity: z.enum(ACTIVITY_ENTITIES),
  entityId: id.nullable(),
  summary: z.string(),
})

export const settingsSchema = z.object({
  companyName: z.string().min(1).max(80),
  currency: z.literal('BRL'),
  defaultLowStockThreshold: z.number().int().min(0).max(100_000),
  expiryWarningDays: z.number().int().min(1).max(365),
  theme: z.enum(['light', 'dark', 'system']),
  pageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  compactTables: z.boolean(),
  responsibleName: z.string().min(1).max(80),
})

export const appDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  products: z.array(productSchema),
  categories: z.array(categorySchema),
  suppliers: z.array(supplierSchema),
  movements: z.array(movementSchema),
  purchaseOrders: z.array(purchaseOrderSchema),
  activity: z.array(activitySchema),
  settings: settingsSchema,
  processedOperations: z.array(id),
  sequences: z.object({ purchaseOrder: z.number().int().min(0) }),
})

export type AppDataParsed = z.infer<typeof appDataSchema>

/** Mensagem legível a partir de um erro de validação do Zod. */
export function describeZodError(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return 'Dados inválidos.'
  const path = first.path.join('.')
  return path ? `${path}: ${first.message}` : first.message
}
