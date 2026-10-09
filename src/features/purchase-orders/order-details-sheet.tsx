import { parseISO, startOfDay } from 'date-fns'
import { Ban, Check, PackageCheck, Pencil, Send, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAppData } from '@/app/store'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { OrderStatusBadge } from '@/components/shared/status-badges'
import { CodeTag } from '@/components/shared/stock'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import type { PurchaseOrder } from '@/domain/entities'
import { ORDER_STATUS_LABEL } from '@/domain/labels'
import {
  canTransition,
  EDITABLE_ORDER_STATUSES,
  itemTotal,
  OPEN_ORDER_STATUSES,
  orderReceivedTotal,
  orderTotal,
  RECEIVABLE_ORDER_STATUSES,
} from '@/domain/rules'
import { changeOrderStatus } from '@/domain/services/purchase-orders.service'
import { useAction } from '@/hooks/use-action'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  order: PurchaseOrder | null
  onOpenChange: (open: boolean) => void
  onEdit: (order: PurchaseOrder) => void
  onReceive: (order: PurchaseOrder) => void
}

export function OrderDetailsSheet({ order, onOpenChange, onEdit, onReceive }: Props) {
  const data = useAppData()
  const run = useAction()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const current = order ? (data.purchaseOrders.find((o) => o.id === order.id) ?? null) : null
  const supplier = current ? data.suppliers.find((s) => s.id === current.supplierId) : undefined
  const late = current && OPEN_ORDER_STATUSES.includes(current.status) && parseISO(current.expectedAt) < startOfDay(new Date())
  const movements = current ? data.movements.filter((m) => m.purchaseOrderId === current.id) : []

  const transition = (to: 'pending' | 'approved' | 'draft', message: string) =>
    current && run((d, ctx) => changeOrderStatus(d, current.id, to, ctx), message)

  return (
    <>
      <Sheet open={Boolean(current)} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl">
          {current && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={current.status} />
                  {late && <span className="text-xs font-medium text-low">Entrega atrasada</span>}
                </div>
                <SheetTitle className="mt-1 font-mono">{current.number}</SheetTitle>
                <SheetDescription>
                  {supplier ? (
                    <Link to={`/fornecedores?ver=${supplier.id}`} className="text-primary hover:underline">
                      {supplier.companyName}
                    </Link>
                  ) : (
                    'Fornecedor removido'
                  )}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Criado em</dt>
                    <dd>{formatDate(current.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Entrega prevista</dt>
                    <dd className={cn(late && 'font-medium text-low')}>{formatDate(current.expectedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor total</dt>
                    <dd className="tabular font-semibold">{formatCurrency(orderTotal(current))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor recebido</dt>
                    <dd className="tabular font-semibold">{formatCurrency(orderReceivedTotal(current))}</dd>
                  </div>
                </dl>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Itens ({current.items.length})</h3>
                  <ul className="divide-y rounded-lg border">
                    {current.items.map((item) => {
                      const product = data.products.find((p) => p.id === item.productId)
                      const pct = Math.round((item.receivedQuantity / item.quantity) * 100)
                      return (
                        <li key={item.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-3 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{product?.name ?? 'Produto removido'}</p>
                            <p className="text-xs text-muted-foreground">
                              {product && <CodeTag className="mr-1.5">{product.sku}</CodeTag>}
                              {formatNumber(item.quantity)} × {formatCurrency(item.unitCost)}
                            </p>
                          </div>
                          <p className="tabular text-right font-semibold">{formatCurrency(itemTotal(item))}</p>
                          <div className="col-span-2 flex items-center gap-3">
                            <div className="h-1.5 flex-1 rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Recebimento do item">
                              <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-ok' : 'bg-primary')} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="tabular text-xs text-muted-foreground">
                              {formatNumber(item.receivedQuantity)}/{formatNumber(item.quantity)} recebidos
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>

                {current.notes && (
                  <section>
                    <h3 className="mb-1 text-sm font-semibold">Observações</h3>
                    <p className="text-sm text-muted-foreground">{current.notes}</p>
                  </section>
                )}

                {movements.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Entradas geradas</h3>
                    <ul className="space-y-1 text-sm">
                      {movements.map((m) => (
                        <li key={m.id} className="flex justify-between gap-2 text-muted-foreground">
                          <span>
                            {formatDateTime(m.occurredAt)}, {data.products.find((p) => p.id === m.productId)?.name}
                          </span>
                          <span className="tabular font-medium text-ok">+{formatNumber(m.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section>
                  <h3 className="mb-3 text-sm font-semibold">Histórico do pedido</h3>
                  <ol className="relative space-y-4 border-l pl-5">
                    {[...current.history].reverse().map((h) => (
                      <li key={h.id} className="relative">
                        <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden="true" />
                        <p className="text-sm">{h.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(h.at)}, {ORDER_STATUS_LABEL[h.status]}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              </SheetBody>
              {(EDITABLE_ORDER_STATUSES.includes(current.status) || RECEIVABLE_ORDER_STATUSES.includes(current.status)) && (
                <SheetFooter className="flex-wrap sm:justify-between">
                  {canTransition(current.status, 'cancelled') && (
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setReason('')
                        setCancelling(true)
                      }}
                    >
                      <Ban /> Cancelar pedido
                    </Button>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    {EDITABLE_ORDER_STATUSES.includes(current.status) && (
                      <Button variant="outline" onClick={() => onEdit(current)}>
                        <Pencil /> Editar
                      </Button>
                    )}
                    {current.status === 'draft' && (
                      <Button onClick={() => transition('pending', 'Pedido enviado para aprovação.')}>
                        <Send /> Enviar para aprovação
                      </Button>
                    )}
                    {current.status === 'pending' && (
                      <>
                        <Button variant="outline" onClick={() => transition('draft', 'Pedido devolvido para rascunho.')}>
                          <Undo2 /> Devolver para rascunho
                        </Button>
                        <Button onClick={() => transition('approved', 'Pedido aprovado.')}>
                          <Check /> Aprovar
                        </Button>
                      </>
                    )}
                    {RECEIVABLE_ORDER_STATUSES.includes(current.status) && (
                      <Button onClick={() => onReceive(current)}>
                        <PackageCheck /> Registrar recebimento
                      </Button>
                    )}
                  </div>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
      {current && (
        <ConfirmDialog
          open={cancelling}
          onOpenChange={setCancelling}
          title={`Cancelar ${current.number}?`}
          description={
            current.status === 'partially_received'
              ? 'Os itens ainda não recebidos serão cancelados. As entradas já registradas continuam no estoque e no histórico.'
              : 'O pedido será cancelado e mantido no histórico. Esta ação não pode ser desfeita.'
          }
          confirmLabel="Cancelar pedido"
          destructive
          onConfirm={() => {
            run((d, ctx) => changeOrderStatus(d, current.id, 'cancelled', ctx, reason), 'Pedido cancelado.')
            setCancelling(false)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
        </ConfirmDialog>
      )}
    </>
  )
}
