/**
 * Abstração de armazenamento chave-valor.
 *
 * A interface isola a aplicação do mecanismo concreto (hoje, localStorage),
 * permitindo trocar por IndexedDB, uma API remota ou memória (testes) sem
 * alterar a camada de domínio ou a interface.
 */
export interface StorageAdapter {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}

export class StorageError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'StorageError'
    this.cause = cause
  }
}

/** Implementação em memória, útil para testes e como alternativa quando localStorage não está disponível. */
export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>()

  read(key: string): string | null {
    return this.store.get(key) ?? null
  }

  write(key: string, value: string): void {
    this.store.set(key, value)
  }

  remove(key: string): void {
    this.store.delete(key)
  }

  keys(): string[] {
    return [...this.store.keys()]
  }
}
