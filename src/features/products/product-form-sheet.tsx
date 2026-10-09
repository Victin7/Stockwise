import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useAppData } from '@/app/store'
import { FormField } from '@/components/shared/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type Product, UNITS } from '@/domain/entities'
import { UNIT_LABEL } from '@/domain/labels'
import { normalizeSku } from '@/domain/rules'
import { createProduct, type ProductInput, updateProduct } from '@/domain/services/products.service'
import { useAction } from '@/hooks/use-action'
import { centsToInput, parseMoney, parseOptionalInt, parseOptionalMoney } from '@/lib/form'
import { createId } from '@/lib/id'
import { type ProductFormValues, productFormSchema } from './product-form.schema'

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Produto em edição; ausente para cadastro. */
  product?: Product | null
}

const NONE = 'none'

function toValues(product: Product | null | undefined, defaultMin: number): ProductFormValues {
  return {
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? '',
    unit: product?.unit ?? 'un',
    unitCost: product ? centsToInput(product.unitCost) : '',
    salePrice: centsToInput(product?.salePrice ?? null),
    initialQuantity: '0',
    minStock: String(product?.minStock ?? defaultMin),
    maxStock: product?.maxStock != null ? String(product.maxStock) : '',
    supplierId: product?.supplierId ?? NONE,
    location: product?.location ?? '',
    barcode: product?.barcode ?? '',
    expiryDate: product?.expiryDate ?? '',
    active: product?.active ?? true,
  }
}

