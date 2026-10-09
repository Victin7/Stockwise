import { describe, expect, it } from 'vitest'
import type { AppData } from '@/domain/entities'
import { itemTotal, orderReceivedTotal, orderTotal } from '@/domain/rules'
import { createProduct } from '@/domain/services/products.service'
import {
  changeOrderStatus,
  createOrder,
  receiveOrder,
  updateOrder,
} from '@/domain/services/purchase-orders.service'
import { setSupplierActive } from '@/domain/services/suppliers.service'
import { buildFixture, createTestContext, productInput } from '../helpers'

function approvedOrder() {
  const t = createTestContext()
  const fx = buildFixture(t.ctx, 0)
  const second = createProduct(fx.data, productInput({ sku: 'TST-0002', categoryId: fx.category.id }), t.ctx)
  let data: AppData = second.data
  const res = createOrder(
    data,
    {
      supplierId: fx.supplier.id,
      expectedAt: '2026-10-10',
      notes: '',
      items: [
        { productId: fx.product.id, quantity: 10, unitCost: 1250 },
        { productId: second.product.id, quantity: 4, unitCost: 999 },
      ],
    },
    t.ctx,
    { submit: true },
  )
  data = changeOrderStatus(res.data, res.order.id, 'approved', t.ctx)
  return { ...t, ...fx, data, order: data.purchaseOrders[0]!, second: second.product }
}

