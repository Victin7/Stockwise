import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppData } from '@/app/store'
import { FormField } from '@/components/shared/form-field'
import { ProductPicker } from '@/components/shared/product-picker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MOVEMENT_TYPES, type MovementType } from '@/domain/entities'
import { MOVEMENT_REASONS, MOVEMENT_TYPE_LABEL } from '@/domain/labels'
import { applyMovementToBalance, getStockStatus } from '@/domain/rules'
import { registerMovement } from '@/domain/services/inventory.service'
import { StockStatusBadge } from '@/components/shared/stock'
import { useAction } from '@/hooks/use-action'
import { positiveIntegerField } from '@/lib/form'
import { formatNumber } from '@/lib/format'
import { createId } from '@/lib/id'
import { cn } from '@/lib/utils'

const schema = z.object({
  productId: z.string().min(1, 'Selecione um produto'),
  type: z.enum(MOVEMENT_TYPES),
  quantity: positiveIntegerField('Informe uma quantidade inteira maior que zero'),
  reason: z.string().trim().min(2, 'Informe o motivo').max(80),
  responsible: z.string().trim().min(2, 'Informe o responsável').max(80),
  occurredAt: z
    .string()
    .min(1, 'Informe a data e hora')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida')
    .refine((v) => new Date(v).getTime() <= Date.now() + 60_000, 'A data não pode estar no futuro'),
  notes: z.string().max(500),
})

type Values = z.infer<typeof schema>

interface MovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProductId?: string
  defaultType?: MovementType
}

const nowLocal = () => format(new Date(), "yyyy-MM-dd'T'HH:mm")

export function MovementDialog({ open, onOpenChange, defaultProductId, defaultType = 'in' }: MovementDialogProps) {
  const data = useAppData()
  const run = useAction()
  const submitting = useRef(false)
  const operationId = useMemo(() => (open ? createId() : ''), [open])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { productId: '', type: defaultType, quantity: '', reason: '', responsible: '', occurredAt: nowLocal(), notes: '' },
  })
  const { register, control, handleSubmit, reset, setValue, setError, formState } = form
  const { errors } = formState

  useEffect(() => {
    if (open) {
      submitting.current = false
      reset({
        productId: defaultProductId ?? '',
        type: defaultType,
        quantity: '',
        reason: MOVEMENT_REASONS[defaultType][0] ?? '',
        responsible: data.settings.responsibleName,
        occurredAt: nowLocal(),
        notes: '',
      })
    }
  }, [open, defaultProductId, defaultType, reset, data.settings.responsibleName])

  const [productId, type, quantityText] = useWatch({ control, name: ['productId', 'type', 'quantity'] })
  const product = data.products.find((p) => p.id === productId)
  const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : 0
  const after = product ? applyMovementToBalance(product.quantity, type, quantity) : null
  const insufficient = product !== undefined && after !== null && after < 0

  const onSubmit = handleSubmit((values) => {
    if (submitting.current) return
    if (insufficient && product) {
      setError('quantity', { message: `Saldo insuficiente: disponível ${product.quantity} ${product.unit}` })
      return
    }
    submitting.current = true
    const ok = run(
      (d, ctx) =>
        registerMovement(
          d,
          {
            operationId,
            productId: values.productId,
            type: values.type,
            quantity: Number(values.quantity),
            reason: values.reason,
            responsible: values.responsible,
            notes: values.notes,
            occurredAt: new Date(values.occurredAt).toISOString(),
          },
          ctx,
        ).data,
      `${MOVEMENT_TYPE_LABEL[values.type]} registrada.`,
    )
    if (ok) onOpenChange(false)
    else submitting.current = false
  })

  const selectable = data.products.filter((p) => p.active || p.id === defaultProductId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar movimentação</DialogTitle>
          <DialogDescription>O saldo do produto é atualizado ao salvar e a movimentação fica no histórico.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Tipo de movimentação">
            {MOVEMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => {
                  setValue('type', t)
                  setValue('reason', MOVEMENT_REASONS[t][0] ?? '')
                }}
                className={cn(
                  'h-9 rounded-md border text-sm font-medium transition-colors',
                  type === t ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-card hover:bg-muted',
                )}
              >
                {MOVEMENT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <FormField label="Produto" htmlFor="mv-product" required error={errors.productId?.message}>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <ProductPicker id="mv-product" products={selectable} value={field.value} onChange={field.onChange} invalid={!!errors.productId} />
              )}
            />
          </FormField>

          {product && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Saldo</span>
                <span className="tabular font-semibold">{formatNumber(product.quantity)}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className={cn('tabular font-semibold', insufficient && 'text-out')}>
                  {after !== null ? formatNumber(after) : '—'}
                </span>
                <span className="text-muted-foreground">{product.unit}</span>
              </div>
              {after !== null && after >= 0 && (
                <StockStatusBadge status={getStockStatus({ ...product, quantity: after })} />
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Quantidade" htmlFor="mv-qty" required error={errors.quantity?.message ?? (insufficient ? `Saldo insuficiente: disponível ${product?.quantity}` : undefined)}>
              <Input id="mv-qty" inputMode="numeric" autoComplete="off" {...register('quantity')} aria-invalid={!!errors.quantity || insufficient} className="tabular" />
            </FormField>
            <FormField label="Data e hora" htmlFor="mv-date" required error={errors.occurredAt?.message}>
              <Input id="mv-date" type="datetime-local" max={nowLocal()} {...register('occurredAt')} aria-invalid={!!errors.occurredAt} />
            </FormField>
            <FormField label="Motivo" htmlFor="mv-reason" required error={errors.reason?.message}>
              <Input id="mv-reason" list="mv-reasons" {...register('reason')} aria-invalid={!!errors.reason} />
              <datalist id="mv-reasons">
                {MOVEMENT_REASONS[type].map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Responsável" htmlFor="mv-resp" required error={errors.responsible?.message}>
              <Input id="mv-resp" {...register('responsible')} aria-invalid={!!errors.responsible} />
            </FormField>
          </div>
          <FormField label="Observações" htmlFor="mv-notes" error={errors.notes?.message}>
            <Textarea id="mv-notes" rows={2} {...register('notes')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={insufficient}>
              Registrar {MOVEMENT_TYPE_LABEL[type].toLowerCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
