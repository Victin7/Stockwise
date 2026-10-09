import { zodResolver } from '@hookform/resolvers/zod'
import { addDays } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppData } from '@/app/store'
import { FormField } from '@/components/shared/form-field'
import { ProductPicker } from '@/components/shared/product-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import type { PurchaseOrder } from '@/domain/entities'
import { createOrder, type OrderInput, updateOrder } from '@/domain/services/purchase-orders.service'
import { useAction } from '@/hooks/use-action'
import { centsToInput, moneyField, parseMoney, positiveIntegerField } from '@/lib/form'
import { formatCurrency, toDayString } from '@/lib/format'

const MONEY_RE = /^\d{1,9}([.,]\d{1,2})?$/

const schema = z
  .object({
    supplierId: z.string().min(1, 'Selecione um fornecedor'),
    expectedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data prevista'),
    notes: z.string().max(500, 'Máximo de 500 caracteres'),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, 'Selecione o produto'),
          quantity: positiveIntegerField('Quantidade inválida'),
          unitCost: moneyField,
        }),
      )
      .min(1, 'Adicione pelo menos um item'),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    v.items.forEach((item, i) => {
      if (item.productId && seen.has(item.productId)) {
        ctx.addIssue({ code: 'custom', path: ['items', i, 'productId'], message: 'Produto repetido no pedido' })
      }
      seen.add(item.productId)
    })
  })

type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: PurchaseOrder | null
  defaultSupplierId?: string
  defaultProductId?: string
  onSaved?: (orderId: string) => void
}

function lineTotal(qty: string, cost: string): number {
  if (!/^\d+$/.test(qty) || !MONEY_RE.test(cost.trim())) return 0
  return Number(qty) * parseMoney(cost)
}

