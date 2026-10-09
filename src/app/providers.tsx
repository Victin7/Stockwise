import { type ReactNode, useEffect } from 'react'
import { toast, Toaster } from 'sonner'
import type { StoreApi } from 'zustand'
import { TooltipProvider } from '@/components/ui/tooltip'
import { STORAGE_KEY } from '@/infrastructure/storage/app-data.repository'
import { type AppStore, StoreProvider } from './store'

/** Avisos de carregamento (migração, recuperação) e sincronização entre abas. */
function StoreEffects({ store }: { store: StoreApi<AppStore> }) {
  useEffect(() => {
    const { loadMessage, loadStatus, persistent, dismissLoadMessage } = store.getState()
    if (loadMessage) {
      if (loadStatus === 'recovered') toast.warning(loadMessage, { duration: 10000 })
      else toast.info(loadMessage)
      dismissLoadMessage()
    }
    if (!persistent) {
      toast.warning('O armazenamento local está indisponível neste navegador. As alterações serão perdidas ao recarregar a página.', { duration: 10000 })
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        store.getState().reload()
        toast.info('Os dados foram alterados em outra aba e foram recarregados.')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [store])
  return null
}

export function AppProviders({ store, children }: { store: StoreApi<AppStore>; children: ReactNode }) {
  return (
    <StoreProvider store={store}>
      <TooltipProvider delayDuration={250}>
        <StoreEffects store={store} />
        {children}
        <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
      </TooltipProvider>
    </StoreProvider>
  )
}
