import { parseISO, startOfDay } from 'date-fns'
import { useMemo } from 'react'
import { useAppData } from '@/app/store'
import { daysUntilExpiry, getStockStatus, isNearExpiry, OPEN_ORDER_STATUSES } from '@/domain/rules'
import { formatDate } from '@/lib/format'

export type NotificationTone = 'out' | 'low' | 'info'

export interface AppNotification {
  id: string
  tone: NotificationTone
  title: string
  description: string
  to: string
}

/** Alertas derivados do estado atual (estoque, validade e pedidos). */
export function useNotifications(): AppNotification[] {
  const data = useAppData()
  return useMemo(() => {
    const now = new Date()
    const list: AppNotification[] = []
    const active = data.products.filter((p) => p.active)
    for (const p of active) {
      const status = getStockStatus(p)
      if (status === 'out') {
        list.push({ id: `out:${p.id}:${p.updatedAt}`, tone: 'out', title: `${p.name} sem estoque`, description: `${p.sku}, mínimo ${p.minStock} ${p.unit}`, to: `/produtos?ver=${p.id}` })
      } else if (status === 'low') {
        list.push({ id: `low:${p.id}:${p.updatedAt}`, tone: 'low', title: `${p.name} abaixo do mínimo`, description: `Saldo ${p.quantity} de mínimo ${p.minStock} ${p.unit}`, to: `/produtos?ver=${p.id}` })
      }
      if (p.quantity > 0 && isNearExpiry(p, now, data.settings.expiryWarningDays)) {
        const days = daysUntilExpiry(p, now) ?? 0
        list.push({
          id: `exp:${p.id}:${p.expiryDate}`,
          tone: days < 0 ? 'out' : 'low',
          title: days < 0 ? `${p.name} vencido` : `${p.name} vence em ${days} dia(s)`,
          description: `Validade ${formatDate(p.expiryDate!)}, ${p.quantity} ${p.unit} em estoque`,
          to: `/produtos?ver=${p.id}`,
        })
      }
    }
    const today = startOfDay(now)
    for (const o of data.purchaseOrders) {
      if (o.status === 'pending') {
        list.push({ id: `appr:${o.id}`, tone: 'info', title: `${o.number} aguarda aprovação`, description: 'Pedido pendente de aprovação.', to: `/pedidos?ver=${o.id}` })
      }
      if (OPEN_ORDER_STATUSES.includes(o.status) && o.status !== 'pending' && parseISO(o.expectedAt) < today) {
        list.push({ id: `late:${o.id}:${o.status}`, tone: 'low', title: `${o.number} com entrega atrasada`, description: `Previsão era ${formatDate(o.expectedAt)}.`, to: `/pedidos?ver=${o.id}` })
      }
    }
    const order: Record<NotificationTone, number> = { out: 0, low: 1, info: 2 }
    return list.sort((a, b) => order[a.tone] - order[b.tone])
  }, [data])
}
