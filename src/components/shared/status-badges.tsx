import { ArrowDownLeft, ArrowUpRight, MinusCircle, PlusCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MovementType, PurchaseOrderStatus } from '@/domain/entities'
import { MOVEMENT_TYPE_LABEL, ORDER_STATUS_LABEL } from '@/domain/labels'

const ORDER_VARIANT: Record<PurchaseOrderStatus, 'muted' | 'low' | 'info' | 'default' | 'ok' | 'out'> = {
  draft: 'muted',
  pending: 'low',
  approved: 'info',
  partially_received: 'default',
  received: 'ok',
  cancelled: 'out',
}

export function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge variant={ORDER_VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>
}

const MOVEMENT_ICON = { in: ArrowDownLeft, out: ArrowUpRight, adjust_in: PlusCircle, adjust_out: MinusCircle }
const MOVEMENT_VARIANT: Record<MovementType, 'ok' | 'out' | 'info' | 'low'> = {
  in: 'ok',
  out: 'out',
  adjust_in: 'info',
  adjust_out: 'low',
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const Icon = MOVEMENT_ICON[type]
  return (
    <Badge variant={MOVEMENT_VARIANT[type]}>
      <Icon />
      {MOVEMENT_TYPE_LABEL[type]}
    </Badge>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'ok' : 'muted'}>{active ? 'Ativo' : 'Inativo'}</Badge>
}
