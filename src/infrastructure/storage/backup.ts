import type { AppData } from '@/domain/entities'
import { parseAppData } from './app-data.repository'

export const BACKUP_FORMAT = 'stockwise-backup'

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT
  exportedAt: string
  data: AppData
}

export interface BackupSummary {
  products: number
  categories: number
  suppliers: number
  movements: number
  purchaseOrders: number
  activity: number
  exportedAt: string | null
  migratedFrom: number | null
}

export type BackupParseResult =
  | { ok: true; data: AppData; summary: BackupSummary }
  | { ok: false; error: string }

export function exportBackup(data: AppData, now: Date = new Date()): string {
  const envelope: BackupEnvelope = { format: BACKUP_FORMAT, exportedAt: now.toISOString(), data }
  return JSON.stringify(envelope, null, 2)
}

/**
 * Lê e valida um backup JSON. Aceita o envelope gerado por {@link exportBackup}
 * ou o objeto de dados puro. Nada é gravado aqui — a confirmação e a
 * substituição dos dados ficam a cargo de quem chama.
 */
export function parseBackup(text: string): BackupParseResult {
  if (text.length > 5_000_000) return { ok: false, error: 'Arquivo muito grande para um backup do StockWise.' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' }
  }
  let exportedAt: string | null = null
  let payload: unknown = raw
  if (typeof raw === 'object' && raw !== null && 'format' in raw) {
    const envelope = raw as Partial<BackupEnvelope>
    if (envelope.format !== BACKUP_FORMAT) return { ok: false, error: 'Formato de backup não reconhecido.' }
    exportedAt = typeof envelope.exportedAt === 'string' ? envelope.exportedAt : null
    payload = envelope.data
  }
  const result = parseAppData(payload)
  if (!result.ok) return { ok: false, error: `Backup inválido: ${result.error}` }
  const d = result.data
  return {
    ok: true,
    data: d,
    summary: {
      products: d.products.length,
      categories: d.categories.length,
      suppliers: d.suppliers.length,
      movements: d.movements.length,
      purchaseOrders: d.purchaseOrders.length,
      activity: d.activity.length,
      exportedAt,
      migratedFrom: result.migratedFrom,
    },
  }
}
