import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { AppProviders } from '@/app/providers'
import { createAppStore } from '@/app/store'
import type { AppData } from '@/domain/entities'
import { AppDataRepository } from '@/infrastructure/storage/app-data.repository'
import { MemoryStorageAdapter } from '@/infrastructure/storage/storage-adapter'

export function renderWithStore(ui: ReactNode, data: AppData, route = '/') {
  const store = createAppStore({ repository: new AppDataRepository(new MemoryStorageAdapter(), () => structuredClone(data)) })
  const result = render(
    <AppProviders store={store}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AppProviders>,
  )
  return { ...result, store }
}
