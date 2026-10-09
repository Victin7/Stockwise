import { describe, expect, it } from 'vitest'
import { DomainError } from '@/domain/rules'
import { registerMovement } from '@/domain/services/inventory.service'
import {
  createProduct,
  deleteProduct,
  productDeletionBlocker,
  setProductActive,
  updateProduct,
} from '@/domain/services/products.service'
import { buildFixture, createTestContext, productInput } from '../helpers'

describe('cadastro de produtos', () => {
  it('cria produto com saldo inicial gerando uma movimentação de entrada', () => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 12)
    expect(product.quantity).toBe(12)
    expect(data.movements).toHaveLength(1)
    expect(data.movements[0]).toMatchObject({ type: 'in', quantity: 12, reason: 'Saldo inicial', balanceAfter: 12 })
    expect(data.activity.some((a) => a.entity === 'product' && a.action === 'created')).toBe(true)
  })

  it('cria produto sem saldo inicial sem gerar movimentação', () => {
    const { ctx } = createTestContext()
    const { data, category } = buildFixture(ctx, 0)
    const res = createProduct(data, productInput({ sku: 'TST-0002', categoryId: category.id }), ctx)
    expect(res.product.quantity).toBe(0)
    expect(res.data.movements).toHaveLength(0)
  })

  it('normaliza o SKU e impede SKUs duplicados (sem diferenciar maiúsculas)', () => {
    const { ctx } = createTestContext()
    const { data, category } = buildFixture(ctx)
    expect(() => createProduct(data, productInput({ sku: ' tst-0001 ', categoryId: category.id }), ctx)).toThrow(/já está em uso/)
    const ok = createProduct(data, productInput({ sku: ' tst-0009 ', categoryId: category.id }), ctx)
    expect(ok.product.sku).toBe('TST-0009')
  })

  it('impede código de barras duplicado', () => {
    const { ctx } = createTestContext()
    const { data, category } = buildFixture(ctx)
    const first = createProduct(data, productInput({ sku: 'A-1', barcode: '7890000000001', categoryId: category.id }), ctx)
    expect(() => createProduct(first.data, productInput({ sku: 'A-2', barcode: '7890000000001', categoryId: category.id }), ctx)).toThrow(DomainError)
  })

  it('valida valores monetários, estoque mínimo/máximo e categoria', () => {
    const { ctx } = createTestContext()
    const { data, category } = buildFixture(ctx)
    expect(() => createProduct(data, productInput({ sku: 'X1', categoryId: category.id, unitCost: -1 }), ctx)).toThrow(/monetários/)
    expect(() => createProduct(data, productInput({ sku: 'X2', categoryId: category.id, unitCost: 10.5 }), ctx)).toThrow(/monetários/)
    expect(() => createProduct(data, productInput({ sku: 'X3', categoryId: category.id, minStock: 10, maxStock: 5 }), ctx)).toThrow(/máximo/)
    expect(() => createProduct(data, productInput({ sku: 'X4', categoryId: 'inexistente' }), ctx)).toThrow(/categoria/)
    expect(() => createProduct(data, productInput({ sku: 'X5', categoryId: category.id, initialQuantity: -3 }), ctx)).toThrow(/saldo inicial/)
  })

  it('edita dados cadastrais sem alterar o saldo', () => {
    const { ctx, advance } = createTestContext()
    const { data, product } = buildFixture(ctx, 8)
    advance(60_000)
    const next = updateProduct(data, product.id, { ...product, name: 'Nome novo', unitCost: 2500 }, ctx)
    const updated = next.products.find((p) => p.id === product.id)!
    expect(updated).toMatchObject({ name: 'Nome novo', unitCost: 2500, quantity: 8, createdAt: product.createdAt })
    expect(updated.updatedAt).not.toBe(product.updatedAt)
    // Tentativa de "injetar" saldo pela edição é ignorada
    const sneaky = updateProduct(next, product.id, { ...updated, quantity: 999 } as typeof updated, ctx)
    expect(sneaky.products.find((p) => p.id === product.id)!.quantity).toBe(8)
  })

  it('impede editar para um SKU já usado por outro produto', () => {
    const { ctx } = createTestContext()
    const { data, category, product } = buildFixture(ctx)
    const other = createProduct(data, productInput({ sku: 'OUTRO-1', categoryId: category.id }), ctx)
    expect(() => updateProduct(other.data, other.product.id, { ...other.product, sku: product.sku }, ctx)).toThrow(/já está em uso/)
  })

  it('bloqueia exclusão de produto com movimentações e permite inativar', () => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 5)
    expect(productDeletionBlocker(data, product.id)).toMatch(/inative/)
    expect(() => deleteProduct(data, product.id, ctx)).toThrow(/inative/)
    const inactive = setProductActive(data, product.id, false, ctx)
    expect(inactive.products[0]!.active).toBe(false)
  })

  it('exclui produto sem vínculos', () => {
    const { ctx } = createTestContext()
    const { data, category } = buildFixture(ctx)
    const res = createProduct(data, productInput({ sku: 'SOLTO', categoryId: category.id }), ctx)
    const next = deleteProduct(res.data, res.product.id, ctx)
    expect(next.products.some((p) => p.id === res.product.id)).toBe(false)
  })

  it('não permite saída de produto inativo', () => {
    const { ctx } = createTestContext()
    const { data, product } = buildFixture(ctx, 5)
    const inactive = setProductActive(data, product.id, false, ctx)
    expect(() =>
      registerMovement(inactive, { operationId: 'x', productId: product.id, type: 'out', quantity: 1, reason: 'Venda', responsible: 'T' }, ctx),
    ).toThrow(/inativo/)
  })
})
