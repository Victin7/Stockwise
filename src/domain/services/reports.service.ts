import { endOfDay, parseISO, startOfDay } from 'date-fns'
import type { AppData, StockMovement } from '@/domain/entities'
import { MOVEMENT_TYPE_LABEL, STOCK_STATUS_LABEL } from '@/domain/labels'
import { getStockStatus, orderReceivedTotal, orderTotal, stockValue } from '@/domain/rules'

export const REPORT_IDS = [
  'stock-position',
  'below-minimum',
  'out-of-stock',
  'stock-value',
  'flow-by-period',
  'movements-by-product',
  'purchases-by-supplier',
  'most-moved',
] as const
export type ReportId = (typeof REPORT_IDS)[number]

export type ColumnFormat = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'percent'

export interface ReportColumn {
  key: string
  label: string
  format: ColumnFormat
}

export type ReportRow = Record<string, string | number | null>

export interface ReportResult {
  columns: ReportColumn[]
  rows: ReportRow[]
  /** Linha de totais opcional. */
  totals?: ReportRow
}

export interface ReportFilters {
  from?: string
  to?: string
  categoryId?: string
  productId?: string
  supplierId?: string
}

export interface ReportDefinition {
  id: ReportId
  title: string
  description: string
  filters: (keyof ReportFilters)[]
}

export const REPORTS: ReportDefinition[] = [
  { id: 'stock-position', title: 'Posição atual do estoque', description: 'Saldo, situação e valor de cada produto ativo.', filters: ['categoryId', 'supplierId'] },
  { id: 'below-minimum', title: 'Abaixo do estoque mínimo', description: 'Produtos com saldo igual ou inferior ao mínimo e a quantidade sugerida de reposição.', filters: ['categoryId', 'supplierId'] },
  { id: 'out-of-stock', title: 'Produtos sem estoque', description: 'Itens ativos com saldo zerado e a data da última saída.', filters: ['categoryId', 'supplierId'] },
  { id: 'stock-value', title: 'Valor estimado do estoque', description: 'Valor de custo e de venda agrupado por categoria.', filters: ['categoryId'] },
  { id: 'flow-by-period', title: 'Entradas e saídas por período', description: 'Totais de entrada, saída e ajustes por produto no período.', filters: ['from', 'to', 'categoryId', 'productId'] },
  { id: 'movements-by-product', title: 'Movimentações por produto', description: 'Lançamentos detalhados, com saldo após cada movimentação.', filters: ['from', 'to', 'categoryId', 'productId'] },
  { id: 'purchases-by-supplier', title: 'Compras por fornecedor', description: 'Pedidos, valor comprado e valor já recebido por fornecedor.', filters: ['from', 'to', 'supplierId'] },
  { id: 'most-moved', title: 'Produtos mais movimentados', description: 'Ranking por volume total movimentado no período.', filters: ['from', 'to', 'categoryId'] },
]

function inRange(iso: string, filters: ReportFilters): boolean {
  const t = new Date(iso).getTime()
  if (filters.from && t < startOfDay(parseISO(filters.from)).getTime()) return false
  if (filters.to && t > endOfDay(parseISO(filters.to)).getTime()) return false
  return true
}

function filterMovements(data: AppData, f: ReportFilters): StockMovement[] {
  const productIds = new Set(
    data.products
      .filter((p) => (!f.categoryId || p.categoryId === f.categoryId) && (!f.productId || p.id === f.productId))
      .map((p) => p.id),
  )
  return data.movements.filter((m) => productIds.has(m.productId) && inRange(m.occurredAt, f))
}

