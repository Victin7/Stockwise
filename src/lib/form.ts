import { z } from 'zod'

/** Helpers de validação para campos de formulário (valores digitados como texto). */

const MONEY_RE = /^\d{1,9}([.,]\d{1,2})?$/

export const moneyField = z
  .string()
  .trim()
  .min(1, 'Informe o valor')
  .refine((v) => MONEY_RE.test(v), 'Valor inválido: use números com até 2 casas decimais')

export const optionalMoneyField = z
  .string()
  .trim()
  .refine((v) => v === '' || MONEY_RE.test(v), 'Valor inválido: use números com até 2 casas decimais')

export const integerField = (message = 'Use um número inteiro maior ou igual a zero') =>
  z.string().trim().regex(/^\d{1,7}$/, message)

export const positiveIntegerField = (message = 'Use um número inteiro maior que zero') =>
  z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, message)
    .refine((v) => Number(v) > 0, message)

export const optionalIntegerField = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{1,7}$/.test(v), 'Use um número inteiro')

/** "12,50" → 1250 centavos. */
export function parseMoney(value: string): number {
  return Math.round(Number(value.trim().replace(',', '.')) * 100)
}

export function parseOptionalMoney(value: string): number | null {
  return value.trim() === '' ? null : parseMoney(value)
}

export function parseOptionalInt(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

/** 1250 → "12,50" para preencher formulários. */
export function centsToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}
