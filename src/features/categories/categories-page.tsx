import { zodResolver } from '@hookform/resolvers/zod'
import { MoreHorizontal, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { useAppData } from '@/app/store'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { FormField } from '@/components/shared/form-field'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Category } from '@/domain/entities'
import { getStockStatus, stockValue } from '@/domain/rules'
import { createCategory, deleteCategory, updateCategory } from '@/domain/services/categories.service'
import { useAction } from '@/hooks/use-action'
import { useOpenFromQuery } from '@/hooks/use-open-from-query'
import { formatCurrency, formatNumber, pluralize } from '@/lib/format'
import { cn, matchesSearch } from '@/lib/utils'

const PALETTE = ['#3B6FD8', '#7C5CD6', '#1FA39A', '#E0912B', '#A07850', '#5F6B7A', '#C99A06', '#D2553F', '#2A9465', '#C2417F', '#0E7C74', '#8A6D3B']

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(60, 'Máximo de 60 caracteres'),
  description: z.string().max(240, 'Máximo de 240 caracteres'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida'),
})
type Values = z.infer<typeof schema>

function CategoryFormDialog({ open, onOpenChange, category }: { open: boolean; onOpenChange: (o: boolean) => void; category: Category | null }) {
  const data = useAppData()
  const run = useAction()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', color: PALETTE[0]! } })
  const { register, handleSubmit, control, reset, setError, formState } = form

  useEffect(() => {
    if (open) {
      const used = new Set(data.categories.map((c) => c.color.toUpperCase()))
      reset(
        category
          ? { name: category.name, description: category.description, color: category.color }
          : { name: '', description: '', color: PALETTE.find((c) => !used.has(c)) ?? PALETTE[0]! },
      )
    }
  }, [open, category, reset, data.categories])

  const onSubmit = handleSubmit((v) => {
    const lower = v.name.trim().toLocaleLowerCase('pt-BR')
    if (data.categories.some((c) => c.id !== category?.id && c.name.toLocaleLowerCase('pt-BR') === lower)) {
      setError('name', { message: 'Já existe uma categoria com este nome' })
      return
    }
    const ok = category
      ? run((d, ctx) => updateCategory(d, category.id, v, ctx), 'Categoria atualizada.')
      : run((d, ctx) => createCategory(d, v, ctx).data, 'Categoria criada.')
    if (ok) onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          <DialogDescription>A cor identifica a categoria em tabelas e gráficos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Nome" htmlFor="cat-name" required error={formState.errors.name?.message}>
            <Input id="cat-name" {...register('name')} aria-invalid={!!formState.errors.name} />
          </FormField>
          <FormField label="Descrição" htmlFor="cat-desc" error={formState.errors.description?.message}>
            <Textarea id="cat-desc" rows={2} {...register('description')} />
          </FormField>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Cor de identificação</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      className={cn('size-7 rounded-md ring-offset-2 ring-offset-card transition-shadow', field.value.toUpperCase() === c && 'ring-2 ring-foreground')}
                      style={{ background: c }}
                      aria-label={`Cor ${c}`}
                      aria-pressed={field.value.toUpperCase() === c}
                    />
                  ))}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="color" value={field.value} onChange={(e) => field.onChange(e.target.value.toUpperCase())} className="size-7 cursor-pointer rounded-md border bg-transparent" aria-label="Cor personalizada" />
                    Outra
                  </label>
                </div>
              </fieldset>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{category ? 'Salvar alterações' : 'Criar categoria'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesPage() {
  const data = useAppData()
  const run = useAction()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [target, setTarget] = useState('')
  const [onlyWithProducts, setOnlyWithProducts] = useState(false)

  useOpenFromQuery(() => {
    setEditing(null)
    setFormOpen(true)
  })

  const stats = useMemo(
    () =>
      new Map(
        data.categories.map((c) => {
          const items = data.products.filter((p) => p.categoryId === c.id)
          const active = items.filter((p) => p.active)
          return [
            c.id,
            {
              count: items.length,
              value: active.reduce((s, p) => s + stockValue(p), 0),
              alerts: active.filter((p) => ['low', 'out'].includes(getStockStatus(p))).length,
            },
          ]
        }),
      ),
    [data.categories, data.products],
  )

  const list = data.categories.filter(
    (c) => matchesSearch(search, c.name, c.description) && (!onlyWithProducts || (stats.get(c.id)?.count ?? 0) > 0),
  )
  const linked = deleting ? (stats.get(deleting.id)?.count ?? 0) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        description={`${pluralize(data.categories.length, 'categoria', 'categorias')} organizando ${pluralize(data.products.length, 'produto', 'produtos')}.`}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Nova categoria
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar categoria" className="sm:max-w-xs sm:flex-1" />
        <Select value={onlyWithProducts ? 'with' : 'all'} onValueChange={(v) => setOnlyWithProducts(v === 'with')}>
          <SelectTrigger className="sm:w-56" aria-label="Filtrar categorias">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem value="with">Somente com produtos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tags}
            title={data.categories.length === 0 ? 'Nenhuma categoria criada' : 'Nenhuma categoria encontrada'}
            description={data.categories.length === 0 ? 'Crie categorias para organizar os produtos.' : 'Tente outro termo de busca.'}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const s = stats.get(c.id)!
            return (
              <Card key={c.id} className="relative overflow-hidden">
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: c.color }} aria-hidden="true" />
                <div className="flex items-start justify-between gap-3 p-5 pl-6">
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-semibold tracking-tight">{c.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description || 'Sem descrição.'}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${c.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(c)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setTarget('')
                          setDeleting(c)
                        }}
                      >
                        <Trash2 /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-auto grid grid-cols-3 border-t text-sm">
                  <Link to={`/produtos?categoria=${c.id}`} className="p-3 pl-6 hover:bg-muted/50">
                    <p className="text-xs text-muted-foreground">Produtos</p>
                    <p className="tabular font-semibold">{formatNumber(s.count)}</p>
                  </Link>
                  <div className="border-l p-3">
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="tabular font-semibold">{formatCurrency(s.value)}</p>
                  </div>
                  <Link to={`/produtos?categoria=${c.id}&situacao=low`} className="border-l p-3 hover:bg-muted/50">
                    <p className="text-xs text-muted-foreground">Alertas</p>
                    <p className={cn('tabular font-semibold', s.alerts > 0 && 'text-low')}>{formatNumber(s.alerts)}</p>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editing} />

      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Excluir a categoria ${deleting.name}?`}
          description={
            linked > 0
              ? `Esta categoria possui ${pluralize(linked, 'produto', 'produtos')}. Escolha para qual categoria eles serão movidos antes da exclusão.`
              : 'A categoria não possui produtos e será removida definitivamente.'
          }
          confirmLabel={linked > 0 ? 'Reclassificar e excluir' : 'Excluir categoria'}
          destructive
          confirmDisabled={linked > 0 && !target}
          onConfirm={() => {
            run((d, ctx) => deleteCategory(d, deleting.id, ctx, target || undefined), 'Categoria excluída.')
            setDeleting(null)
          }}
        >
          {linked > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="cat-target">Mover produtos para</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="cat-target">
                  <SelectValue placeholder="Selecione a categoria de destino" />
                </SelectTrigger>
                <SelectContent>
                  {data.categories
                    .filter((c) => c.id !== deleting.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  )
}
