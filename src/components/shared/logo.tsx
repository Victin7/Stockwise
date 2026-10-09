import { cn } from '@/lib/utils'

/**
 * Marca StockWise: três níveis de prateleira em comprimentos decrescentes
 * (um medidor de estoque estilizado) + logotipo tipográfico.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      <rect x="2" y="3" width="24" height="22" rx="6" fill="currentColor" opacity="0.14" />
      <rect x="7" y="8" width="14" height="2.6" rx="1.3" fill="var(--signal)" />
      <rect x="7" y="12.7" width="10.5" height="2.6" rx="1.3" fill="currentColor" />
      <rect x="7" y="17.4" width="6.5" height="2.6" rx="1.3" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!collapsed && (
        <span className="font-display text-[1.2rem] leading-none font-bold tracking-[-0.035em]">
          stockwise
        </span>
      )}
    </span>
  )
}
