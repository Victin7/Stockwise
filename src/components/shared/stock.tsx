import { Badge } from '@/components/ui/badge'
import type { Product } from '@/domain/entities'
import { STOCK_STATUS_LABEL } from '@/domain/labels'
import { getStockStatus, type StockStatus } from '@/domain/rules'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_VARIANT: Record<StockStatus, 'ok' | 'low' | 'out' | 'info'> = {
  ok: 'ok',
  low: 'low',
  out: 'out',
  over: 'info',
}

const STATUS_BAR: Record<StockStatus, string> = {
  ok: 'bg-ok',
  low: 'bg-low',
  out: 'bg-out',
  over: 'bg-info',
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STOCK_STATUS_LABEL[status]}</Badge>
}

/**
 * Medidor de nível de estoque: preenchimento relativo ao máximo (ou 3× o
 * mínimo), com marcação do estoque mínimo.
 */
export function StockGauge({
  product,
  className,
  showNumbers = true,
}: {
  product: Pick<Product, 'quantity' | 'minStock' | 'maxStock' | 'unit'>
  className?: string
  showNumbers?: boolean
}) {
  const status = getStockStatus(product)
  const scale = Math.max(product.maxStock ?? product.minStock * 3, product.quantity, 1)
  const fill = Math.min(100, (product.quantity / scale) * 100)
  const minPos = Math.min(100, (product.minStock / scale) * 100)
  return (
    <div className={cn('flex min-w-28 flex-col gap-1', className)}>
      {showNumbers && (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="tabular font-semibold text-foreground">
            {formatNumber(product.quantity)} <span className="font-normal text-muted-foreground">{product.unit}</span>
          </span>
          <span className="tabular text-muted-foreground">mín. {formatNumber(product.minStock)}</span>
        </div>
      )}
      <div
        className="relative h-1.5 overflow-visible rounded-full bg-muted"
        role="meter"
        aria-label="Nível de estoque"
        aria-valuemin={0}
        aria-valuemax={scale}
        aria-valuenow={product.quantity}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', STATUS_BAR[status])} style={{ width: `${fill}%` }} />
        <span
          className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/45"
          style={{ left: `calc(${minPos}% - 1px)` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

/** Código interno exibido como etiqueta de prateleira. */
export function CodeTag({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border border-foreground/15 bg-background px-1.5 py-px font-mono text-[11px] font-medium tracking-tight text-foreground/80',
        className,
      )}
    >
      {children}
    </span>
  )
}
