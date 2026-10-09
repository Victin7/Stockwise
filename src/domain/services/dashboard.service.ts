import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from 'date-fns'
import type { AppData, Product, StockMovement } from '@/domain/entities'
import {
  getStockStatus,
  isNearExpiry,
  OPEN_ORDER_STATUSES,
  orderTotal,
  stockValue,
} from '@/domain/rules'

export interface DashboardOptions {
  now: Date
  periodDays: number
}

export interface DailyFlow {
  day: string
  label: string
  entradas: number
  saidas: number
  ajustes: number
}

export interface CategoryShare {
  categoryId: string
  name: string
  color: string
  value: number
  units: number
  products: number
}

export interface DashboardMetrics {
  totalProducts: number
  activeProducts: number
  totalUnits: number
  stockValue: number
  lowStock: number
  outOfStock: number
  nearExpiry: number
  periodIn: number
  periodOut: number
  periodInCount: number
  periodOutCount: number
  openOrders: number
  openOrdersValue: number
  flow: DailyFlow[]
  byCategory: CategoryShare[]
  critical: Product[]
  recentMovements: StockMovement[]
}

/**
 * Calcula todos os indicadores do dashboard a partir do estado atual.
 * Função pura: os mesmos dados alimentam cards, gráficos e demais páginas.
 */
export function computeDashboardMetrics(data: AppData, { now, periodDays }: DashboardOptions): DashboardMetrics {
  const active = data.products.filter((p) => p.active)
  const from = startOfDay(subDays(now, periodDays - 1))
  const to = endOfDay(now)

  const inPeriod = data.movements.filter((m) => {
    const t = new Date(m.occurredAt).getTime()
    return t >= from.getTime() && t <= to.getTime()
  })

  const days = eachDayOfInterval({ start: from, end: to })
  const flowMap = new Map<string, DailyFlow>(
    days.map((d) => {
      const key = format(d, 'yyyy-MM-dd')
      return [key, { day: key, label: format(d, 'dd/MM'), entradas: 0, saidas: 0, ajustes: 0 }]
    }),
  )
  let periodIn = 0
  let periodOut = 0
  let periodInCount = 0
  let periodOutCount = 0
  for (const m of inPeriod) {
    const bucket = flowMap.get(format(new Date(m.occurredAt), 'yyyy-MM-dd'))
    if (m.type === 'in') {
      periodIn += m.quantity
      periodInCount++
      if (bucket) bucket.entradas += m.quantity
    } else if (m.type === 'out') {
      periodOut += m.quantity
      periodOutCount++
      if (bucket) bucket.saidas += m.quantity
    } else if (bucket) {
      bucket.ajustes += m.quantity
    }
  }

  const byCategory: CategoryShare[] = data.categories
    .map((c) => {
      const items = active.filter((p) => p.categoryId === c.id)
      return {
        categoryId: c.id,
        name: c.name,
        color: c.color,
        value: items.reduce((s, p) => s + stockValue(p), 0),
        units: items.reduce((s, p) => s + p.quantity, 0),
        products: items.length,
      }
    })
    .filter((c) => c.products > 0)
    .sort((a, b) => b.value - a.value)

  const critical = active
    .filter((p) => {
      const s = getStockStatus(p)
      return s === 'low' || s === 'out'
    })
    .sort((a, b) => a.quantity / Math.max(1, a.minStock) - b.quantity / Math.max(1, b.minStock))

  const openOrders = data.purchaseOrders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status))

  return {
    totalProducts: data.products.length,
    activeProducts: active.length,
    totalUnits: active.reduce((s, p) => s + p.quantity, 0),
    stockValue: active.reduce((s, p) => s + stockValue(p), 0),
    lowStock: active.filter((p) => getStockStatus(p) === 'low').length,
    outOfStock: active.filter((p) => getStockStatus(p) === 'out').length,
    nearExpiry: active.filter((p) => p.quantity > 0 && isNearExpiry(p, now, data.settings.expiryWarningDays)).length,
    periodIn,
    periodOut,
    periodInCount,
    periodOutCount,
    openOrders: openOrders.length,
    openOrdersValue: openOrders.reduce((s, o) => s + orderTotal(o), 0),
    flow: [...flowMap.values()],
    byCategory,
    critical,
    recentMovements: [...data.movements]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 8),
  }
}
