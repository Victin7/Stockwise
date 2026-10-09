import { useCallback } from 'react'
import { toast } from 'sonner'
import { type Mutator, useStoreApi } from '@/app/store'
import { DomainError } from '@/domain/rules'
import { StorageError } from '@/infrastructure/storage/storage-adapter'

export function errorMessage(error: unknown): string {
  if (error instanceof DomainError || error instanceof StorageError) return error.message
  if (import.meta.env.DEV) console.error(error)
  return 'Erro inesperado. Nenhuma alteração foi gravada.'
}

/**
 * Executa uma operação de domínio e mostra o resultado em um toast.
 * Retorna `true` quando a operação foi aplicada e gravada.
 */
export function useAction() {
  const store = useStoreApi()
  return useCallback(
    (mutator: Mutator, successMessage?: string): boolean => {
      try {
        store.getState().execute(mutator)
        if (successMessage) toast.success(successMessage)
        return true
      } catch (error) {
        toast.error(errorMessage(error))
        return false
      }
    },
    [store],
  )
}
