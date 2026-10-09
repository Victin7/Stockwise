import { describe, expect, it } from 'vitest'
import { PURCHASE_ORDER_STATUSES } from '@/domain/entities'
import { applyMovementToBalance, getStockStatus } from '@/domain/rules'
import { appDataSchema } from '@/domain/schemas'
import { findIntegrityIssues } from '@/domain/services/integrity.service'
import { buildSeedData } from '@/infrastructure/storage/seed'

describe('dados de demonstração', () => {
  const now = new Date('2026-10-09T15:00:00')
  const data = buildSeedData(now)

  it('atende às quantidades mínimas', () => {
    expect(data.products.length).toBeGreaterThanOrEqual(30)
    expect(data.categories.length).toBeGreaterThanOrEqual(8)
    expect(data.suppliers.length).toBeGreaterThanOrEqual(6)
    expect(data.movements.length).toBeGreaterThanOrEqual(40)
    expect(data.purchaseOrders.length).toBeGreaterThanOrEqual(10)
  })

  it('é válido e consistente', () => {
    expect(appDataSchema.safeParse(data).success).toBe(true)
    expect(findIntegrityIssues(data)).toEqual([])
  })

  it('tem pedidos em todos os status e produtos em todas as situações', () => {
    const statuses = new Set(data.purchaseOrders.map((o) => o.status))
    for (const s of PURCHASE_ORDER_STATUSES) expect(statuses.has(s)).toBe(true)
    const situations = new Set(data.products.map((p) => getStockStatus(p)))
    expect(situations).toEqual(new Set(['ok', 'low', 'out']))
  })

  it('o saldo de cada produto é igual à soma das suas movimentações', () => {
    for (const p of data.products) {
      const moves = data.movements.filter((m) => m.productId === p.id)
      const sum = moves.reduce((s, m) => applyMovementToBalance(s, m.type, m.quantity), 0)
      expect(sum).toBe(p.quantity)
    }
  })

  it('não contém datas futuras', () => {
    expect(data.movements.every((m) => new Date(m.occurredAt) <= now)).toBe(true)
  })
})
