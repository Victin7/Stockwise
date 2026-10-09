import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ProductsPage from '@/features/products/products-page'
import { buildFixture, createTestContext } from '../helpers'
import { renderWithStore } from './render'

async function chooseCategory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: /Categoria/ }))
  await user.click(await screen.findByRole('option', { name: 'Geral' }))
}

describe('página de produtos', () => {
  it('lista produtos e cadastra um novo pelo formulário', async () => {
    const user = userEvent.setup()
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx, 10)
    const { store } = renderWithStore(<ProductsPage />, data, '/produtos')

    expect(await screen.findByText('Produto de teste')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Novo produto/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/SKU/), 'nov-1')
    await user.type(within(dialog).getByLabelText(/^Nome/), 'Grampo trilho')
    await chooseCategory(user)
    await user.type(within(dialog).getByLabelText(/Custo unitário/), '3,75')
    await user.clear(within(dialog).getByLabelText(/Saldo inicial/))
    await user.type(within(dialog).getByLabelText(/Saldo inicial/), '25')
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar produto' }))

    await waitFor(() => expect(store.getState().data.products).toHaveLength(2))
    const created = store.getState().data.products.find((p) => p.sku === 'NOV-1')!
    expect(created).toMatchObject({ name: 'Grampo trilho', unitCost: 375, quantity: 25 })
    expect(store.getState().data.movements.filter((m) => m.productId === created.id)).toHaveLength(1)
  })

  it('mostra erro no campo ao usar SKU duplicado e não grava', async () => {
    const user = userEvent.setup()
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx, 10)
    const { store } = renderWithStore(<ProductsPage />, data, '/produtos?novo=1')

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/SKU/), 'tst-0001')
    await user.type(within(dialog).getByLabelText(/^Nome/), 'Duplicado')
    await chooseCategory(user)
    await user.type(within(dialog).getByLabelText(/Custo unitário/), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar produto' }))

    expect(await within(dialog).findByText(/já está em uso/)).toBeInTheDocument()
    expect(store.getState().data.products).toHaveLength(1)
  })

  it('valida campos obrigatórios e valores monetários', async () => {
    const user = userEvent.setup()
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx)
    renderWithStore(<ProductsPage />, data, '/produtos?novo=1')
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Custo unitário/), '12,345')
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar produto' }))
    expect(await within(dialog).findByText('Informe o SKU')).toBeInTheDocument()
    expect(within(dialog).getByText('Selecione uma categoria')).toBeInTheDocument()
    expect(within(dialog).getByText(/até 2 casas decimais/)).toBeInTheDocument()
  })

  it('filtra pela busca', async () => {
    const user = userEvent.setup()
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx)
    renderWithStore(<ProductsPage />, data, '/produtos')
    await user.type(screen.getByRole('textbox', { name: /Buscar por nome/ }), 'inexistente')
    expect(await screen.findByText('Nenhum produto encontrado')).toBeInTheDocument()
  })
})
