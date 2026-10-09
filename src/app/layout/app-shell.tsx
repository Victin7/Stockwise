import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useThemeSync } from '@/hooks/use-theme'
import { Header } from './header'
import { Sidebar } from './sidebar'

function PageFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando página">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

export function AppShell() {
  const theme = useThemeSync()
  const location = useLocation()
  return (
    <div className="flex min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header effectiveTheme={theme} />
        <main id="conteudo" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageFallback />}>
            <div key={location.pathname} className="animate-in fade-in-0 duration-300">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
