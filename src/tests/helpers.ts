import type { AppData } from '@/domain/entities'
import { createCategory } from '@/domain/services/categories.service'
import type { DomainContext } from '@/domain/services/context'
import { type CreateProductInput, createProduct } from '@/domain/services/products.service'
import { createSupplier } from '@/domain/services/suppliers.service'
import { createEmptyData } from '@/infrastructure/storage/seed'

/** Contexto determinístico: relógio controlável e IDs sequenciais. */
export function createTestContext(start = new Date('2026-10-01T10:00:00Z')) {
  let now = start
  let counter = 0
  const ctx: DomainContext = { now: () => now, newId: () => `id-${++counter}` }
  return {
    ctx,
    advance(ms: number) {
      now = new Date(now.getTime() + ms)
    },
    set(date: Date) {
      now = date
    },
  }
}

export function productInput(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
  return {
    sku: 'TST-0001',
    name: 'Produto de teste',
    description: '',
    categoryId: '',
    unit: 'un',
    unitCost: 1000,
    salePrice: 1500,
    minStock: 5,
    maxStock: null,
    supplierId: null,
    location: 'A-01-01',
    barcode: null,
    expiryDate: null,
    active: true,
    initialQuantity: 0,
    operationId: `op-${Math.random()}`,
    responsible: 'Teste',
    ...overrides,
  }
}

/** Estado mínimo com 1 categoria, 1 fornecedor e 1 produto (saldo inicial configurável). */
export function buildFixture(ctx: DomainContext, initialQuantity = 10) {
  let data: AppData = createEmptyData()
  const cat = createCategory(data, { name: 'Geral', description: '', color: '#112233' }, ctx)
  data = cat.data
  const sup = createSupplier(
    data,
    { companyName: 'Fornecedor Exemplo', contactName: '', email: '', phone: '', cnpj: null, address: '', notes: '', active: true },
    ctx,
  )
  data = sup.data
  const prod = createProduct(
    data,
    productInput({ categoryId: cat.category.id, supplierId: sup.supplier.id, initialQuantity, operationId: 'op-initial' }),
    ctx,
  )
  return { data: prod.data, category: cat.category, supplier: sup.supplier, product: prod.product }
}
