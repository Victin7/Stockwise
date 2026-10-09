import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'ok' | 'low' | 'out' | 'info'

const TONE: Record<Tone, string> = {
  neutral: 'bg-primary/10 text-primary',
  ok: 'bg-ok/12 text-ok',
  low: 'bg-low/14 text-low',
  out: 'bg-out/12 text-out',
  info: 'bg-info/12 text-info',
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: Tone
  to?: string
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral', to }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', TONE[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="tabular mt-2 font-display text-[1.65rem] leading-none font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  )
  const className = 'block rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgb(15_42_45/0.05)]'
  return to ? (
    <Link to={to} className={cn(className, 'transition-colors hover:border-primary/40')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
