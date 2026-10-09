import { ArrowLeftRight, Pencil, Power } from 'lucide-react'
import { Link } from 'react-router'
import { useAppData } from '@/app/store'
import { CodeTag, StockGauge, StockStatusBadge } from '@/components/shared/stock'
import { ActiveBadge, MovementTypeBadge, OrderStatusBadge } from '@/components/shared/status-badges'
import { Button } from '@/components/ui/button'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Product } from '@/domain/entities'
import { UNIT_LABEL } from '@/domain/labels'
import { daysUntilExpiry, getStockStatus, movementSign, stockValue } from '@/domain/rules'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  product: Product | null
  onOpenChange: (open: boolean) => void
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
}

function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  )
}

export function ProductDetailsSheet({ product, onOpenChange, onEdit, onToggleActive }: Props) {
  const data = useAppData()
  // Usa a versão mais recente do produto (pode ter mudado após edição)
  const current = product ? (data.products.find((p) => p.id === product.id) ?? null) : null
  const category = current ? data.categories.find((c) => c.id === current.categoryId) : undefined
  const supplier = current?.supplierId ? data.suppliers.find((s) => s.id === current.supplierId) : undefined
  const movements = current
    ? data.movements.filter((m) => m.productId === current.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8)
    : []
  const orders = current ? data.purchaseOrders.filter((o) => o.items.some((i) => i.productId === current.id)).slice(0, 5) : []
  const expiryDays = current ? daysUntilExpiry(current, new Date()) : null

  return (
    <Sheet open={Boolean(current)} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        {current && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CodeTag>{current.sku}</CodeTag>
                <StockStatusBadge status={getStockStatus(current)} />
                <ActiveBadge active={current.active} />
              </div>
              <SheetTitle className="mt-1">{current.name}</SheetTitle>
              <SheetDescription>{current.description || 'Sem descrição.'}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <div className="rounded-xl border bg-muted/30 p-4">
                <StockGauge product={current} />
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor em estoque</p>
                    <p className="tabular font-semibold">{formatCurrency(stockValue(current))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo unitário</p>
                    <p className="tabular font-semibold">{formatCurrency(current.unitCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preço de venda</p>
                    <p className="tabular font-semibold">{current.salePrice !== null ? formatCurrency(current.salePrice) : 'Não definido'}</p>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Detail label="Categoria">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: category?.color }} />
                    {category?.name ?? '—'}
                  </span>
                </Detail>
                <Detail label="Unidade">{UNIT_LABEL[current.unit]}</Detail>
                <Detail label="Localização">{current.location ? <CodeTag>{current.location}</CodeTag> : 'Não informada'}</Detail>
                <Detail label="Código de barras">{current.barcode ? <span className="font-mono">{current.barcode}</span> : 'Não informado'}</Detail>
                <Detail label="Estoque mínimo / máximo">
                  <span className="tabular">
                    {formatNumber(current.minStock)} / {current.maxStock !== null ? formatNumber(current.maxStock) : 'sem limite'}
                  </span>
                </Detail>
                <Detail label="Validade">
                  {current.expiryDate ? (
                    <span className={cn(expiryDays !== null && expiryDays <= data.settings.expiryWarningDays && 'font-medium text-low', expiryDays !== null && expiryDays < 0 && 'text-out')}>
                      {formatDate(current.expiryDate)}
                      {expiryDays !== null && (expiryDays < 0 ? ' (vencido)' : ` (${expiryDays} dias)`)}
                    </span>
                  ) : (
                    'Não se aplica'
                  )}
                </Detail>
                <Detail label="Fornecedor principal" className="col-span-2">
                  {supplier ? (
                    <Link to={`/fornecedores?ver=${supplier.id}`} className="text-primary hover:underline">
                      {supplier.companyName}
                    </Link>
                  ) : (
                    'Nenhum'
                  )}
                </Detail>
                <Detail label="Cadastrado em">{formatDateTime(current.createdAt)}</Detail>
                <Detail label="Última atualização">{formatDateTime(current.updatedAt)}</Detail>
              </dl>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Últimas movimentações</h3>
                  <Link to={`/estoque?produto=${current.id}`} className="text-xs text-primary hover:underline">
                    Ver todas
                  </Link>
                </div>
                {movements.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {movements.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <MovementTypeBadge type={m.type} />
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {formatDateTime(m.occurredAt)}, {m.reason}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn('tabular font-semibold', movementSign(m.type) > 0 ? 'text-ok' : 'text-out')}>
                            {movementSign(m.type) > 0 ? '+' : '−'}
                            {formatNumber(m.quantity)}
                          </p>
                          <p className="tabular text-xs text-muted-foreground">saldo {formatNumber(m.balanceAfter)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {orders.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Pedidos de compra</h3>
                  <ul className="divide-y rounded-lg border">
                    {orders.map((o) => {
                      const item = o.items.find((i) => i.productId === current.id)!
                      return (
                        <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <Link to={`/pedidos?ver=${o.id}`} className="font-mono text-xs text-primary hover:underline">
                            {o.number}
                          </Link>
                          <span className="tabular text-xs text-muted-foreground">
                            {item.receivedQuantity}/{item.quantity} recebidos
                          </span>
                          <OrderStatusBadge status={o.status} />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
            </SheetBody>
            <SheetFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => onToggleActive(current)}>
                <Power />
                {current.active ? 'Inativar' : 'Ativar'}
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" asChild>
                  <Link to={`/estoque?novo=1&produto=${current.id}`}>
                    <ArrowLeftRight /> Registrar movimentação
                  </Link>
                </Button>
                <Button onClick={() => onEdit(current)}>
                  <Pencil /> Editar
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
