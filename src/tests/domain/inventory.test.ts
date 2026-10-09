import { describe, expect, it } from 'vitest'
import type { MovementType } from '@/domain/entities'
import { applyMovementToBalance, getStockStatus } from '@/domain/rules'
import { registerMovement } from '@/domain/services/inventory.service'
import { buildFixture, createTestContext } from '../helpers'

const move = (type: MovementType, quantity: number, operationId: string) => ({
  operationId,
  type,
  quantity,
  reason: 'Teste',
  responsible: 'Tester',
})

describe('cálculo do saldo de estoque', () => {
  it('aplica entradas, saídas e ajustes conforme o tipo', () => {
    expect(applyMovementToBalance(10, 'in', 5)).toBe(15)
    expect(applyMovementToBalance(10, 'out', 4)).toBe(6)
    expect(applyMovementToBalance(10, 'adjust_in', 2)).toBe(12)
    expect(applyMovementToBalance(10, 'adjust_out', 3)).toBe(7)
  })

  it('atualiza o saldo e registra o saldo após cada movimentação', () => {
    const { ctx } = createTestContext()
    let { data, product } = buildFixture(ctx, 10)
    data = registerMovement(data, { ...move('out', 4, 'op1'), productId: product.id }, ctx).data
    data = registerMovement(data, { ...move('in', 20, 'op2'), productId: product.id }, ctx).data
    data = registerMovement(data, { ...move('adjust_out', 1, 'op3'), productId: product.id }, ctx).data
    data = registerMovement(data, { ...move('adjust_in', 3, 'op4'), productId: product.id }, ctx).data
    expect(data.products[0]!.quantity).toBe(28)
    expect(data.movements.map((m) => m.balanceAfter)).toEqual([28, 25, 26, 6, 10])
    // O saldo atual é sempre igual à soma das movimentações
    const sum = data.movements.reduce((s, m) => applyMovementToBalance(s, m.type, m.quantity), 0)
    expect(sum).toBe(data.products[0]!.quantity)
  })

  it('bloqueia saídas e ajustes negativos acima do disponível sem alterar o estado', () => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 3)
    expect(() => registerMovement(data, { ...move('out', 4, 'a'), productId: product.id }, ctx)).toThrow(/Saldo insuficiente/)
    expect(() => registerMovement(data, { ...move('adjust_out', 4, 'b'), productId: product.id }, ctx)).toThrow(/Saldo insuficiente/)
    expect(data.products[0]!.quantity).toBe(3)
    expect(data.movements).toHaveLength(1)
  })

  it('permite saída que zera o saldo', () => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 3)
    const next = registerMovement(data, { ...move('out', 3, 'z'), productId: product.id }, ctx).data
    expect(next.products[0]!.quantity).toBe(0)
    expect(getStockStatus(next.products[0]!)).toBe('out')
  })

  it.each([0, -2, 1.5, Number.NaN])('rejeita quantidade inválida (%s)', (q) => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 10)
    expect(() => registerMovement(data, { ...move('in', q, `q${q}`), productId: product.id }, ctx)).toThrow(/quantidade/i)
  })

  it('exige motivo e produto existente', () => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 10)
    expect(() => registerMovement(data, { ...move('in', 1, 'r'), reason: '  ', productId: product.id }, ctx)).toThrow(/motivo/)
    expect(() => registerMovement(data, { ...move('in', 1, 'p'), productId: 'nada' }, ctx)).toThrow(/não encontrado/)
  })

  it('não aplica a mesma operação duas vezes', () => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 10)
    const once = registerMovement(data, { ...move('out', 2, 'dup'), productId: product.id }, ctx).data
    expect(() => registerMovement(once, { ...move('out', 2, 'dup'), productId: product.id }, ctx)).toThrow(/já foi registrada/)
    expect(once.products[0]!.quantity).toBe(8)
  })

  it('classifica a situação do estoque', () => {
    expect(getStockStatus({ quantity: 0, minStock: 5, maxStock: null })).toBe('out')
    expect(getStockStatus({ quantity: 5, minStock: 5, maxStock: null })).toBe('low')
    expect(getStockStatus({ quantity: 6, minStock: 5, maxStock: null })).toBe('ok')
    expect(getStockStatus({ quantity: 11, minStock: 5, maxStock: 10 })).toBe('over')
  })
})
