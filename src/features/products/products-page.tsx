import { ArrowLeftRight, Eye, MoreHorizontal, Package, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAppData } from '@/app/store'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { type Column, DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { CodeTag, StockGauge, StockStatusBadge } from '@/components/shared/stock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Product } from '@/domain/entities'
import { getStockStatus, isNearExpiry, stockValue } from '@/domain/rules'
import { deleteProduct, productDeletionBlocker, setProductActive } from '@/domain/services/products.service'
import { useAction } from '@/hooks/use-action'
import { useOpenFromQuery } from '@/hooks/use-open-from-query'
import { formatCurrency, pluralize } from '@/lib/format'
import { matchesSearch } from '@/lib/utils'
import { ProductDetailsSheet } from './product-details-sheet'
import { ProductFormSheet } from './product-form-sheet'

const SITUATIONS = [
  { value: 'all', label: 'Todas as situações' },
  { value: 'ok', label: 'Estoque normal' },
  { value: 'low', label: 'Estoque baixo' },
  { value: 'out', label: 'Sem estoque' },
  { value: 'over', label: 'Acima do máximo' },
  { value: 'expiring', label: 'Próximos do vencimento' },
] as const

const ACTIVITY = [
  { value: 'active', label: 'Somente ativos' },
  { value: 'inactive', label: 'Somente inativos' },
  { value: 'all', label: 'Ativos e inativos' },
] as const

export default function ProductsPage() {
  const data = useAppData()
  const run = useAction()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const search = params.get('q') ?? ''
  const category = params.get('categoria') ?? 'all'
  const situation = params.get('situacao') ?? 'all'
  const activity = params.get('ativos') ?? 'active'
  const viewing = params.get('ver')

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const openCreate = useCallback(() => {
    setEditing(null)
    setFormOpen(true)
  }, [])
  useOpenFromQuery(openCreate)

  const openEdit = (p: Product) => {
    setParam('ver', '', '')
    setEditing(p)
    setFormOpen(true)
  }

  const toggleActive = (p: Product) =>
    run((d, ctx) => setProductActive(d, p.id, !p.active, ctx), p.active ? 'Produto inativado.' : 'Produto ativado.')

  const categories = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories])
  const now = useMemo(() => new Date(), [])

  const rows = useMemo(
    () =>
      data.products.filter((p) => {
        if (activity === 'active' && !p.active) return false
        if (activity === 'inactive' && p.active) return false
        if (category !== 'all' && p.categoryId !== category) return false
        if (situation === 'expiring') {
          if (!(p.quantity > 0 && isNearExpiry(p, now, data.settings.expiryWarningDays))) return false
        } else if (situation !== 'all' && getStockStatus(p) !== situation) return false
        return matchesSearch(search, p.name, p.sku, p.barcode)
      }),
    [data.products, data.settings.expiryWarningDays, activity, category, situation, search, now],
  )

  const columns: Column<Product>[] = [
    {
      id: 'name',
      header: 'Produto',
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="min-w-40 sm:min-w-48">
          <p className="font-medium">{p.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <CodeTag>{p.sku}</CodeTag>
            {p.location && <span className="font-mono text-[11px] text-muted-foreground">{p.location}</span>}
            {!p.active && <Badge variant="muted">Inativo</Badge>}
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Categoria',
      hideBelow: 'md',
      sortValue: (p) => categories.get(p.categoryId)?.name ?? '',
      cell: (p) => {
        const c = categories.get(p.categoryId)
        return (
          <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
            <span className="size-2 rounded-full" style={{ background: c?.color }} />
            {c?.name}
          </span>
        )
      },
    },
    {
      id: 'stock',
      header: 'Estoque',
      sortValue: (p) => p.quantity,
      cell: (p) => <StockGauge product={p} className="w-28 sm:w-36" />,
    },
    {
      id: 'status',
      header: 'Situação',
      hideBelow: 'sm',
      sortValue: (p) => ['out', 'low', 'ok', 'over'].indexOf(getStockStatus(p)),
      cell: (p) => <StockStatusBadge status={getStockStatus(p)} />,
    },
    {
      id: 'cost',
      header: 'Custo unit.',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (p) => p.unitCost,
      cell: (p) => <span className="tabular">{formatCurrency(p.unitCost)}</span>,
    },
    {
      id: 'value',
      header: 'Valor em estoque',
      align: 'right',
      hideBelow: 'md',
      sortValue: (p) => stockValue(p),
      cell: (p) => <span className="tabular font-medium">{formatCurrency(stockValue(p))}</span>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${p.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setParam('ver', p.id, '')}>
              <Eye /> Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openEdit(p)}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/estoque?novo=1&produto=${p.id}`)}>
              <ArrowLeftRight /> Registrar movimentação
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggleActive(p)}>
              <Power /> {p.active ? 'Inativar' : 'Ativar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
              <Trash2 /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const viewingProduct = viewing ? (data.products.find((p) => p.id === viewing) ?? null) : null
  const deleteBlocker = deleting ? productDeletionBlocker(data, deleting.id) : null
  const lowCount = data.products.filter((p) => p.active && ['low', 'out'].includes(getStockStatus(p))).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description={`${pluralize(data.products.length, 'produto cadastrado', 'produtos cadastrados')}. ${lowCount > 0 ? `${pluralize(lowCount, 'precisa', 'precisam')} de reposição.` : 'Nenhum item abaixo do mínimo.'}`}
        actions={
          <Button onClick={openCreate}>
            <Plus /> Novo produto
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={(v) => setParam('q', v, '')}
            placeholder="Buscar por nome, SKU ou código de barras"
            className="lg:max-w-sm lg:flex-1"
          />
          <div className="grid gap-3 sm:grid-cols-3 lg:flex">
            <Select value={category} onValueChange={(v) => setParam('categoria', v, 'all')}>
              <SelectTrigger className="lg:w-52" aria-label="Filtrar por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {data.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={situation} onValueChange={(v) => setParam('situacao', v, 'all')}>
              <SelectTrigger className="lg:w-52" aria-label="Filtrar por situação do estoque">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUATIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activity} onValueChange={(v) => setParam('ativos', v, 'active')}>
              <SelectTrigger className="lg:w-44" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(p) => p.id}
          initialSort={{ id: 'name', direction: 'asc' }}
          onRowClick={(p) => setParam('ver', p.id, '')}
          resetKey={`${search}|${category}|${situation}|${activity}`}
          caption="Lista de produtos"
          empty={
            data.products.length === 0
              ? {
                  icon: Package,
                  title: 'Nenhum produto cadastrado',
                  description: 'Cadastre o primeiro produto para começar a controlar o estoque.',
                  action: (
                    <Button onClick={openCreate}>
                      <Plus /> Novo produto
                    </Button>
                  ),
                }
              : {
                  icon: Package,
                  title: 'Nenhum produto encontrado',
                  description: 'Ajuste a busca ou os filtros para ver outros produtos.',
                  action: (
                    <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                      Limpar filtros
                    </Button>
                  ),
                }
          }
        />
      </Card>

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <ProductDetailsSheet
        product={viewingProduct}
        onOpenChange={(open) => !open && setParam('ver', '', '')}
        onEdit={openEdit}
        onToggleActive={toggleActive}
      />

      {deleting && deleteBlocker ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Não é possível excluir este produto"
          description={deleteBlocker}
          confirmLabel={deleting.active ? 'Inativar produto' : 'Entendi'}
          onConfirm={() => {
            if (deleting.active) toggleActive(deleting)
            setDeleting(null)
          }}
        />
      ) : deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Excluir ${deleting.name}?`}
          description="O produto será removido definitivamente. Esta ação não pode ser desfeita."
          confirmLabel="Excluir produto"
          destructive
          onConfirm={() => {
            run((d, ctx) => deleteProduct(d, deleting.id, ctx), 'Produto excluído.')
            setDeleting(null)
          }}
        />
      ) : null}
    </div>
  )
}
