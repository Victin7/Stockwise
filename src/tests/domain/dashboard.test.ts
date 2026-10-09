import { describe, expect, it } from 'vitest'
import { registerMovement } from '@/domain/services/inventory.service'
import { computeDashboardMetrics } from '@/domain/services/dashboard.service'
import { createProduct } from '@/domain/services/products.service'
import { changeOrderStatus, createOrder } from '@/domain/services/purchase-orders.service'
import { buildSeedData } from '@/infrastructure/storage/seed'
import { getStockStatus, stockValue } from '@/domain/rules'
import { buildFixture, createTestContext, productInput } from '../helpers'

describe('indicadores do dashboard', () => {
  it('calcula cards e séries a partir dos dados', () => {
    const t = createTestContext(new Date('2026-10-01T12:00:00'))
    const fx = buildFixture(t.ctx, 10) // custo 10,00 → R$ 100,00
    let data = fx.data
    const low = createProduct(data, productInput({ sku: 'LOW', categoryId: fx.category.id, minStock: 5, initialQuantity: 3, unitCost: 200 }), t.ctx)
    data = createProduct(low.data, productInput({ sku: 'OUT', categoryId: fx.category.id, minStock: 2, initialQuantity: 0 }), t.ctx).data
    t.advance(24 * 3600_000)
    data = registerMovement(data, { operationId: 's1', productId: fx.product.id, type: 'out', quantity: 4, reason: 'Venda', responsible: 'A' }, t.ctx).data
    const order = createOrder(data, { supplierId: fx.supplier.id, expectedAt: '2026-10-09', notes: '', items: [{ productId: fx.product.id, quantity: 2, unitCost: 1000 }] }, t.ctx, { submit: true })
    data = changeOrderStatus(order.data, order.order.id, 'approved', t.ctx)

    const m = computeDashboardMetrics(data, { now: new Date('2026-10-02T18:00:00'), periodDays: 7 })
    expect(m.totalProducts).toBe(3)
    expect(m.totalUnits).toBe(6 + 3 + 0)
    expect(m.stockValue).toBe(6 * 1000 + 3 * 200)
    expect(m.lowStock).toBe(1)
    expect(m.outOfStock).toBe(1)
    expect(m.periodIn).toBe(13)
    expect(m.periodOut).toBe(4)
    expect(m.periodOutCount).toBe(1)
    expect(m.openOrders).toBe(1)
    expect(m.openOrdersValue).toBe(2000)
    expect(m.flow).toHaveLength(7)
    expect(m.flow.reduce((s, d) => s + d.entradas, 0)).toBe(13)
    expect(m.critical.map((p) => p.sku)).toEqual(['OUT', 'LOW'])
    expect(m.byCategory[0]!.value).toBe(m.stockValue)
  })

  it('ignora produtos inativos e movimentos fora do período', () => {
    const t = createTestContext(new Date('2026-09-01T12:00:00'))
    const fx = buildFixture(t.ctx, 10)
    const m = computeDashboardMetrics(fx.data, { now: new Date('2026-10-02T12:00:00'), periodDays: 7 })
    expect(m.periodIn).toBe(0)
    const inactive = { ...fx.data, products: fx.data.products.map((p) => ({ ...p, active: false })) }
    expect(computeDashboardMetrics(inactive, { now: new Date(), periodDays: 7 }).totalUnits).toBe(0)
  })

  it('é coerente com os dados de demonstração', () => {
    const now = new Date('2026-10-09T15:00:00')
    const data = buildSeedData(now)
    const m = computeDashboardMetrics(data, { now, periodDays: 30 })
    const active = data.products.filter((p) => p.active)
    expect(m.stockValue).toBe(active.reduce((s, p) => s + stockValue(p), 0))
    expect(m.lowStock).toBe(active.filter((p) => getStockStatus(p) === 'low').length)
    expect(m.byCategory.reduce((s, c) => s + c.value, 0)).toBe(m.stockValue)
  })
})
