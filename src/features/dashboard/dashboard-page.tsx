import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Layers,
  PackageX,
  Package,
  Plus,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAppData } from '@/app/store'
import { EmptyState } from '@/components/shared/empty-state'
import { StatCard } from '@/components/shared/stat-card'
import { MovementTypeBadge } from '@/components/shared/status-badges'
import { CodeTag, StockGauge } from '@/components/shared/stock'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { movementSign } from '@/domain/rules'
import { computeDashboardMetrics } from '@/domain/services/dashboard.service'
import { formatCurrency, formatNumber, formatRelative, pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CategoryChart, FlowChart } from './dashboard-charts'

const PERIODS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
]

export default function DashboardPage() {
  const data = useAppData()
  const [period, setPeriod] = useState('30')
  const metrics = useMemo(() => computeDashboardMetrics(data, { now: new Date(), periodDays: Number(period) }), [data, period])
  const productById = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products])
  const periodLabel = PERIODS.find((p) => p.value === period)!.label.toLowerCase()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{data.settings.companyName}</p>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] sm:text-[1.7rem]">Visão geral do estoque</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <Link to="/estoque?novo=1">
              <ArrowLeftRight /> Movimentar
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/pedidos?novo=1">
              <ClipboardList /> Novo pedido
            </Link>
          </Button>
          <Button asChild>
            <Link to="/produtos?novo=1">
              <Plus /> Novo produto
            </Link>
          </Button>
        </div>
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Produtos cadastrados" value={formatNumber(metrics.totalProducts)} hint={`${formatNumber(metrics.activeProducts)} ativos`} icon={Package} to="/produtos" />
        <StatCard label="Unidades em estoque" value={formatNumber(metrics.totalUnits)} hint="soma dos saldos dos produtos ativos" icon={Layers} />
        <StatCard label="Valor estimado" value={formatCurrency(metrics.stockValue)} hint="a preço de custo" icon={Wallet} to="/relatorios?r=stock-value" />
        <StatCard label="Pedidos em aberto" value={formatNumber(metrics.openOrders)} hint={formatCurrency(metrics.openOrdersValue)} icon={ClipboardList} tone="info" to="/pedidos" />
        <StatCard label="Estoque baixo" value={formatNumber(metrics.lowStock)} hint="no mínimo ou abaixo" icon={TriangleAlert} tone={metrics.lowStock ? 'low' : 'ok'} to="/produtos?situacao=low" />
        <StatCard label="Sem estoque" value={formatNumber(metrics.outOfStock)} hint="saldo zerado" icon={PackageX} tone={metrics.outOfStock ? 'out' : 'ok'} to="/produtos?situacao=out" />
        <StatCard label="Entradas no período" value={formatNumber(metrics.periodIn)} hint={pluralize(metrics.periodInCount, 'lançamento', 'lançamentos')} icon={ArrowDownLeft} tone="ok" to="/estoque?tipo=in" />
        <StatCard label="Saídas no período" value={formatNumber(metrics.periodOut)} hint={pluralize(metrics.periodOutCount, 'lançamento', 'lançamentos')} icon={ArrowUpRight} tone="out" to="/estoque?tipo=out" />
      </section>

      {metrics.nearExpiry > 0 && (
        <Link
          to="/produtos?situacao=expiring"
          className="flex items-center gap-3 rounded-xl border border-low/30 bg-low/8 px-4 py-3 text-sm transition-colors hover:bg-low/12"
        >
          <CalendarClock className="size-4 shrink-0 text-low" />
          <span>
            <strong className="font-semibold">{pluralize(metrics.nearExpiry, 'produto vence', 'produtos vencem')}</strong> nos próximos{' '}
            {data.settings.expiryWarningDays} dias ou já {metrics.nearExpiry === 1 ? 'está vencido' : 'estão vencidos'}.
          </span>
          <span className="ml-auto text-xs font-medium text-low">Ver produtos</span>
        </Link>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Entradas e saídas</CardTitle>
              <CardDescription>Unidades movimentadas por dia, {periodLabel}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.periodIn + metrics.periodOut === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="Sem movimentações no período" description="Escolha um período maior ou registre uma movimentação." />
            ) : (
              <FlowChart data={metrics.flow} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Estoque por categoria</CardTitle>
              <CardDescription>Participação no valor total</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.byCategory.length === 0 ? (
              <EmptyState icon={Layers} title="Sem produtos ativos" />
            ) : (
              <CategoryChart data={metrics.byCategory} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Estoque crítico</CardTitle>
              <CardDescription>Produtos sem saldo ou no mínimo, do mais urgente ao menos urgente</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/relatorios?r=below-minimum">Relatório</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {metrics.critical.length === 0 ? (
              <EmptyState icon={Package} title="Nenhum produto em nível crítico" description="Todos os produtos ativos estão acima do estoque mínimo." />
            ) : (
              <ul className="divide-y">
                {metrics.critical.slice(0, 7).map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/produtos?ver=${p.id}`} className="block truncate text-sm font-medium hover:underline">
                        {p.name}
                      </Link>
                      <CodeTag className="mt-0.5">{p.sku}</CodeTag>
                    </div>
                    <StockGauge product={p} className="w-32 sm:w-40" />
                    <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                      <Link to={`/pedidos?novo=1&produto=${p.id}`}>Repor</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {metrics.critical.length > 7 && (
              <p className="px-5 pt-2 text-xs text-muted-foreground">
                e mais {metrics.critical.length - 7}.{' '}
                <Link to="/produtos?situacao=low" className="text-primary hover:underline">
                  Ver todos
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Últimas movimentações</CardTitle>
              <CardDescription>Lançamentos mais recentes no estoque</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/estoque">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {metrics.recentMovements.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="Nenhuma movimentação" />
            ) : (
              <ul className="divide-y">
                {metrics.recentMovements.map((m) => {
                  const p = productById.get(m.productId)
                  const sign = movementSign(m.type)
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                      <MovementTypeBadge type={m.type} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{p?.name ?? 'Produto removido'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.reason}, {formatRelative(m.occurredAt)}
                        </p>
                      </div>
                      <span className={cn('tabular text-sm font-semibold', sign > 0 ? 'text-ok' : 'text-out')}>
                        {sign > 0 ? '+' : '−'}
                        {formatNumber(m.quantity)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
