import { z } from 'zod'
import { UNITS } from '@/domain/entities'
import { integerField, moneyField, optionalIntegerField, optionalMoneyField } from '@/lib/form'

export const productFormSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, 'Informe o SKU')
      .max(32, 'Máximo de 32 caracteres')
      .regex(/^[A-Za-z0-9._-]+$/, 'Use letras, números, ponto, hífen ou sublinhado'),
    name: z.string().trim().min(2, 'Informe o nome do produto').max(120, 'Máximo de 120 caracteres'),
    description: z.string().max(500, 'Máximo de 500 caracteres'),
    categoryId: z.string().min(1, 'Selecione uma categoria'),
    unit: z.enum(UNITS),
    unitCost: moneyField,
    salePrice: optionalMoneyField,
    initialQuantity: integerField(),
    minStock: integerField(),
    maxStock: optionalIntegerField,
    supplierId: z.string(),
    location: z.string().trim().max(40, 'Máximo de 40 caracteres'),
    barcode: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{8,14}$/.test(v), 'Use de 8 a 14 dígitos'),
    expiryDate: z.string(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.maxStock !== '' && Number(v.maxStock) < Number(v.minStock)) {
      ctx.addIssue({ code: 'custom', path: ['maxStock'], message: 'O máximo não pode ser menor que o mínimo' })
    }
    if (v.maxStock !== '' && Number(v.maxStock) === 0) {
      ctx.addIssue({ code: 'custom', path: ['maxStock'], message: 'Deixe vazio ou use um valor maior que zero' })
    }
  })

export type ProductFormValues = z.infer<typeof productFormSchema>