export function ProductFormSheet({ open, onOpenChange, product }: ProductFormSheetProps) {
  const data = useAppData()
  const run = useAction()
  const editing = Boolean(product)
  const defaults = useMemo(
    () => toValues(product, data.settings.defaultLowStockThreshold),
    [product, data.settings.defaultLowStockThreshold],
  )
  // Um ID de operação por abertura do formulário evita lançamentos duplicados em reenvios.
  const operationId = useMemo(() => (open ? createId() : ''), [open])

  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: defaults })
  const { register, handleSubmit, control, reset, setError, formState } = form
  const { errors, isSubmitting } = formState

  useEffect(() => {
    if (open) reset(defaults)
  }, [open, defaults, reset])

  const onSubmit = handleSubmit((values) => {
    const sku = normalizeSku(values.sku)
    if (data.products.some((p) => p.id !== product?.id && normalizeSku(p.sku) === sku)) {
      setError('sku', { message: `O SKU ${sku} já está em uso` })
      return
    }
    if (values.barcode && data.products.some((p) => p.id !== product?.id && p.barcode === values.barcode)) {
      setError('barcode', { message: 'Código de barras já cadastrado em outro produto' })
      return
    }
    const input: ProductInput = {
      sku,
      name: values.name,
      description: values.description,
      categoryId: values.categoryId,
      unit: values.unit,
      unitCost: parseMoney(values.unitCost),
      salePrice: parseOptionalMoney(values.salePrice),
      minStock: Number(values.minStock),
      maxStock: parseOptionalInt(values.maxStock),
      supplierId: values.supplierId === NONE ? null : values.supplierId,
      location: values.location,
      barcode: values.barcode || null,
      expiryDate: values.expiryDate || null,
      active: values.active,
    }
    const ok = product
      ? run((d, ctx) => updateProduct(d, product.id, input, ctx), 'Produto atualizado.')
      : run(
          (d, ctx) =>
            createProduct(
              d,
              { ...input, initialQuantity: Number(values.initialQuantity), operationId, responsible: d.settings.responsibleName },
              ctx,
            ).data,
          'Produto cadastrado.',
        )
    if (ok) onOpenChange(false)
  })

  const activeSuppliers = data.suppliers.filter((s) => s.active || s.id === product?.supplierId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{editing ? 'Editar produto' : 'Novo produto'}</SheetTitle>
          <SheetDescription>
            {editing
              ? 'O saldo não é editado aqui: use uma movimentação de estoque para alterá-lo.'
              : 'Campos marcados com * são obrigatórios.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetBody className="space-y-6">
            <fieldset className="grid gap-4 sm:grid-cols-6">
              <legend className="mb-3 text-sm font-semibold">Identificação</legend>
              <FormField label="SKU" htmlFor="sku" required error={errors.sku?.message} className="sm:col-span-2">
                <Input id="sku" {...register('sku')} aria-invalid={!!errors.sku} className="font-mono uppercase" placeholder="PAP-0005" />
              </FormField>
              <FormField label="Nome" htmlFor="name" required error={errors.name?.message} className="sm:col-span-4">
                <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              </FormField>
              <FormField label="Descrição" htmlFor="description" error={errors.description?.message} className="sm:col-span-6">
                <Textarea id="description" rows={2} {...register('description')} />
              </FormField>
              <FormField label="Categoria" htmlFor="categoryId" required error={errors.categoryId?.message} className="sm:col-span-3">
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="categoryId" aria-invalid={!!errors.categoryId}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="size-2 rounded-full" style={{ background: c.color }} />
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Unidade de medida" htmlFor="unit" required className="sm:col-span-3">
                <Controller
                  control={control}
                  name="unit"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {UNIT_LABEL[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Código de barras" htmlFor="barcode" error={errors.barcode?.message} className="sm:col-span-3">
                <Input id="barcode" inputMode="numeric" {...register('barcode')} aria-invalid={!!errors.barcode} className="font-mono" />
              </FormField>
              <FormField label="Fornecedor principal" htmlFor="supplierId" className="sm:col-span-3">
                <Controller
                  control={control}
                  name="supplierId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="supplierId">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem fornecedor</SelectItem>
                        {activeSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-6">
              <legend className="mb-3 text-sm font-semibold">Valores</legend>
              <FormField label="Custo unitário (R$)" htmlFor="unitCost" required error={errors.unitCost?.message} className="sm:col-span-3">
                <Input id="unitCost" inputMode="decimal" placeholder="0,00" {...register('unitCost')} aria-invalid={!!errors.unitCost} className="tabular" />
              </FormField>
              <FormField label="Preço de venda (R$)" htmlFor="salePrice" error={errors.salePrice?.message} hint="Opcional" className="sm:col-span-3">
                <Input id="salePrice" inputMode="decimal" placeholder="0,00" {...register('salePrice')} aria-invalid={!!errors.salePrice} className="tabular" />
              </FormField>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-6">
              <legend className="mb-3 text-sm font-semibold">Estoque</legend>
              {!editing && (
                <FormField
                  label="Saldo inicial"
                  htmlFor="initialQuantity"
                  error={errors.initialQuantity?.message}
                  hint="Gera uma entrada “Saldo inicial”"
                  className="sm:col-span-2"
                >
                  <Input id="initialQuantity" inputMode="numeric" {...register('initialQuantity')} aria-invalid={!!errors.initialQuantity} className="tabular" />
                </FormField>
              )}
              <FormField label="Estoque mínimo" htmlFor="minStock" required error={errors.minStock?.message} className="sm:col-span-2">
                <Input id="minStock" inputMode="numeric" {...register('minStock')} aria-invalid={!!errors.minStock} className="tabular" />
              </FormField>
              <FormField label="Estoque máximo" htmlFor="maxStock" error={errors.maxStock?.message} hint="Opcional" className="sm:col-span-2">
                <Input id="maxStock" inputMode="numeric" {...register('maxStock')} aria-invalid={!!errors.maxStock} className="tabular" />
              </FormField>
              <FormField label="Localização" htmlFor="location" error={errors.location?.message} hint="Corredor-prateleira-nível" className="sm:col-span-3">
                <Input id="location" {...register('location')} placeholder="A-01-02" className="font-mono uppercase" />
              </FormField>
              <FormField label="Validade" htmlFor="expiryDate" hint="Quando aplicável" className="sm:col-span-3">
                <Input id="expiryDate" type="date" {...register('expiryDate')} />
              </FormField>
            </fieldset>

            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <span>
                    <span className="block text-sm font-medium">Produto ativo</span>
                    <span className="block text-xs text-muted-foreground">Produtos inativos não aceitam saídas nem novos pedidos.</span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editing ? 'Salvar alterações' : 'Cadastrar produto'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
