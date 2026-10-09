import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrate } from '@/infrastructure/storage/migrations'
import {
  AppDataRepository,
  CORRUPTED_KEY,
  STORAGE_KEY,
} from '@/infrastructure/storage/app-data.repository'
import { LocalStorageAdapter } from '@/infrastructure/storage/local-storage.adapter'
import { MemoryStorageAdapter, StorageError } from '@/infrastructure/storage/storage-adapter'
import { buildFixture, createTestContext } from '../helpers'

function fixtureData() {
  const { ctx } = createTestContext()
  return buildFixture(ctx, 4).data
}

/** Versão 1 do formato, anterior à introdução de operationId e sequências. */
function legacyV1() {
  const current = fixtureData()
  const { schemaVersion: _v, processedOperations: _p, sequences: _s, ...rest } = current
  const { expiryWarningDays: _e, responsibleName: _r, ...settings } = current.settings
  return {
    ...rest,
    version: 1,
    settings,
    movements: current.movements.map(({ operationId: _o, ...m }) => m),
  }
}

describe('repositório de dados locais', () => {
  it('gera dados iniciais quando o armazenamento está vazio', () => {
    const adapter = new MemoryStorageAdapter()
    const repo = new AppDataRepository(adapter, fixtureData)
    const res = repo.load()
    expect(res.status).toBe('seeded')
    expect(adapter.read(STORAGE_KEY)).not.toBeNull()
    expect(repo.load().status).toBe('loaded')
  })

  it('recupera de JSON inválido preservando uma cópia do conteúdo', () => {
    const adapter = new MemoryStorageAdapter()
    adapter.write(STORAGE_KEY, '{"schemaVersion": 2, products: [')
    const res = new AppDataRepository(adapter, fixtureData).load()
    expect(res.status).toBe('recovered')
    expect(res.message).toMatch(/JSON inválido/)
    expect(adapter.read(CORRUPTED_KEY)).toBe('{"schemaVersion": 2, products: [')
    expect(res.data.products).toHaveLength(1)
  })

  it('recupera de dados com estrutura inválida ou referências quebradas', () => {
    const adapter = new MemoryStorageAdapter()
    const broken = fixtureData()
    broken.products[0]!.categoryId = 'nao-existe'
    adapter.write(STORAGE_KEY, JSON.stringify(broken))
    expect(new AppDataRepository(adapter, fixtureData).load().status).toBe('recovered')

    adapter.write(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, products: 'x' }))
    expect(new AppDataRepository(adapter, fixtureData).load().status).toBe('recovered')
  })

  it('migra dados da versão 1 e grava no formato atual', () => {
    const adapter = new MemoryStorageAdapter()
    adapter.write(STORAGE_KEY, JSON.stringify(legacyV1()))
    const res = new AppDataRepository(adapter, fixtureData).load()
    expect(res.status).toBe('migrated')
    expect(res.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(res.data.movements[0]!.operationId).toBe(res.data.movements[0]!.id)
    expect(res.data.settings.expiryWarningDays).toBe(30)
    expect(JSON.parse(adapter.read(STORAGE_KEY)!).schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('rejeita versões futuras ou ausentes', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(/mais nova/)
    expect(() => migrate({ products: [] })).toThrow(/ausente/)
    expect(() => migrate('texto')).toThrow()
  })

  it('não grava estado inválido', () => {
    const adapter = new MemoryStorageAdapter()
    const repo = new AppDataRepository(adapter, fixtureData)
    const bad = { ...fixtureData(), products: [{ id: 'x' }] } as never
    expect(() => repo.save(bad)).toThrow(StorageError)
    expect(adapter.read(STORAGE_KEY)).toBeNull()
  })

  it('converte falhas do localStorage (ex.: cota) em StorageError', () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError')
      },
      removeItem: () => undefined,
    } as unknown as Storage
    const adapter = new LocalStorageAdapter(failing)
    expect(() => adapter.write('k', 'v')).toThrow(/cheio/)
  })

  it('usa o localStorage real sob a chave stockwise:v1', () => {
    const repo = new AppDataRepository(new LocalStorageAdapter(window.localStorage), fixtureData)
    repo.load()
    expect(window.localStorage.getItem('stockwise:v1')).toContain('"schemaVersion":2')
  })
})
