/**
 * Migrações do formato dos dados persistidos.
 *
 * Cada migração recebe o objeto na versão N e devolve o objeto na versão N + 1.
 * Ao alterar a estrutura de AppData, incremente CURRENT_SCHEMA_VERSION e
 * adicione a migração correspondente — nunca altere migrações já publicadas.
 */

export const CURRENT_SCHEMA_VERSION = 2

type RawData = Record<string, unknown>
type Migration = (input: RawData) => RawData

function isRecord(value: unknown): value is RawData {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const migrations: Record<number, Migration> = {
  /**
   * v1 → v2
   * - campo `version` passa a se chamar `schemaVersion`
   * - movimentações ganham `operationId` (proteção contra duplicidade)
   * - novos campos: `processedOperations`, `sequences`,
   *   `settings.expiryWarningDays` e `settings.responsibleName`
   */
  1: (input) => {
    const { version: _version, ...rest } = input
    const movements = Array.isArray(rest.movements) ? rest.movements : []
    const orders = Array.isArray(rest.purchaseOrders) ? rest.purchaseOrders : []
    const settings = isRecord(rest.settings) ? rest.settings : {}
    return {
      ...rest,
      schemaVersion: 2,
      movements: movements.map((m) =>
        isRecord(m) && typeof m.operationId !== 'string' ? { ...m, operationId: m.id } : m,
      ),
      processedOperations: [],
      sequences: { purchaseOrder: orders.length },
      settings: {
        expiryWarningDays: 30,
        responsibleName: 'Usuário demonstração',
        ...settings,
      },
    }
  },
}

export function readSchemaVersion(raw: unknown): number | null {
  if (!isRecord(raw)) return null
  const v = raw.schemaVersion ?? raw.version
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

/** Aplica as migrações necessárias até a versão atual. */
export function migrate(raw: unknown): { data: RawData; from: number; migrated: boolean } {
  if (!isRecord(raw)) throw new MigrationError('Formato de dados não reconhecido.')
  const from = readSchemaVersion(raw)
  if (from === null) throw new MigrationError('Versão dos dados ausente ou inválida.')
  if (from > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `Os dados estão na versão ${from}, mais nova que a suportada (${CURRENT_SCHEMA_VERSION}).`,
    )
  }
  let data = raw
  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v]
    if (!step) throw new MigrationError(`Migração da versão ${v} não encontrada.`)
    data = step(data)
  }
  return { data, from, migrated: from !== CURRENT_SCHEMA_VERSION }
}
