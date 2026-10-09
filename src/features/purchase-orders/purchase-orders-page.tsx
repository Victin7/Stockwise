import { parseISO, startOfDay } from 'date-fns'
import { ClipboardList, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAppData } from '@/app/store'
import { type Column, DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { OrderStatusBadge } from '@/components/shared/status-badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PURCHASE_ORDER_STATUSES, type PurchaseOrder, type PurchaseOrderStatus } from '@/domain/entities'
import { ORDER_STATUS_LABEL } from '@/domain/labels'
import { OPEN_ORDER_STATUSES, orderTotal } from '@/domain/rules'
import { useOpenFromQuery } from '@/hooks/use-open-from-query'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { cn, matchesSearch } from '@/lib/utils'
import { OrderDetailsSheet } from './order-details-sheet'
import { OrderFormSheet } from './order-form-sheet'
import { ReceiveDialog } from './receive-dialog'

export default function PurchaseOrdersPage() {
  const data = useAppData()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | PurchaseOrderStatus>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [form, setForm] = useState<{ open: boolean; order: PurchaseOrder | null; supplierId?: string; productId?: string }>({ open: false, order: null })
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null)
  const viewingId = params.get('ver')

  const setViewing = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('ver', id)
    else next.delete('ver')
    setParams(next, { replace: true })
  }

  const openNew = useCallback(
    (p: URLSearchParams) => setForm({ open: true, order: null, supplierId: p.get('fornecedor') ?? undefined, productId: p.get('produto') ?? undefined }),
    [],
  )
  useOpenFromQuery(openNew)

  const supplierName = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s.companyName])), [data.suppliers])
  const today = startOfDay(new Date())
  const isLate = (o: PurchaseOrder) => OPEN_ORDER_STATUSES.includes(o.status) && parseISO(o.expectedAt) < today

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.purchaseOrders.length, open: 0 }
    for (const o of data.purchaseOrders) {
      c[o.status] = (c[o.status] ?? 0) + 1
      if (OPEN_ORDER_STATUSES.includes(o.status)) c.open = (c.open ?? 0) + 1
    }
    return c
  }, [data.purchaseOrders])

  const rows = data.purchaseOrders.filter((o) => {
    if (status === 'open' ? !OPEN_ORDER_STATUSES.includes(o.status) : status !== 'all' && o.status !== status) return false
    if (supplierFilter !== 'all' && o.supplierId !== supplierFilter) return false
    return matchesSearch(search, o.number, supplierName.get(o.supplierId))
  })

  const columns: Column<PurchaseOrder>[] = [
    { id: 'number', header: 'Número', sortValue: (o) => o.number, cell: (o) => <span className="font-mono text-sm font-medium whitespace-nowrap">{o.number}</span> },
    { id: 'supplier', header: 'Fornecedor', sortValue: (o) => supplierName.get(o.supplierId) ?? '', cell: (o) => <span className="block min-w-40">{supplierName.get(o.supplierId)}</span> },
    { id: 'created', header: 'Criado em', hideBelow: 'md', sortValue: (o) => o.createdAt, cell: (o) => <span className="tabular text-sm">{formatDate(o.createdAt)}</span> },
    {
      id: 'expected',
      header: 'Entrega prevista',
      hideBelow: 'sm',
      sortValue: (o) => o.expectedAt,
      cell: (o) => (
        <span className={cn('tabular text-sm', isLate(o) && 'font-medium text-low')}>
          {formatDate(o.expectedAt)}
          {isLate(o) && <span className="ml-1 text-xs">(atrasado)</span>}
        </span>
      ),
    },
    { id: 'items', header: 'Itens', align: 'right', hideBelow: 'lg', sortValue: (o) => o.items.length, cell: (o) => <span className="tabular">{o.items.length}</span> },
    { id: 'total', header: 'Total', align: 'right', sortValue: (o) => orderTotal(o), cell: (o) => <span className="tabular font-medium">{formatCurrency(orderTotal(o))}</span> },
    {
      id: 'progress',
      header: 'Recebido',
      hideBelow: 'lg',
      sortValue: (o) => o.items.reduce((s, i) => s + i.receivedQuantity, 0) / o.items.reduce((s, i) => s + i.quantity, 0),
      cell: (o) => {
        const pct = Math.round((o.items.reduce((s, i) => s + i.receivedQuantity, 0) / o.items.reduce((s, i) => s + i.quantity, 0)) * 100)
        return (
          <div className="flex w-28 items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-ok' : 'bg-primary')} style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular text-xs text-muted-foreground">{pct}%</span>
          </div>
        )
      },
    },
    { id: 'status', header: 'Status', sortValue: (o) => PURCHASE_ORDER_STATUSES.indexOf(o.status), cell: (o) => <OrderStatusBadge status={o.status} /> },
  ]

  const viewing = viewingId ? (data.purchaseOrders.find((o) => o.id === viewingId) ?? null) : null
  const openValue = data.purchaseOrders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status)).reduce((s, o) => s + orderTotal(o), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos de compra"
        description={`${formatNumber(counts.open ?? 0)} pedido(s) em aberto somando ${formatCurrency(openValue)}.`}
        actions={
          <Button onClick={() => setForm({ open: true, order: null })}>
            <Plus /> Novo pedido
          </Button>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por status">
        {(['all', 'open', ...PURCHASE_ORDER_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              status === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            {s === 'all' ? 'Todos' : s === 'open' ? 'Em aberto' : ORDER_STATUS_LABEL[s]}
            <span className={cn('tabular rounded-full px-1.5 text-xs', status === s ? 'bg-white/20' : 'bg-muted text-muted-foreground')}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por número ou fornecedor" className="sm:max-w-sm sm:flex-1" />
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="sm:w-64" aria-label="Filtrar por fornecedor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {data.suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(o) => o.id}
          initialSort={{ id: 'created', direction: 'desc' }}
          onRowClick={(o) => setViewing(o.id)}
          resetKey={`${search}|${status}|${supplierFilter}`}
          caption="Pedidos de compra"
          empty={{
            icon: ClipboardList,
            title: 'Nenhum pedido encontrado',
            description: 'Altere os filtros ou crie um novo pedido de compra.',
            action: (
              <Button onClick={() => setForm({ open: true, order: null })}>
                <Plus /> Novo pedido
              </Button>
            ),
          }}
        />
      </Card>

      <OrderFormSheet
        open={form.open}
        order={form.order}
        defaultSupplierId={form.supplierId}
        defaultProductId={form.productId}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(id) => id && setViewing(id)}
      />
      <OrderDetailsSheet
        order={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(o) => {
          setViewing(null)
          setForm({ open: true, order: o })
        }}
        onReceive={setReceiving}
      />
      <ReceiveDialog order={receiving} onOpenChange={(o) => !o && setReceiving(null)} />
    </div>
  )
}
