import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CategoryShare, DailyFlow } from '@/domain/services/dashboard.service'
import { formatCurrency, formatCurrencyCompact, formatNumber } from '@/lib/format'

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
  payload?: unknown
}

function ChartTooltip({ active, payload, label, money }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number; money?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="tabular ml-auto pl-3 font-semibold">{money ? formatCurrency(Number(p.value)) : formatNumber(Number(p.value))}</span>
        </p>
      ))}
    </div>
  )
}

export function FlowChart({ data }: { data: DailyFlow[] }) {
  const interval = data.length > 31 ? 13 : data.length > 14 ? 4 : 0
  return (
    <div className="h-80 w-full" role="img" aria-label="Gráfico de entradas e saídas por dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={1}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={interval} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={44} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="entradas" name="Entradas" fill="var(--status-ok)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="saidas" name="Saídas" fill="var(--status-out)" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryChart({ data }: { data: CategoryShare[] }) {
  const total = data.reduce((s, c) => s + c.value, 0)
  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-48 w-full" role="img" aria-label="Distribuição do valor em estoque por categoria">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
              {data.map((c) => (
                <Cell key={c.categoryId} fill={c.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip money />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="tabular font-display text-sm font-semibold">{formatCurrencyCompact(total)}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((c) => (
          <li key={c.categoryId} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className="tabular text-xs text-muted-foreground">{total > 0 ? Math.round((c.value / total) * 100) : 0}%</span>
            <span className="tabular w-24 text-right font-medium">{formatCurrency(c.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
