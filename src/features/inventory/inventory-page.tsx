import { endOfDay, parseISO, startOfDay, subDays } from 'date-fns'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus, Scale, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppData } from '@/app/store'
import { type Column, DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { ProductPicker } from '@/components/shared/product-picker'
import { StatCard } from '@/components/shared/stat-card'
import { MovementTypeBadge } from '@/components/shared/status-badges'
import { CodeTag } from '@/components/shared/stock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MOVEMENT_TYPES, type StockMovement } from '@/domain/entities'
import { MOVEMENT_TYPE_LABEL } from '@/domain/labels'
import { movementSign } from '@/domain/rules'
import { useOpenFromQuery } from '@/hooks/use-open-from-query'
import { formatDateTime, formatNumber, toDayString } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MovementDialog } from './movement-dialog'

export default function InventoryPage() {
  const data = useAppData()
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState<{ open: boolean; productId?: string }>({ open: false })
  const [detail, setDetail] = useState<StockMovement | null>(null)

  const from = params.get('de') ?? toDayString(subDays(new Date(), 29))
  const to = params.get('ate') ?? toDayString(new Date())
  const productId = params.get('produto') ?? ''
  const type = params.get('tipo') ?? 'all'
  const reason = params.get('motivo') ?? 'all'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const openNew = useCallback((p: URLSearchParams) => setDialog({ open: true, productId: p.get('produto') ?? undefined }), [])
  useOpenFromQuery(openNew)

  const productById = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products])
  const orderById = useMemo(() => new Map(data.purchaseOrders.map((o) => [o.id, o])), [data.purchaseOrders])
  const reasons = useMemo(() => [...new Set(data.movements.map((m) => m.reason))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [data.movements])

  const rows = useMemo(() => {
    const start = from ? startOfDay(parseISO(from)).getTime() : -Infinity
    const end = to ? endOfDay(parseISO(to)).getTime() : Infinity
    return data.movements.filter((m) => {
      const t = new Date(m.occurredAt).getTime()
      if (t < start || t > end) return false
      if (productId && m.productId !== productId) return false
      if (type !== 'all' && m.type !== type) return false
      if (reason !== 'all' && m.reason !== reason) return false
      return true
    })
  }, [data.movements, from, to, productId, type, reason])

  const totals = useMemo(() => {
    const sum = (t: string) => rows.filter((m) => m.type === t).reduce((s, m) => s + m.quantity, 0)
    return { in: sum('in'), out: sum('out'), adjIn: sum('adjust_in'), adjOut: sum('adjust_out') }
  }, [rows])

  const invalidRange = from && to && from > to
  const hasFilters = params.has('de') || params.has('ate') || productId || type !== 'all' || reason !== 'all'

  const columns: Column<StockMovement>[] = [
    { id: 'date', header: 'Data', sortValue: (m) => m.occurredAt, cell: (m) => <span className="tabular text-sm whitespace-nowrap">{formatDateTime(m.occurredAt)}</span> },
    {
      id: 'product',
      header: 'Produto',
      sortValue: (m) => productById.get(m.productId)?.name ?? '',
      cell: (m) => {
        const p = productById.get(m.productId)
        return (
          <div className="min-w-40">
            <p className="font-medium">{p?.name ?? 'Produto removido'}</p>
            {p && <CodeTag className="mt-1">{p.sku}</CodeTag>}
          </div>
        )
      },
    },
    { id: 'type', header: 'Tipo', sortValue: (m) => m.type, cell: (m) => <MovementTypeBadge type={m.type} /> },
    {
      id: 'qty',
      header: 'Quantidade',
      align: 'right',
      sortValue: (m) => movementSign(m.type) * m.quantity,
      cell: (m) => (
        <span className={cn('tabular font-semibold', movementSign(m.type) > 0 ? 'text-ok' : 'text-out')}>
          {movementSign(m.type) > 0 ? '+' : '−'}
          {formatNumber(m.quantity)}
        </span>
      ),
    },
    { id: 'balance', header: 'Saldo após', align: 'right', hideBelow: 'sm', sortValue: (m) => m.balanceAfter, cell: (m) => <span className="tabular">{formatNumber(m.balanceAfter)}</span> },
    { id: 'reason', header: 'Motivo', hideBelow: 'md', sortValue: (m) => m.reason, cell: (m) => m.reason },
    { id: 'responsible', header: 'Responsável', hideBelow: 'lg', sortValue: (m) => m.responsible, cell: (m) => m.responsible },
    {
      id: 'order',
      header: 'Pedido',
      hideBelow: 'lg',
      cell: (m) => {
        const o = m.purchaseOrderId ? orderById.get(m.purchaseOrderId) : undefined
        return o ? (
          <Link to={`/pedidos?ver=${o.id}`} className="font-mono text-xs text-primary hover:underline">
            {o.number}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
  ]

  const detailProduct = detail ? productById.get(detail.productId) : undefined
  const detailOrder = detail?.purchaseOrderId ? orderById.get(detail.purchaseOrderId) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque e movimentações"
        description="Todo saldo é resultado de movimentações: entradas, saídas e ajustes ficam registrados e não podem ser apagados."
        actions={
          <Button onClick={() => setDialog({ open: true, productId: productId || undefined })}>
            <Plus /> Nova movimentação
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Entradas no filtro" value={formatNumber(totals.in)} hint="unidades" icon={ArrowDownLeft} tone="ok" />
        <StatCard label="Saídas no filtro" value={formatNumber(totals.out)} hint="unidades" icon={ArrowUpRight} tone="out" />
        <StatCard label="Ajustes" value={`+${formatNumber(totals.adjIn)} / −${formatNumber(totals.adjOut)}`} hint="positivos / negativos" icon={Scale} tone="info" />
        <StatCard label="Lançamentos" value={formatNumber(rows.length)} hint={`de ${formatNumber(data.movements.length)} no histórico`} icon={ArrowLeftRight} />
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-[150px_150px_minmax(200px,1fr)_180px_200px_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="f-from" className="text-xs text-muted-foreground">De</Label>
            <Input id="f-from" type="date" value={from} max={to || undefined} onChange={(e) => setParam('de', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-to" className="text-xs text-muted-foreground">Até</Label>
            <Input id="f-to" type="date" value={to} min={from || undefined} onChange={(e) => setParam('ate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-product" className="text-xs text-muted-foreground">Produto</Label>
            <div className="flex gap-1">
              <ProductPicker id="f-product" products={data.products} value={productId} onChange={(v) => setParam('produto', v)} placeholder="Todos os produtos" />
              {productId && (
                <Button variant="ghost" size="icon" onClick={() => setParam('produto', '')} aria-label="Limpar filtro de produto">
                  <X />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={type} onValueChange={(v) => setParam('tipo', v)}>
              <SelectTrigger aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Motivo</Label>
            <Select value={reason} onValueChange={(v) => setParam('motivo', v)}>
              <SelectTrigger aria-label="Filtrar por motivo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os motivos</SelectItem>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
              Limpar filtros
            </Button>
          )}
        </div>
        {invalidRange ? (
          <p className="p-6 text-center text-sm text-destructive" role="alert">
            A data inicial é posterior à data final. Ajuste o período.
          </p>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(m) => m.id}
            initialSort={{ id: 'date', direction: 'desc' }}
            onRowClick={setDetail}
            resetKey={`${from}|${to}|${productId}|${type}|${reason}`}
            caption="Movimentações de estoque"
            empty={{
              icon: ArrowLeftRight,
              title: 'Nenhuma movimentação no filtro',
              description: 'Amplie o período ou remova filtros. Para lançar uma entrada ou saída, use “Nova movimentação”.',
            }}
          />
        )}
      </Card>

      <MovementDialog open={dialog.open} defaultProductId={dialog.productId} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{MOVEMENT_TYPE_LABEL[detail.type]} de {formatNumber(detail.quantity)} {detailProduct?.unit}</DialogTitle>
                <DialogDescription>{formatDateTime(detail.occurredAt)}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Produto</dt>
                  <dd>
                    {detailProduct ? (
                      <Link to={`/produtos?ver=${detailProduct.id}`} className="text-primary hover:underline">
                        {detailProduct.name} ({detailProduct.sku})
                      </Link>
                    ) : (
                      'Produto removido'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Saldo após</dt>
                  <dd className="tabular">{formatNumber(detail.balanceAfter)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Motivo</dt>
                  <dd>{detail.reason}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Responsável</dt>
                  <dd>{detail.responsible}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Pedido de compra</dt>
                  <dd>{detailOrder ? detailOrder.number : 'Não vinculado'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Observações</dt>
                  <dd>{detail.notes || 'Sem observações.'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Identificador da operação</dt>
                  <dd className="font-mono text-xs break-all text-muted-foreground">{detail.operationId}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Movimentações não podem ser editadas ou excluídas. Para corrigir um lançamento, registre um ajuste.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
