import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import InventoryPage from '@/features/inventory/inventory-page'
import { buildFixture, createTestContext } from '../helpers'
import { renderWithStore } from './render'

describe('registro de movimentações', () => {
  it('bloqueia saída acima do saldo e registra uma saída válida uma única vez', async () => {
    const user = userEvent.setup()
    const { ctx } = createTestContext(new Date(Date.now() - 3600_000))
    const { data, product } = buildFixture(ctx, 5)
    const { store } = renderWithStore(<InventoryPage />, data, `/estoque?novo=1&produto=${product.id}`)

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: 'Saída' }))
    await user.type(within(dialog).getByLabelText(/Quantidade/), '9')
    expect(await within(dialog).findByText(/Saldo insuficiente/)).toBeInTheDocument()
    const submit = within(dialog).getByRole('button', { name: /Registrar saída/ })
    expect(submit).toBeDisabled()

    await user.clear(within(dialog).getByLabelText(/Quantidade/))
    await user.type(within(dialog).getByLabelText(/Quantidade/), '2')
    await user.dblClick(submit)

    await waitFor(() => expect(store.getState().data.products[0]!.quantity).toBe(3))
    expect(store.getState().data.movements.filter((m) => m.type === 'out')).toHaveLength(1)
  })
})