export function buildReport(data: AppData, id: ReportId, f: ReportFilters): ReportResult {
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]))
  const supplierName = new Map(data.suppliers.map((s) => [s.id, s.companyName]))
  const productById = new Map(data.products.map((p) => [p.id, p]))
  const products = data.products.filter(
    (p) =>
      p.active &&
      (!f.categoryId || p.categoryId === f.categoryId) &&
      (!f.supplierId || p.supplierId === f.supplierId),
  )

  switch (id) {
    case 'stock-position': {
      const rows = products
        .map((p) => ({
          sku: p.sku,
          produto: p.name,
          categoria: categoryName.get(p.categoryId) ?? '—',
          localizacao: p.location,
          saldo: p.quantity,
          unidade: p.unit,
          minimo: p.minStock,
          situacao: STOCK_STATUS_LABEL[getStockStatus(p)],
          custo: p.unitCost,
          valor: stockValue(p),
        }))
        .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'))
      return {
        columns: [
          { key: 'sku', label: 'SKU', format: 'text' },
          { key: 'produto', label: 'Produto', format: 'text' },
          { key: 'categoria', label: 'Categoria', format: 'text' },
          { key: 'localizacao', label: 'Localização', format: 'text' },
          { key: 'saldo', label: 'Saldo', format: 'number' },
          { key: 'unidade', label: 'Un.', format: 'text' },
          { key: 'minimo', label: 'Mínimo', format: 'number' },
          { key: 'situacao', label: 'Situação', format: 'text' },
          { key: 'custo', label: 'Custo unit.', format: 'currency' },
          { key: 'valor', label: 'Valor em estoque', format: 'currency' },
        ],
        rows,
        totals: {
          sku: 'Total',
          saldo: rows.reduce((s, r) => s + r.saldo, 0),
          valor: rows.reduce((s, r) => s + r.valor, 0),
        },
      }
    }
    case 'below-minimum': {
      const rows = products
        .filter((p) => ['low', 'out'].includes(getStockStatus(p)))
        .map((p) => {
          const target = p.maxStock ?? p.minStock * 2
          const suggestion = Math.max(0, target - p.quantity)
          return {
            sku: p.sku,
            produto: p.name,
            fornecedor: p.supplierId ? (supplierName.get(p.supplierId) ?? '—') : '—',
            saldo: p.quantity,
            minimo: p.minStock,
            falta: Math.max(0, p.minStock - p.quantity),
            sugestao: suggestion,
            custoReposicao: suggestion * p.unitCost,
          }
        })
        .sort((a, b) => b.falta - a.falta)
      return {
        columns: [
          { key: 'sku', label: 'SKU', format: 'text' },
          { key: 'produto', label: 'Produto', format: 'text' },
          { key: 'fornecedor', label: 'Fornecedor', format: 'text' },
          { key: 'saldo', label: 'Saldo', format: 'number' },
          { key: 'minimo', label: 'Mínimo', format: 'number' },
          { key: 'falta', label: 'Abaixo do mínimo', format: 'number' },
          { key: 'sugestao', label: 'Reposição sugerida', format: 'number' },
          { key: 'custoReposicao', label: 'Custo da reposição', format: 'currency' },
        ],
        rows,
        totals: { sku: 'Total', custoReposicao: rows.reduce((s, r) => s + r.custoReposicao, 0) },
      }
    }
    case 'out-of-stock': {
      const rows = products
        .filter((p) => p.quantity === 0)
        .map((p) => {
          const lastOut = data.movements
            .filter((m) => m.productId === p.id && (m.type === 'out' || m.type === 'adjust_out'))
            .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
          return {
            sku: p.sku,
            produto: p.name,
            categoria: categoryName.get(p.categoryId) ?? '—',
            fornecedor: p.supplierId ? (supplierName.get(p.supplierId) ?? '—') : '—',
            minimo: p.minStock,
            ultimaSaida: lastOut?.occurredAt ?? null,
          }
        })
      return {
        columns: [
          { key: 'sku', label: 'SKU', format: 'text' },
          { key: 'produto', label: 'Produto', format: 'text' },
          { key: 'categoria', label: 'Categoria', format: 'text' },
          { key: 'fornecedor', label: 'Fornecedor', format: 'text' },
          { key: 'minimo', label: 'Mínimo', format: 'number' },
          { key: 'ultimaSaida', label: 'Última saída', format: 'datetime' },
        ],
        rows,
      }
    }
    case 'stock-value': {
      const total = products.reduce((s, p) => s + stockValue(p), 0)
      const rows = data.categories
        .filter((c) => !f.categoryId || c.id === f.categoryId)
        .map((c) => {
          const items = products.filter((p) => p.categoryId === c.id)
          const cost = items.reduce((s, p) => s + stockValue(p), 0)
          return {
            categoria: c.name,
            produtos: items.length,
            unidades: items.reduce((s, p) => s + p.quantity, 0),
            valorCusto: cost,
            valorVenda: items.reduce((s, p) => s + p.quantity * (p.salePrice ?? 0), 0),
            participacao: total > 0 ? cost / total : 0,
          }
        })
        .filter((r) => r.produtos > 0)
        .sort((a, b) => b.valorCusto - a.valorCusto)
      return {
        columns: [
          { key: 'categoria', label: 'Categoria', format: 'text' },
          { key: 'produtos', label: 'Produtos', format: 'number' },
          { key: 'unidades', label: 'Unidades', format: 'number' },
          { key: 'valorCusto', label: 'Valor de custo', format: 'currency' },
          { key: 'valorVenda', label: 'Valor de venda', format: 'currency' },
          { key: 'participacao', label: 'Participação', format: 'percent' },
        ],
        rows,
        totals: {
          categoria: 'Total',
          produtos: rows.reduce((s, r) => s + r.produtos, 0),
          unidades: rows.reduce((s, r) => s + r.unidades, 0),
          valorCusto: rows.reduce((s, r) => s + r.valorCusto, 0),
          valorVenda: rows.reduce((s, r) => s + r.valorVenda, 0),
          participacao: rows.length ? 1 : 0,
        },
      }
    }
    case 'flow-by-period': {
      const grouped = new Map<string, { entradas: number; saidas: number; ajustesMais: number; ajustesMenos: number }>()
      for (const m of filterMovements(data, f)) {
        const g = grouped.get(m.productId) ?? { entradas: 0, saidas: 0, ajustesMais: 0, ajustesMenos: 0 }
        if (m.type === 'in') g.entradas += m.quantity
        else if (m.type === 'out') g.saidas += m.quantity
        else if (m.type === 'adjust_in') g.ajustesMais += m.quantity
        else g.ajustesMenos += m.quantity
        grouped.set(m.productId, g)
      }
      const rows = [...grouped.entries()]
        .map(([pid, g]) => {
          const p = productById.get(pid)
          return {
            sku: p?.sku ?? '—',
            produto: p?.name ?? 'Produto removido',
            entradas: g.entradas,
            saidas: g.saidas,
            ajustesMais: g.ajustesMais,
            ajustesMenos: g.ajustesMenos,
            variacao: g.entradas + g.ajustesMais - g.saidas - g.ajustesMenos,
          }
        })
        .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'))
      const sum = (k: 'entradas' | 'saidas' | 'ajustesMais' | 'ajustesMenos' | 'variacao') =>
        rows.reduce((s, r) => s + r[k], 0)
      return {
        columns: [
          { key: 'sku', label: 'SKU', format: 'text' },
          { key: 'produto', label: 'Produto', format: 'text' },
          { key: 'entradas', label: 'Entradas', format: 'number' },
          { key: 'saidas', label: 'Saídas', format: 'number' },
          { key: 'ajustesMais', label: 'Ajustes +', format: 'number' },
          { key: 'ajustesMenos', label: 'Ajustes −', format: 'number' },
          { key: 'variacao', label: 'Variação líquida', format: 'number' },
        ],
        rows,
        totals: {
          sku: 'Total',
          entradas: sum('entradas'),
          saidas: sum('saidas'),
          ajustesMais: sum('ajustesMais'),
          ajustesMenos: sum('ajustesMenos'),
          variacao: sum('variacao'),
        },
      }
    }
    case 'movements-by-product': {
      const rows = filterMovements(data, f)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .map((m) => {
          const p = productById.get(m.productId)
          return {
            data: m.occurredAt,
            sku: p?.sku ?? '—',
            produto: p?.name ?? 'Produto removido',
            tipo: MOVEMENT_TYPE_LABEL[m.type],
            quantidade: m.quantity,
            saldoApos: m.balanceAfter,
            motivo: m.reason,
            responsavel: m.responsible,
          }
        })
      return {
        columns: [
          { key: 'data', label: 'Data', format: 'datetime' },
          { key: 'sku', label: 'SKU', format: 'text' },
          { key: 'produto', label: 'Produto', format: 'text' },
          { key: 'tipo', label: 'Tipo', format: 'text' },
          { key: 'quantidade', label: 'Quantidade', format: 'number' },
          { key: 'saldoApos', label: 'Saldo após', format: 'number' },
          { key: 'motivo', label: 'Motivo', format: 'text' },
          { key: 'responsavel', label: 'Responsável', format: 'text' },
        ],
        rows,
      }
    }
    case 'purchases-by-supplier': {
      const orders = data.purchaseOrders.filter(
        (o) => o.status !== 'cancelled' && o.status !== 'draft' && inRange(o.createdAt, f) && (!f.supplierId || o.supplierId === f.supplierId),
      )
      const rows = data.suppliers
        .map((s) => {
          const own = orders.filter((o) => o.supplierId === s.id)
          const total = own.reduce((sum, o) => sum + orderTotal(o), 0)
          const received = own.reduce((sum, o) => sum + orderReceivedTotal(o), 0)
          return {
            fornecedor: s.companyName,
            pedidos: own.length,
            emAberto: own.filter((o) => o.status !== 'received').length,
            valorTotal: total,
            valorRecebido: received,
            pendente: total - received,
          }
        })
        .filter((r) => r.pedidos > 0)
        .sort((a, b) => b.valorTotal - a.valorTotal)
      return {
        columns: [
          { key: 'fornecedor', label: 'Fornecedor', format: 'text' },
          { key: 'pedidos', label: 'Pedidos', format: 'number' },
          { key: 'emAberto', label: 'Em aberto', format: 'number' },
          { key: 'valorTotal', label: 'Valor comprado', format: 'currency' },
          { key: 'valorRecebido', label: 'Valor recebido', format: 'currency' },
          { key: 'pendente', label: 'A receber', format: 'currency' },
        ],
        rows,
        totals: {
          fornecedor: 'Total',
          pedidos: rows.reduce((s, r) => s + r.pedidos, 0),
          emAberto: rows.reduce((s, r) => s + r.emAberto, 0),
          valorTotal: rows.reduce((s, r) => s + r.valorTotal, 0),
          valorRecebido: rows.reduce((s, r) => s + r.valorRecebido, 0),
          pendente: rows.reduce((s, r) => s + r.pendente, 0),
        },
      }
    }
    case 'most-moved': {
      const grouped = new Map<string, { count: number; volume: number }>()
      for (const m of filterMovements(data, f)) {
        const g = grouped.get(m.productId) ?? { count: 0, volume: 0 }
        g.count++
        g.volume += m.quantity
        grouped.set(m.productId, g)
      }
      const rows = [...grouped.entries()]
        .map(([pid, g]) => {
          const p = productById.get(pid)
          return {
            posicao: 0,
            sku: p?.sku ?? '—',
            produto: p?.name ?? 'Produto removido',
            categoria: p ? (categoryName.get(p.categoryId) ?? '—') : '—',
            lancamentos: g.count,
            volume: g.volume,
          }
        })
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 20)
        .map((r, i) => ({ ...r, posicao: i + 1 }))
      return {
        columns: [
          { key: 'posicao', label: 'Posição', format: 'number' },
          { key: 'sku', label: 'SKU', format: 'text' },
          { key: 'produto', label: 'Produto', format: 'text' },
          { key: 'categoria', label: 'Categoria', format: 'text' },
          { key: 'lancamentos', label: 'Lançamentos', format: 'number' },
          { key: 'volume', label: 'Volume movimentado', format: 'number' },
        ],
        rows,
      }
    }
  }
}

/** Converte um valor para exportação (CSV/JSON) sem formatação de localidade. */
export function exportValue(value: string | number | null, format: ColumnFormat): string | number | null {
  if (value === null) return null
  if (format === 'currency' && typeof value === 'number') return Number((value / 100).toFixed(2))
  if (format === 'percent' && typeof value === 'number') return Number((value * 100).toFixed(2))
  return value
}

