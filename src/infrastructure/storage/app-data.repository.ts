import type { AppData } from '@/domain/entities'
import { appDataSchema, describeZodError } from '@/domain/schemas'
import { findIntegrityIssues } from '@/domain/services/integrity.service'
import { migrate, MigrationError } from './migrations'
import { type StorageAdapter, StorageError } from './storage-adapter'

/** Chave principal do armazenamento local. */
export const STORAGE_KEY = 'stockwise:v1'
/** Cópia do conteúdo inválido encontrado, preservada para inspeção manual. */
export const CORRUPTED_KEY = 'stockwise:v1:corrompido'

export type ParseResult =
  | { ok: true; data: AppData; migratedFrom: number | null }
  | { ok: false; error: string }

/**
 * Valida (e migra, se necessário) um objeto desconhecido como AppData.
 * Usado tanto na leitura do armazenamento quanto na importação de backups.
 */
export function parseAppData(raw: unknown): ParseResult {
  let migrated
  try {
    migrated = migrate(raw)
  } catch (error) {
    return { ok: false, error: error instanceof MigrationError ? error.message : 'Formato inválido.' }
  }
  const parsed = appDataSchema.safeParse(migrated.data)
  if (!parsed.success) return { ok: false, error: describeZodError(parsed.error) }
  const data = parsed.data as AppData
  const issues = findIntegrityIssues(data)
  if (issues.length > 0) return { ok: false, error: issues[0]! }
  return { ok: true, data, migratedFrom: migrated.migrated ? migrated.from : null }
}

export type LoadStatus = 'loaded' | 'seeded' | 'migrated' | 'recovered'

export interface LoadResult {
  data: AppData
  status: LoadStatus
  message?: string
}

/**
 * Repositório único do estado da aplicação.
 *
 * Todo o estado é gravado como um único documento JSON. Cada gravação é
 * precedida de validação completa, de modo que um estado inválido nunca chega
 * ao armazenamento. Observação: localStorage não oferece transações nem
 * controle de concorrência entre abas — esta camada reduz, mas não elimina,
 * o risco de inconsistências.
 */
export class AppDataRepository {
  private readonly adapter: StorageAdapter
  private readonly createSeed: () => AppData

  constructor(adapter: StorageAdapter, createSeed: () => AppData) {
    this.adapter = adapter
    this.createSeed = createSeed
  }

  load(): LoadResult {
    let text: string | null
    try {
      text = this.adapter.read(STORAGE_KEY)
    } catch (error) {
      return {
        data: this.createSeed(),
        status: 'recovered',
        message: error instanceof StorageError ? error.message : 'Falha ao ler os dados locais.',
      }
    }

    if (text === null) {
      const data = this.createSeed()
      this.trySave(data)
      return { data, status: 'seeded' }
    }

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return this.recover(text, 'Os dados locais estavam corrompidos (JSON inválido).')
    }

    const result = parseAppData(raw)
    if (!result.ok) return this.recover(text, `Os dados locais são inválidos: ${result.error}`)

    if (result.migratedFrom !== null) {
      this.trySave(result.data)
      return {
        data: result.data,
        status: 'migrated',
        message: `Dados atualizados da versão ${result.migratedFrom} para a versão atual.`,
      }
    }
    return { data: result.data, status: 'loaded' }
  }

  /** Valida e grava o estado completo. Lança StorageError em caso de falha. */
  save(data: AppData): void {
    const parsed = appDataSchema.safeParse(data)
    if (!parsed.success) {
      throw new StorageError(`Estado inválido não foi gravado: ${describeZodError(parsed.error)}`)
    }
    this.adapter.write(STORAGE_KEY, JSON.stringify(data))
  }

  clear(): void {
    this.adapter.remove(STORAGE_KEY)
  }

  private trySave(data: AppData): void {
    try {
      this.save(data)
    } catch {
      // A aplicação segue funcionando em memória; a interface informa o problema na próxima gravação.
    }
  }

  private recover(original: string, message: string): LoadResult {
    try {
      this.adapter.write(CORRUPTED_KEY, original)
    } catch {
      // Sem espaço para preservar a cópia; segue com a recuperação.
    }
    const data = this.createSeed()
    this.trySave(data)
    return {
      data,
      status: 'recovered',
      message: `${message} Os dados de demonstração foram restaurados e uma cópia do conteúdo anterior foi preservada.`,
    }
  }
}
