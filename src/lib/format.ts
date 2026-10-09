import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const numberFormatter = new Intl.NumberFormat('pt-BR')

/** Formata um valor em centavos como moeda (BRL). */
export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

export function formatCurrencyCompact(cents: number): string {
  return compactCurrency.format(cents / 100)
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Converte reais (número com até 2 casas) para centavos inteiros. */
export function toCents(reais: number): number {
  return Math.round(reais * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value
}

export function formatDate(value: string | Date): string {
  return format(toDate(value), 'dd/MM/yyyy')
}

export function formatDateTime(value: string | Date): string {
  return format(toDate(value), "dd/MM/yyyy 'às' HH:mm")
}

export function formatShortDate(value: string | Date): string {
  return format(toDate(value), 'dd MMM', { locale: ptBR })
}

export function formatRelative(value: string | Date): string {
  return formatDistanceToNow(toDate(value), { addSuffix: true, locale: ptBR })
}

/** Data local no formato yyyy-MM-dd (para inputs type=date). */
export function toDayString(value: Date): string {
  return format(value, 'yyyy-MM-dd')
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}