export function OrderFormSheet({ open, onOpenChange, order, defaultSupplierId, defaultProductId, onSaved }: Props) {
  const data = useAppData()
  const run = useAction()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { supplierId: '', expectedAt: '', notes: '', items: [] } })
  const { register, control, handleSubmit, reset, setValue, getValues, formState } = form
  const { errors } = formState
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  useEffect(() => {
    if (!open) return
    if (order) {
      reset({
        supplierId: order.supplierId,
        expectedAt: order.expectedAt,
        notes: order.notes,
        items: order.items.map((i) => ({ productId: i.productId, quantity: String(i.quantity), unitCost: centsToInput(i.unitCost) })),
      })
    } else {
      const product = defaultProductId ? data.products.find((p) => p.id === defaultProductId) : undefined
      const supplierId = defaultSupplierId ?? product?.supplierId ?? ''
      reset({
        supplierId,
        expectedAt: toDayString(addDays(new Date(), 7)),
        notes: '',
        items: product
          ? [{ productId: product.id, quantity: String(Math.max(1, (product.maxStock ?? product.minStock * 2) - product.quantity)), unitCost: centsToInput(product.unitCost) }]
          : [{ productId: '', quantity: '', unitCost: '' }],
      })
    }
  }, [open, order, reset, defaultSupplierId, defaultProductId, data.products])

  const [items, supplierId] = useWatch({ control, name: ['items', 'supplierId'] })
  const total = (items ?? []).reduce((s, i) => s + lineTotal(i.quantity, i.unitCost), 0)
  const products = data.products.filter((p) => p.active)
  // Produtos do fornecedor selecionado aparecem primeiro
  const sortedProducts = [...products].sort((a, b) => Number(b.supplierId === supplierId) - Number(a.supplierId === supplierId) || a.name.localeCompare(b.name, 'pt-BR'))
  const selectedIds = (items ?? []).map((i) => i.productId).filter(Boolean)

  const save = (submit: boolean) =>
    handleSubmit((v) => {
      const input: OrderInput = {
        supplierId: v.supplierId,
        expectedAt: v.expectedAt,
        notes: v.notes,
        items: v.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: parseMoney(i.unitCost) })),
      }
      let savedId = order?.id ?? ''
      const ok = order
        ? run((d, ctx) => updateOrder(d, order.id, input, ctx), 'Pedido atualizado.')
        : run((d, ctx) => {
            const res = createOrder(d, input, ctx, { submit })
            savedId = res.order.id
            return res.data
          }, submit ? 'Pedido criado e enviado para aprovação.' : 'Rascunho salvo.')
      if (ok) {
        onOpenChange(false)
        onSaved?.(savedId)
      }
    })

  const suppliers = data.suppliers.filter((s) => s.active || s.id === order?.supplierId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{order ? `Editar ${order.number}` : 'Novo pedido de compra'}</SheetTitle>
          <SheetDescription>O estoque só muda quando os itens forem efetivamente recebidos.</SheetDescription>
        </SheetHeader>
        <form onSubmit={save(false)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetBody className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Fornecedor" htmlFor="po-supplier" required error={errors.supplierId?.message}>
                <Controller
                  control={control}
                  name="supplierId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="po-supplier" aria-invalid={!!errors.supplierId}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Entrega prevista" htmlFor="po-expected" required error={errors.expectedAt?.message}>
                <Input id="po-expected" type="date" {...register('expectedAt')} aria-invalid={!!errors.expectedAt} />
              </FormField>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Itens</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: '', unitCost: '' })}>
                  <Plus /> Adicionar item
                </Button>
              </div>
              {errors.items?.root?.message || errors.items?.message ? (
                <p className="text-xs text-destructive" role="alert">{errors.items?.root?.message ?? errors.items?.message}</p>
              ) : null}
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const e = errors.items?.[index]
                  const item = items?.[index]
                  return (
                    <div key={field.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_96px_120px_110px_auto] sm:items-start">
                      <FormField label="Produto" htmlFor={`po-item-${index}`} error={e?.productId?.message}>
                        <Controller
                          control={control}
                          name={`items.${index}.productId`}
                          render={({ field: f }) => (
                            <ProductPicker
                              id={`po-item-${index}`}
                              products={sortedProducts}
                              value={f.value}
                              disabledIds={selectedIds}
                              invalid={!!e?.productId}
                              onChange={(pid) => {
                                f.onChange(pid)
                                const p = data.products.find((x) => x.id === pid)
                                if (p && !getValues(`items.${index}.unitCost`)) setValue(`items.${index}.unitCost`, centsToInput(p.unitCost))
                              }}
                            />
                          )}
                        />
                      </FormField>
                      <FormField label="Qtd." htmlFor={`po-qty-${index}`} error={e?.quantity?.message}>
                        <Input id={`po-qty-${index}`} inputMode="numeric" {...register(`items.${index}.quantity`)} aria-invalid={!!e?.quantity} className="tabular" />
                      </FormField>
                      <FormField label="Custo unit. (R$)" htmlFor={`po-cost-${index}`} error={e?.unitCost?.message}>
                        <Input id={`po-cost-${index}`} inputMode="decimal" {...register(`items.${index}.unitCost`)} aria-invalid={!!e?.unitCost} className="tabular" />
                      </FormField>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">Subtotal</span>
                        <span className="tabular flex h-9 items-center text-sm font-semibold">{formatCurrency(item ? lineTotal(item.quantity, item.unitCost) : 0)}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="sm:mt-6" onClick={() => remove(index)} disabled={fields.length === 1} aria-label="Remover item">
                        <Trash2 />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-end gap-3 border-t pt-3">
                <span className="text-sm text-muted-foreground">Total do pedido</span>
                <span className="tabular font-display text-xl font-semibold">{formatCurrency(total)}</span>
              </div>
            </section>

            <FormField label="Observações" htmlFor="po-notes" error={errors.notes?.message}>
              <Textarea id="po-notes" rows={2} {...register('notes')} />
            </FormField>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {order ? (
              <Button type="submit">Salvar alterações</Button>
            ) : (
              <>
                <Button type="submit" variant="outline">
                  Salvar rascunho
                </Button>
                <Button type="button" onClick={save(true)}>
                  Enviar para aprovação
                </Button>
              </>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
