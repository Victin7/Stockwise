import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DashboardPage from '@/features/dashboard/dashboard-page'
import { buildFixture, createTestContext } from '../helpers'
import { renderWithStore } from './render'

describe('dashboard', () => {
  it('exibe indicadores calculados a partir dos dados', async () => {
    const { ctx } = createTestContext(new Date(Date.now() - 3600_000))
    const { data } = buildFixture(ctx, 7) // 7 × R$ 10,00
    renderWithStore(<DashboardPage />, data)
    const card = (await screen.findByText('Valor estimado')).closest('a')!
    expect(card).toHaveTextContent('R$ 70,00')
    expect(screen.getByText('Unidades em estoque').parentElement!.parentElement).toHaveTextContent('7')
  })
})
