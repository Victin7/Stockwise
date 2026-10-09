import { ClipboardList, Eye, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, Power, Trash2, Truck } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppData } from '@/app/store'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { type Column, DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { ActiveBadge, OrderStatusBadge } from '@/components/shared/status-badges'
import { CodeTag, StockStatusBadge } from '@/components/shared/stock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Supplier } from '@/domain/entities'
import { getStockStatus, OPEN_ORDER_STATUSES, orderTotal } from '@/domain/rules'
import { deleteSupplier, setSupplierActive, supplierDeletionBlocker } from '@/domain/services/suppliers.service'
import { useAction } from '@/hooks/use-action'
import { useOpenFromQuery } from '@/hooks/use-open-from-query'
import { formatCurrency, formatDate, formatNumber, pluralize } from '@/lib/format'
import { matchesSearch } from '@/lib/utils'
import { SupplierFormDialog } from './supplier-form-dialog'

export default function SuppliersPage() {
  const data = useAppData()
  const run = useAction()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)
  const viewingId = params.get('ver')

  const setViewing = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('ver', id)
    else next.delete('ver')
    setParams(next, { replace: true })
  }

  const openCreate = useCallback(() => {
    setEditing(null)
    setFormOpen(true)
  }, [])
  useOpenFromQuery(openCreate)

  const stats = useMemo(
    () =>
      new Map(
        data.suppliers.map((s) => {
          const orders = data.purchaseOrders.filter((o) => o.supplierId === s.id)
          return [
            s.id,
            {
              products: data.products.filter((p) => p.supplierId === s.id).length,
              orders: orders.length,
              open: orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status)).length,
              purchased: orders.filter((o) => o.status !== 'cancelled' && o.status !== 'draft').reduce((sum, o) => sum + orderTotal(o), 0),
            },
          ]
        }),
      ),
    [data.suppliers, data.purchaseOrders, data.products],
  )

  const rows = data.suppliers.filter(
    (s) =>
      (status === 'all' || (status === 'active' ? s.active : !s.active)) &&
      matchesSearch(search, s.companyName, s.contactName, s.email, s.cnpj),
  )

  const toggle = (s: Supplier) =>
    run((d, ctx) => setSupplierActive(d, s.id, !s.active, ctx), s.active ? 'Fornecedor inativado.' : 'Fornecedor ativado.')
  const edit = (s: Supplier) => {
    setViewing(null)
    setEditing(s)
    setFormOpen(true)
  }

  const columns: Column<Supplier>[] = [
    {
      id: 'name',
      header: 'Fornecedor',
      sortValue: (s) => s.companyName,
      cell: (s) => (
        <div className="min-w-48">
          <p className="font-medium">{s.companyName}</p>
          {s.cnpj && <p className="font-mono text-[11px] text-muted-foreground">{s.cnpj}</p>}
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contato',
      hideBelow: 'md',
      sortValue: (s) => s.contactName,
      cell: (s) => (
        <div className="text-sm">
          <p>{s.contactName || '—'}</p>
          <p className="text-xs text-muted-foreground">{s.email}</p>
        </div>
      ),
    },
    { id: 'phone', header: 'Telefone', hideBelow: 'lg', cell: (s) => <span className="tabular text-sm whitespace-nowrap">{s.phone || '—'}</span> },
    { id: 'products', header: 'Produtos', align: 'right', hideBelow: 'sm', sortValue: (s) => stats.get(s.id)!.products, cell: (s) => <span className="tabular">{formatNumber(stats.get(s.id)!.products)}</span> },
    { id: 'open', header: 'Pedidos em aberto', align: 'right', hideBelow: 'md', sortValue: (s) => stats.get(s.id)!.open, cell: (s) => <span className="tabular">{formatNumber(stats.get(s.id)!.open)}</span> },
    { id: 'purchased', header: 'Total comprado', align: 'right', hideBelow: 'lg', sortValue: (s) => stats.get(s.id)!.purchased, cell: (s) => <span className="tabular font-medium">{formatCurrency(stats.get(s.id)!.purchased)}</span> },
    { id: 'status', header: 'Status', sortValue: (s) => (s.active ? 1 : 0), cell: (s) => <ActiveBadge active={s.active} /> },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${s.companyName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setViewing(s.id)}>
              <Eye /> Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => edit(s)}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggle(s)}>
              <Power /> {s.active ? 'Inativar' : 'Ativar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(s)}>
              <Trash2 /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const viewing = viewingId ? data.suppliers.find((s) => s.id === viewingId) : undefined
  const viewingProducts = viewing ? data.products.filter((p) => p.supplierId === viewing.id) : []
  const viewingOrders = viewing ? data.purchaseOrders.filter((o) => o.supplierId === viewing.id) : []
  const blocker = deleting ? supplierDeletionBlocker(data, deleting.id) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description={`${pluralize(data.suppliers.filter((s) => s.active).length, 'fornecedor ativo', 'fornecedores ativos')} de ${formatNumber(data.suppliers.length)} cadastrados.`}
        actions={
          <Button onClick={openCreate}>
            <Plus /> Novo fornecedor
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, contato, e-mail ou CNPJ" className="sm:max-w-sm sm:flex-1" />
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-48" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Somente ativos</SelectItem>
              <SelectItem value="inactive">Somente inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(s) => s.id}
          initialSort={{ id: 'name', direction: 'asc' }}
          onRowClick={(s) => setViewing(s.id)}
          resetKey={`${search}|${status}`}
          caption="Lista de fornecedores"
          empty={{ icon: Truck, title: 'Nenhum fornecedor encontrado', description: 'Ajuste a busca ou cadastre um novo fornecedor.' }}
        />
      </Card>

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={editing} />

      <Sheet open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent>
          {viewing && (
            <>
              <SheetHeader>
                <ActiveBadge active={viewing.active} />
                <SheetTitle className="mt-1">{viewing.companyName}</SheetTitle>
                <SheetDescription>{viewing.contactName ? `Contato: ${viewing.contactName}` : 'Sem contato definido'}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />{viewing.email || 'Sem e-mail'}</li>
                  <li className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{viewing.phone || 'Sem telefone'}</li>
                  <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-muted-foreground" />{viewing.address || 'Sem endereço'}</li>
                  {viewing.cnpj && <li className="font-mono text-xs text-muted-foreground">CNPJ {viewing.cnpj}</li>}
                </ul>
                {viewing.notes && <p className="rounded-lg bg-muted/50 p-3 text-sm">{viewing.notes}</p>}
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Produtos fornecidos ({viewingProducts.length})</h3>
                  {viewingProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum produto tem este fornecedor como principal.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {viewingProducts.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <Link to={`/produtos?ver=${p.id}`} className="min-w-0 truncate hover:underline">
                            <CodeTag className="mr-2">{p.sku}</CodeTag>
                            {p.name}
                          </Link>
                          <StockStatusBadge status={getStockStatus(p)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Pedidos de compra ({viewingOrders.length})</h3>
                  {viewingOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pedido para este fornecedor.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {viewingOrders.map((o) => (
                        <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <Link to={`/pedidos?ver=${o.id}`} className="font-mono text-xs text-primary hover:underline">{o.number}</Link>
                          <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                          <span className="tabular text-xs">{formatCurrency(orderTotal(o))}</span>
                          <OrderStatusBadge status={o.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </SheetBody>
              <SheetFooter className="sm:justify-between">
                <Button variant="ghost" onClick={() => toggle(viewing)}>
                  <Power /> {viewing.active ? 'Inativar' : 'Ativar'}
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {viewing.active && (
                    <Button variant="outline" asChild>
                      <Link to={`/pedidos?novo=1&fornecedor=${viewing.id}`}>
                        <ClipboardList /> Novo pedido
                      </Link>
                    </Button>
                  )}
                  <Button onClick={() => edit(viewing)}>
                    <Pencil /> Editar
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={blocker ? 'Não é possível excluir este fornecedor' : `Excluir ${deleting.companyName}?`}
          description={blocker ?? 'O fornecedor será removido definitivamente. Esta ação não pode ser desfeita.'}
          confirmLabel={blocker ? (deleting.active ? 'Inativar fornecedor' : 'Entendi') : 'Excluir fornecedor'}
          destructive={!blocker}
          onConfirm={() => {
            if (blocker) {
              if (deleting.active) toggle(deleting)
            } else {
              run((d, ctx) => deleteSupplier(d, deleting.id, ctx), 'Fornecedor excluído.')
            }
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
