import type { AppData, ID, Supplier } from '@/domain/entities'
import { DomainError } from '@/domain/rules'
import { type DomainContext, logActivity } from './context'

export interface SupplierInput {
  companyName: string
  contactName: string
  email: string
  phone: string
  cnpj: string | null
  address: string
  notes: string
  active: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CNPJ_RE = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/

function validate(data: AppData, input: SupplierInput, ignoreId?: ID): SupplierInput {
  const companyName = input.companyName.trim()
  if (!companyName) throw new DomainError('Informe o nome empresarial.')
  const email = input.email.trim().toLowerCase()
  if (email && !EMAIL_RE.test(email)) throw new DomainError('E-mail inválido.')
  const cnpj = input.cnpj?.trim() || null
  if (cnpj && !CNPJ_RE.test(cnpj)) throw new DomainError('CNPJ deve seguir o formato 00.000.000/0000-00.')
  if (cnpj && data.suppliers.some((s) => s.id !== ignoreId && s.cnpj === cnpj)) {
    throw new DomainError('Já existe um fornecedor com este CNPJ.')
  }
  return {
    companyName,
    contactName: input.contactName.trim(),
    email,
    phone: input.phone.trim(),
    cnpj,
    address: input.address.trim(),
    notes: input.notes.trim(),
    active: input.active,
  }
}

export function createSupplier(
  data: AppData,
  input: SupplierInput,
  ctx: DomainContext,
): { data: AppData; supplier: Supplier } {
  const clean = validate(data, input)
  const now = ctx.now().toISOString()
  const supplier: Supplier = { id: ctx.newId(), ...clean, createdAt: now, updatedAt: now }
  const next = logActivity({ ...data, suppliers: [...data.suppliers, supplier] }, ctx, {
    action: 'created',
    entity: 'supplier',
    entityId: supplier.id,
    summary: `Fornecedor ${supplier.companyName} cadastrado.`,
  })
  return { data: next, supplier }
}

export function updateSupplier(data: AppData, id: ID, input: SupplierInput, ctx: DomainContext): AppData {
  const current = data.suppliers.find((s) => s.id === id)
  if (!current) throw new DomainError('Fornecedor não encontrado.')
  const clean = validate(data, input, id)
  return logActivity(
    {
      ...data,
      suppliers: data.suppliers.map((s) =>
        s.id === id ? { ...s, ...clean, updatedAt: ctx.now().toISOString() } : s,
      ),
    },
    ctx,
    { action: 'updated', entity: 'supplier', entityId: id, summary: `Fornecedor ${clean.companyName} editado.` },
  )
}

export function setSupplierActive(data: AppData, id: ID, active: boolean, ctx: DomainContext): AppData {
  const current = data.suppliers.find((s) => s.id === id)
  if (!current) throw new DomainError('Fornecedor não encontrado.')
  if (current.active === active) return data
  return logActivity(
    {
      ...data,
      suppliers: data.suppliers.map((s) =>
        s.id === id ? { ...s, active, updatedAt: ctx.now().toISOString() } : s,
      ),
    },
    ctx,
    {
      action: active ? 'activated' : 'deactivated',
      entity: 'supplier',
      entityId: id,
      summary: `Fornecedor ${current.companyName} ${active ? 'ativado' : 'inativado'}.`,
    },
  )
}

export function supplierDeletionBlocker(data: AppData, id: ID): string | null {
  const products = data.products.filter((p) => p.supplierId === id).length
  const orders = data.purchaseOrders.filter((o) => o.supplierId === id).length
  if (!products && !orders) return null
  const parts: string[] = []
  if (products) parts.push(`${products} produto(s)`)
  if (orders) parts.push(`${orders} pedido(s) de compra`)
  return `Este fornecedor está vinculado a ${parts.join(' e ')}. Inative-o em vez de excluir.`
}

export function deleteSupplier(data: AppData, id: ID, ctx: DomainContext): AppData {
  const current = data.suppliers.find((s) => s.id === id)
  if (!current) throw new DomainError('Fornecedor não encontrado.')
  const blocker = supplierDeletionBlocker(data, id)
  if (blocker) throw new DomainError(blocker)
  return logActivity({ ...data, suppliers: data.suppliers.filter((s) => s.id !== id) }, ctx, {
    action: 'deleted',
    entity: 'supplier',
    entityId: id,
    summary: `Fornecedor ${current.companyName} excluído.`,
  })
}