describe('pedidos de compra', () => {
  it('calcula totais por item e do pedido em centavos', () => {
    const { order } = approvedOrder()
    expect(itemTotal(order.items[0]!)).toBe(12_500)
    expect(itemTotal(order.items[1]!)).toBe(3_996)
    expect(orderTotal(order)).toBe(16_496)
    expect(orderReceivedTotal(order)).toBe(0)
  })

  it('numera pedidos sequencialmente e registra histórico', () => {
    const { order, data } = approvedOrder()
    expect(order.number).toMatch(/^PC-\d{4}-0001$/)
    expect(order.history.map((h) => h.status)).toEqual(['pending', 'approved'])
    expect(data.sequences.purchaseOrder).toBe(1)
  })

  it('não altera o estoque ao criar ou aprovar o pedido', () => {
    const { data } = approvedOrder()
    expect(data.products.every((p) => p.quantity === 0)).toBe(true)
    expect(data.movements).toHaveLength(0)
  })

  it('registra recebimento parcial, gera entradas vinculadas e atualiza o status', () => {
    const { data, order, ctx, product } = approvedOrder()
    const next = receiveOrder(data, order.id, { operationId: 'rec-1', responsible: 'Ana', lines: [{ itemId: order.items[0]!.id, quantity: 6 }] }, ctx)
    const updated = next.purchaseOrders[0]!
    expect(updated.status).toBe('partially_received')
    expect(updated.items[0]!.receivedQuantity).toBe(6)
    expect(next.products.find((p) => p.id === product.id)!.quantity).toBe(6)
    expect(next.movements[0]).toMatchObject({ type: 'in', quantity: 6, purchaseOrderId: order.id, reason: 'Compra' })
    expect(orderReceivedTotal(updated)).toBe(7_500)

    const done = receiveOrder(
      next,
      order.id,
      { operationId: 'rec-2', responsible: 'Ana', lines: [{ itemId: order.items[0]!.id, quantity: 4 }, { itemId: order.items[1]!.id, quantity: 4 }] },
      ctx,
    )
    expect(done.purchaseOrders[0]!.status).toBe('received')
    expect(done.products.find((p) => p.id === product.id)!.quantity).toBe(10)
  })

  it('impede recebimento duplicado da mesma operação', () => {
    const { data, order, ctx } = approvedOrder()
    const input = { operationId: 'rec-dup', responsible: 'Ana', lines: [{ itemId: order.items[0]!.id, quantity: 2 }] }
    const once = receiveOrder(data, order.id, input, ctx)
    expect(() => receiveOrder(once, order.id, input, ctx)).toThrow(/já foi registrado/)
    expect(once.products.find((p) => p.id === order.items[0]!.productId)!.quantity).toBe(2)
  })

  it('impede receber acima do pendente, quantidades inválidas ou recebimento vazio', () => {
    const { data, order, ctx } = approvedOrder()
    const line = (quantity: number) => ({ operationId: `r${quantity}`, responsible: 'A', lines: [{ itemId: order.items[1]!.id, quantity }] })
    expect(() => receiveOrder(data, order.id, line(5), ctx)).toThrow(/acima do pendente/)
    expect(() => receiveOrder(data, order.id, line(-1), ctx)).toThrow(/inteiros positivos/)
    expect(() => receiveOrder(data, order.id, line(0), ctx)).toThrow(/pelo menos um item/)
  })

  it('valida todas as linhas antes de alterar qualquer saldo', () => {
    const { data, order, ctx } = approvedOrder()
    expect(() =>
      receiveOrder(
        data,
        order.id,
        { operationId: 'mix', responsible: 'A', lines: [{ itemId: order.items[0]!.id, quantity: 3 }, { itemId: order.items[1]!.id, quantity: 99 }] },
        ctx,
      ),
    ).toThrow()
    expect(data.products.every((p) => p.quantity === 0)).toBe(true)
  })

  it('bloqueia operações incompatíveis com o status', () => {
    const t = createTestContext()
    const fx = buildFixture(t.ctx, 0)
    const draft = createOrder(fx.data, { supplierId: fx.supplier.id, expectedAt: '2026-10-10', notes: '', items: [{ productId: fx.product.id, quantity: 1, unitCost: 100 }] }, t.ctx)
    const id = draft.order.id
    const item = draft.order.items[0]!.id
    expect(() => receiveOrder(draft.data, id, { operationId: 'x', responsible: 'A', lines: [{ itemId: item, quantity: 1 }] }, t.ctx)).toThrow(/não podem receber/)
    expect(() => changeOrderStatus(draft.data, id, 'approved', t.ctx)).toThrow(/Não é possível/)
    const cancelled = changeOrderStatus(draft.data, id, 'cancelled', t.ctx)
    expect(() => changeOrderStatus(cancelled, id, 'pending', t.ctx)).toThrow(/Não é possível/)
    expect(() => updateOrder(cancelled, id, { supplierId: fx.supplier.id, expectedAt: '2026-10-10', notes: '', items: [{ productId: fx.product.id, quantity: 2, unitCost: 100 }] }, t.ctx)).toThrow(/não podem ser editados/)
  })

  it('cancelamento preserva histórico e entradas já recebidas', () => {
    const { data, order, ctx, product } = approvedOrder()
    const partial = receiveOrder(data, order.id, { operationId: 'p', responsible: 'A', lines: [{ itemId: order.items[0]!.id, quantity: 5 }] }, ctx)
    const cancelled = changeOrderStatus(partial, order.id, 'cancelled', ctx, 'Fornecedor sem estoque')
    const o = cancelled.purchaseOrders[0]!
    expect(o.status).toBe('cancelled')
    expect(o.history.at(-1)!.summary).toMatch(/Fornecedor sem estoque/)
    expect(cancelled.movements.filter((m) => m.purchaseOrderId === order.id)).toHaveLength(1)
    expect(cancelled.products.find((p) => p.id === product.id)!.quantity).toBe(5)
  })

  it('valida itens: ao menos um, sem repetição e com valores válidos', () => {
    const t = createTestContext()
    const fx = buildFixture(t.ctx, 0)
    const base = { supplierId: fx.supplier.id, expectedAt: '2026-10-10', notes: '' }
    expect(() => createOrder(fx.data, { ...base, items: [] }, t.ctx)).toThrow(/pelo menos um item/)
    expect(() =>
      createOrder(fx.data, { ...base, items: [{ productId: fx.product.id, quantity: 1, unitCost: 1 }, { productId: fx.product.id, quantity: 2, unitCost: 1 }] }, t.ctx),
    ).toThrow(/mais de uma vez/)
    expect(() => createOrder(fx.data, { ...base, items: [{ productId: fx.product.id, quantity: 0, unitCost: 1 }] }, t.ctx)).toThrow(/Quantidade inválida/)
    expect(() => createOrder(fx.data, { ...base, items: [{ productId: fx.product.id, quantity: 1, unitCost: -5 }] }, t.ctx)).toThrow(/Custo unitário/)
    const inactive = setSupplierActive(fx.data, fx.supplier.id, false, t.ctx)
    expect(() => createOrder(inactive, { ...base, items: [{ productId: fx.product.id, quantity: 1, unitCost: 1 }] }, t.ctx)).toThrow(/inativo/)
  })
})
