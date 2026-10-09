import { MemoryStorageAdapter, type StorageAdapter, StorageError } from './storage-adapter'

/**
 * Adaptador sobre window.localStorage com tratamento de falhas
 * (modo privado, cota excedida, acesso bloqueado).
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly storage: Storage

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
  }

  read(key: string): string | null {
    try {
      return this.storage.getItem(key)
    } catch (error) {
      throw new StorageError('Não foi possível ler o armazenamento local.', error)
    }
  }

  write(key: string, value: string): void {
    try {
      this.storage.setItem(key, value)
    } catch (error) {
      const quota = error instanceof DOMException && /quota/i.test(error.name)
      throw new StorageError(
        quota
          ? 'O armazenamento local está cheio. Exporte um backup e limpe dados antigos.'
          : 'Não foi possível gravar no armazenamento local.',
        error,
      )
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(key)
    } catch (error) {
      throw new StorageError('Não foi possível remover dados do armazenamento local.', error)
    }
  }
}

/** Retorna o adaptador de localStorage ou, se indisponível, um adaptador em memória. */
export function createBrowserStorage(): { adapter: StorageAdapter; persistent: boolean } {
  try {
    const probe = '__stockwise_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return { adapter: new LocalStorageAdapter(), persistent: true }
  } catch {
    return { adapter: new MemoryStorageAdapter(), persistent: false }
  }
}
