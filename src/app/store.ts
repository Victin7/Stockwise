import { createContext, createElement, type ReactNode, useContext } from 'react'
import { createStore, type StoreApi, useStore } from 'zustand'
import type { AppData, Settings } from '@/domain/entities'
import { type DomainContext, defaultContext, logActivity } from '@/domain/services/context'
import { AppDataRepository, type LoadStatus } from '@/infrastructure/storage/app-data.repository'
import { buildSeedData, createEmptyData } from '@/infrastructure/storage/seed'

export type Mutator = (data: AppData, ctx: DomainContext) => AppData

export interface AppStore {
  data: AppData
  loadStatus: LoadStatus
  loadMessage: string | null
  persistent: boolean
  /**
   * Aplica uma operação de domínio. A operação valida todas as regras e
   * devolve um novo estado; só então ele é gravado e publicado. Se a operação
   * ou a gravação falhar, o estado anterior é mantido e o erro é propagado.
   */
  execute: (mutator: Mutator) => void
  /** Substitui todo o estado (importação/restauração), já validado. */
  replaceAll: (data: AppData) => void
  restoreDemo: () => void
  clearAll: () => void
  /** Relê o armazenamento (ex.: alteração feita em outra aba). */
  reload: () => void
  dismissLoadMessage: () => void
}

export interface CreateStoreOptions {
  repository: AppDataRepository
  persistent?: boolean
  ctx?: DomainContext
}

export function createAppStore({ repository, persistent = true, ctx = defaultContext }: CreateStoreOptions): StoreApi<AppStore> {
  const initial = repository.load()
  return createStore<AppStore>()((set, get) => ({
    data: initial.data,
    loadStatus: initial.status,
    loadMessage: initial.message ?? null,
    persistent,
    execute: (mutator) => {
      const current = get().data
      const next = mutator(current, ctx)
      if (next === current) return
      repository.save(next)
      set({ data: next })
    },
    replaceAll: (data) => {
      repository.save(data)
      set({ data })
    },
    restoreDemo: () => {
      const settings: Settings = get().data.settings
      const seeded = buildSeedData(ctx.now())
      const data = logActivity({ ...seeded, settings }, ctx, {
        action: 'reset',
        entity: 'system',
        entityId: null,
        summary: 'Dados de demonstração restaurados.',
      })
      repository.save(data)
      set({ data })
    },
    clearAll: () => {
      const data = logActivity(createEmptyData(get().data.settings), ctx, {
        action: 'reset',
        entity: 'system',
        entityId: null,
        summary: 'Dados locais apagados. A aplicação foi reiniciada sem registros.',
      })
      repository.save(data)
      set({ data })
    },
    reload: () => {
      const result = repository.load()
      set({ data: result.data, loadStatus: result.status, loadMessage: result.message ?? null })
    },
    dismissLoadMessage: () => set({ loadMessage: null }),
  }))
}

const StoreContext = createContext<StoreApi<AppStore> | null>(null)

export function StoreProvider({ store, children }: { store: StoreApi<AppStore>; children: ReactNode }) {
  return createElement(StoreContext.Provider, { value: store }, children)
}

export function useStoreApi(): StoreApi<AppStore> {
  const store = useContext(StoreContext)
  if (!store) throw new Error('StoreProvider ausente na árvore de componentes.')
  return store
}

export function useAppStore<T>(selector: (state: AppStore) => T): T {
  return useStore(useStoreApi(), selector)
}

export const useAppData = () => useAppStore((s) => s.data)
export const useSettings = () => useAppStore((s) => s.data.settings)
