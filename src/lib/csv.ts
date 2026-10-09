export interface CsvColumn<T> {
  key: keyof T & string
  label: string
}

/** Escapa um valor conforme RFC 4180 (aspas, vírgulas e quebras de linha). */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/**
 * Gera CSV em UTF-8 com BOM (para abrir corretamente acentuação no Excel),
 * separador vírgula e quebras de linha CRLF.
 */
export function toCsv<T extends Record<string, unknown>>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(','))
  return `﻿${[header, ...body].join('\r\n')}`
}

/** Dispara o download de um arquivo no navegador. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
