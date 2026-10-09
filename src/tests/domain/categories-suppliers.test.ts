import { describe, expect, it } from 'vitest'
import { createCategory, deleteCategory, updateCategory } from '@/domain/services/categories.service'
import { createSupplier, deleteSupplier, updateSupplier } from '@/domain/services/suppliers.service'
import { updateSettings } from '@/domain/services/settings.service'
import { buildFixture, createTestContext } from '../helpers'

describe('categorias', () => {
  it('impede nome duplicado e cor inválida', () => {
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx)
    expect(() => createCategory(data, { name: 'geral', description: '', color: '#000000' }, ctx)).toThrow(/Já existe/)
    expect(() => createCategory(data, { name: 'Nova', description: '', color: 'red' }, ctx)).toThrow(/cor/)
  })

  it('exige reclassificação antes de excluir categoria com produtos', () => {
    const { ctx } = createTestContext()
    const { data, category, product } = buildFixture(ctx)
    expect(() => deleteCategory(data, category.id, ctx)).toThrow(/Reclassifique/)
    const other = createCategory(data, { name: 'Destino', description: '', color: '#445566' }, ctx)
    const next = deleteCategory(other.data, category.id, ctx, other.category.id)
    expect(next.categories.map((c) => c.name)).toEqual(['Destino'])
    expect(next.products.find((p) => p.id === product.id)!.categoryId).toBe(other.category.id)
  })

  it('edita categoria e registra atividade', () => {
    const { ctx } = createTestContext()
    const { data, category } = buildFixture(ctx)
    const next = updateCategory(data, category.id, { name: 'Renomeada', description: 'x', color: '#abcdef' }, ctx)
    expect(next.categories[0]).toMatchObject({ name: 'Renomeada', color: '#ABCDEF' })
    expect(next.activity[0]!.summary).toMatch(/Renomeada/)
  })
})

describe('fornecedores', () => {
  it('valida e-mail e CNPJ', () => {
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx)
    const base = { companyName: 'X', contactName: '', email: '', phone: '', cnpj: null, address: '', notes: '', active: true }
    expect(() => createSupplier(data, { ...base, email: 'invalido' }, ctx)).toThrow(/E-mail/)
    expect(() => createSupplier(data, { ...base, cnpj: '123' }, ctx)).toThrow(/CNPJ/)
    const ok = createSupplier(data, { ...base, cnpj: '11.222.333/0001-44' }, ctx)
    expect(() => createSupplier(ok.data, { ...base, companyName: 'Y', cnpj: '11.222.333/0001-44' }, ctx)).toThrow(/CNPJ/)
  })

  it('bloqueia exclusão de fornecedor vinculado a produtos', () => {
    const { ctx } = createTestContext()
    const { data, supplier } = buildFixture(ctx)
    expect(() => deleteSupplier(data, supplier.id, ctx)).toThrow(/Inative/)
    const edited = updateSupplier(data, supplier.id, { ...supplier, contactName: 'Novo contato' }, ctx)
    expect(edited.suppliers[0]!.contactName).toBe('Novo contato')
  })
})

describe('configurações', () => {
  it('valida e registra apenas alterações reais', () => {
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx)
    expect(updateSettings(data, data.settings, ctx)).toBe(data)
    const next = updateSettings(data, { ...data.settings, companyName: 'Empresa X', pageSize: 20 }, ctx)
    expect(next.settings.companyName).toBe('Empresa X')
    expect(next.activity[0]).toMatchObject({ entity: 'settings', action: 'updated' })
    expect(() => updateSettings(data, { ...data.settings, expiryWarningDays: 0 }, ctx)).toThrow(/inválida/)
  })
})
