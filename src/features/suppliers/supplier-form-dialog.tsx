import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppData } from '@/app/store'
import { FormField } from '@/components/shared/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Supplier } from '@/domain/entities'
import { createSupplier, updateSupplier } from '@/domain/services/suppliers.service'
import { useAction } from '@/hooks/use-action'

const schema = z.object({
  companyName: z.string().trim().min(2, 'Informe o nome empresarial').max(120),
  contactName: z.string().trim().max(80),
  email: z.union([z.literal(''), z.email('E-mail inválido')]),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\(\d{2}\) \d{4,5}-\d{4}$/.test(v), 'Use o formato (11) 99999-9999'),
  cnpj: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v), 'Use o formato 00.000.000/0000-00'),
  address: z.string().trim().max(200),
  notes: z.string().max(500),
  active: z.boolean(),
})
type Values = z.infer<typeof schema>

/** Máscaras simples de digitação. */
export function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function SupplierFormDialog({ open, onOpenChange, supplier }: { open: boolean; onOpenChange: (o: boolean) => void; supplier: Supplier | null }) {
  const data = useAppData()
  const run = useAction()
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const { register, handleSubmit, control, reset, setError, formState } = form
  const { errors } = formState

  useEffect(() => {
    if (open) {
      reset({
        companyName: supplier?.companyName ?? '',
        contactName: supplier?.contactName ?? '',
        email: supplier?.email ?? '',
        phone: supplier?.phone ?? '',
        cnpj: supplier?.cnpj ?? '',
        address: supplier?.address ?? '',
        notes: supplier?.notes ?? '',
        active: supplier?.active ?? true,
      })
    }
  }, [open, supplier, reset])

  const onSubmit = handleSubmit((v) => {
    if (v.cnpj && data.suppliers.some((s) => s.id !== supplier?.id && s.cnpj === v.cnpj)) {
      setError('cnpj', { message: 'CNPJ já cadastrado em outro fornecedor' })
      return
    }
    const input = { ...v, cnpj: v.cnpj || null }
    const ok = supplier
      ? run((d, ctx) => updateSupplier(d, supplier.id, input, ctx), 'Fornecedor atualizado.')
      : run((d, ctx) => createSupplier(d, input, ctx).data, 'Fornecedor cadastrado.')
    if (ok) onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
          <DialogDescription>Use apenas dados fictícios neste ambiente de demonstração.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Nome empresarial" htmlFor="s-name" required error={errors.companyName?.message} className="sm:col-span-2">
            <Input id="s-name" {...register('companyName')} aria-invalid={!!errors.companyName} />
          </FormField>
          <FormField label="Nome do contato" htmlFor="s-contact" error={errors.contactName?.message}>
            <Input id="s-contact" {...register('contactName')} />
          </FormField>
          <FormField label="CNPJ" htmlFor="s-cnpj" error={errors.cnpj?.message} hint="Opcional">
            <Controller
              control={control}
              name="cnpj"
              render={({ field }) => (
                <Input id="s-cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" value={field.value ?? ''} onChange={(e) => field.onChange(maskCnpj(e.target.value))} onBlur={field.onBlur} aria-invalid={!!errors.cnpj} className="font-mono" />
              )}
            />
          </FormField>
          <FormField label="E-mail" htmlFor="s-email" error={errors.email?.message}>
            <Input id="s-email" type="email" {...register('email')} aria-invalid={!!errors.email} />
          </FormField>
          <FormField label="Telefone" htmlFor="s-phone" error={errors.phone?.message}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input id="s-phone" inputMode="tel" placeholder="(11) 99999-9999" value={field.value ?? ''} onChange={(e) => field.onChange(maskPhone(e.target.value))} onBlur={field.onBlur} aria-invalid={!!errors.phone} />
              )}
            />
          </FormField>
          <FormField label="Endereço" htmlFor="s-address" error={errors.address?.message} className="sm:col-span-2">
            <Input id="s-address" {...register('address')} />
          </FormField>
          <FormField label="Observações" htmlFor="s-notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea id="s-notes" rows={2} {...register('notes')} />
          </FormField>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
                <span>
                  <span className="block text-sm font-medium">Fornecedor ativo</span>
                  <span className="block text-xs text-muted-foreground">Fornecedores inativos não recebem novos pedidos.</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{supplier ? 'Salvar alterações' : 'Cadastrar fornecedor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
