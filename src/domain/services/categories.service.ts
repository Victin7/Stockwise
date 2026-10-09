import type { AppData, Category, ID } from '@/domain/entities'
import { DomainError } from '@/domain/rules'
import { type DomainContext, logActivity } from './context'

export interface CategoryInput {
  name: string
  description: string
  color: string
}

function validate(data: AppData, input: CategoryInput, ignoreId?: ID): CategoryInput {
  const name = input.name.trim()
  if (!name) throw new DomainError('Informe o nome da categoria.')
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new DomainError('Escolha uma cor válida.')
  const lower = name.toLocaleLowerCase('pt-BR')
  if (data.categories.some((c) => c.id !== ignoreId && c.name.toLocaleLowerCase('pt-BR') === lower)) {
    throw new DomainError(`Já existe uma categoria chamada ${name}.`)
  }
  return { name, description: input.description.trim(), color: input.color.toUpperCase() }
}

export function createCategory(
  data: AppData,
  input: CategoryInput,
  ctx: DomainContext,
): { data: AppData; category: Category } {
  const clean = validate(data, input)
  const now = ctx.now().toISOString()
  const category: Category = { id: ctx.newId(), ...clean, createdAt: now, updatedAt: now }
  const next = logActivity({ ...data, categories: [...data.categories, category] }, ctx, {
    action: 'created',
    entity: 'category',
    entityId: category.id,
    summary: `Categoria ${category.name} criada.`,
  })
  return { data: next, category }
}

export function updateCategory(data: AppData, id: ID, input: CategoryInput, ctx: DomainContext): AppData {
  const current = data.categories.find((c) => c.id === id)
  if (!current) throw new DomainError('Categoria não encontrada.')
  const clean = validate(data, input, id)
  return logActivity(
    {
      ...data,
      categories: data.categories.map((c) =>
        c.id === id ? { ...c, ...clean, updatedAt: ctx.now().toISOString() } : c,
      ),
    },
    ctx,
    { action: 'updated', entity: 'category', entityId: id, summary: `Categoria ${clean.name} editada.` },
  )
}

/**
 * Exclui uma categoria. Se houver produtos associados, é obrigatório informar
 * uma categoria de destino para reclassificá-los antes da exclusão.
 */
export function deleteCategory(
  data: AppData,
  id: ID,
  ctx: DomainContext,
  reassignTo?: ID,
): AppData {
  const current = data.categories.find((c) => c.id === id)
  if (!current) throw new DomainError('Categoria não encontrada.')
  const linked = data.products.filter((p) => p.categoryId === id)
  let next = data
  if (linked.length > 0) {
    if (!reassignTo) {
      throw new DomainError(
        `A categoria ${current.name} possui ${linked.length} produto(s). Reclassifique-os antes de excluir.`,
      )
    }
    if (reassignTo === id || !data.categories.some((c) => c.id === reassignTo)) {
      throw new DomainError('Escolha outra categoria de destino para os produtos.')
    }
    const now = ctx.now().toISOString()
    const target = data.categories.find((c) => c.id === reassignTo)!
    next = {
      ...next,
      products: next.products.map((p) =>
        p.categoryId === id ? { ...p, categoryId: reassignTo, updatedAt: now } : p,
      ),
    }
    next = logActivity(next, ctx, {
      action: 'updated',
      entity: 'category',
      entityId: reassignTo,
      summary: `${linked.length} produto(s) reclassificado(s) de ${current.name} para ${target.name}.`,
    })
  }
  return logActivity({ ...next, categories: next.categories.filter((c) => c.id !== id) }, ctx, {
    action: 'deleted',
    entity: 'category',
    entityId: id,
    summary: `Categoria ${current.name} excluída.`,
  })
}
