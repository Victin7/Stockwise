import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/router'
import { createAppStore } from '@/app/store'
import { AppDataRepository } from '@/infrastructure/storage/app-data.repository'
import { createBrowserStorage } from '@/infrastructure/storage/local-storage.adapter'
import { buildSeedData } from '@/infrastructure/storage/seed'

const { adapter, persistent } = createBrowserStorage()
const store = createAppStore({
  repository: new AppDataRepository(adapter, () => buildSeedData(new Date())),
  persistent,
})
const router = createAppRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
