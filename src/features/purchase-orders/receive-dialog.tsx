import { format } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PurchaseOrder } from '@/domain/entities'
import { remainingToReceive } from '@/domain/rules'
import { receiveOrder } from '@/domain/services/purchase-orders.service'
import { useAction } from '@/hooks/use-action'
import { formatNumber } from '@/lib/format'
import { createId } from '@/lib/id'
import { cn } from '@/lib/utils'

interface Props {
  order: PurchaseOrder | null
  onOpenChange: (open: boolean) => void
}

/** Registro de recebimento total ou parcial dos itens de um pedido aprovado. */
export function ReceiveDialog({ order, onOpenChange }: Props) {
  const data = useAppData()
  const run = useAction()
  const open = Boolean(order)
  const operationId = useMemo(() => (open ? createId() : ''), [open])
  const submitting = useRef(false)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [responsible, setResponsible] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (order) {
      submitting.current = false
      setQuantities(Object.fromEntries(order.items.map((i) => [i.id, String(remainingToReceive(i))])))
      setResponsible(data.settings.responsibleName)
      setOccurredAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
      setNotes('')
    }
  }, [order, data.settings.responsibleName])

  if (!order) return null

  const lines = order.items.map((item) => {
    const raw = quantities[item.id] ?? '0'
    const remaining = remainingToReceive(item)
    const valid = /^\d+$/.test(raw.trim())
    const qty = valid ? Number(raw) : NaN
    const error = !valid ? 'Use um inteiro' : qty > remaining ? `Máximo ${remaining}` : null
    return { item, remaining, qty, error, product: data.products.find((p) => p.id === item.productId) }
  })
  const hasErrors = lines.some((l) => l.error)
  const totalUnits = lines.reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0), 0)
  const dateInvalid = !occurredAt || Number.isNaN(Date.parse(occurredAt)) || new Date(occurredAt).getTime() > Date.now() + 60_000

  const submit = () => {
    if (submitting.current || hasErrors || totalUnits === 0 || dateInvalid || !responsible.trim()) return
    submitting.current = true
    const ok = run(
      (d, ctx) =>
        receiveOrder(
          d,
          order.id,
          {
            operationId,
            responsible,
            notes: notes.trim() || undefined,
            occurredAt: new Date(occurredAt).toISOString(),
            lines: lines.filter((l) => l.qty > 0).map((l) => ({ itemId: l.item.id, quantity: l.qty })),
          },
          ctx,
        ),
      'Recebimento registrado e estoque atualizado.',
    )
    if (ok) onOpenChange(false)
    else submitting.current = false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar recebimento de {order.number}</DialogTitle>
          <DialogDescription>
            Informe o que chegou. Cada item recebido gera uma entrada no estoque; o restante continua pendente.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Produto</th>
                <th className="px-3 py-2 text-right font-medium">Pedido</th>
                <th className="px-3 py-2 text-right font-medium">Já recebido</th>
                <th className="px-3 py-2 text-right font-medium">Recebendo agora</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ item, remaining, error, product }) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium">{product?.name ?? 'Produto removido'}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{product?.sku}</p>
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatNumber(item.quantity)}</td>
                  <td className="tabular px-3 py-2 text-right">{formatNumber(item.receivedQuantity)}</td>
                  <td className="px-3 py-2">
                    <div className="ml-auto flex w-28 flex-col items-end gap-1">
                      <Input
                        aria-label={`Quantidade recebida de ${product?.name}`}
                        inputMode="numeric"
                        value={quantities[item.id] ?? ''}
                        disabled={remaining === 0}
                        onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                        aria-invalid={!!error}
                        className={cn('tabular h-8 text-right')}
                      />
                      {remaining === 0 ? (
                        <span className="text-[11px] text-ok">Concluído</span>
                      ) : error ? (
                        <span className="text-[11px] text-destructive">{error}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">restam {remaining}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setQuantities(Object.fromEntries(order.items.map((i) => [i.id, String(remainingToReceive(i))])))}>
            Receber tudo o que falta
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setQuantities(Object.fromEntries(order.items.map((i) => [i.id, '0'])))}>
            Zerar quantidades
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="rc-resp">Responsável</Label>
            <Input id="rc-resp" value={responsible} onChange={(e) => setResponsible(e.target.value)} aria-invalid={!responsible.trim()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-date">Data do recebimento</Label>
            <Input id="rc-date" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} aria-invalid={dateInvalid} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-notes">Observações</Label>
            <Input id="rc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: NF 1234" />
          </div>
        </div>
        <DialogFooter className="items-center">
          <p className="mr-auto text-sm text-muted-foreground">
            {totalUnits > 0 ? `${formatNumber(totalUnits)} unidade(s) entrarão no estoque.` : 'Informe ao menos uma quantidade.'}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={hasErrors || totalUnits === 0 || dateInvalid || !responsible.trim()}>
            Confirmar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
