import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { History, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppData } from '@/app/store'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, type ActivityEvent } from '@/domain/entities'
import { ACTIVITY_ACTION_LABEL, ACTIVITY_ENTITY_LABEL } from '@/domain/labels'
import { LIMITS } from '@/domain/rules'
import { formatNumber } from '@/lib/format'
import { matchesSearch } from '@/lib/utils'

const PAGE = 40

export default function ActivityPage() {
  const data = useAppData()
  const [search, setSearch] = useState('')
  const [entity, setEntity] = useState('all')
  const [action, setAction] = useState('all')
  const [limit, setLimit] = useState(PAGE)

  const events = useMemo(
    () =>
      [...data.activity]
        .sort((a, b) => b.at.localeCompare(a.at))
        .filter(
          (e) =>
            (entity === 'all' || e.entity === entity) &&
            (action === 'all' || e.action === action) &&
            matchesSearch(search, e.summary, e.entityId),
        ),
    [data.activity, entity, action, search],
  )

  const grouped = useMemo(() => {
    const groups: { day: string; items: ActivityEvent[] }[] = []
    for (const e of events.slice(0, limit)) {
      const day = format(parseISO(e.at), 'yyyy-MM-dd')
      const last = groups[groups.length - 1]
      if (last?.day === day) last.items.push(e)
      else groups.push({ day, items: [e] })
    }
    return groups
  }, [events, limit])

  return (
    <div className="space-y-6">
      <PageHeader title="Histórico de atividades" description="Registro das principais ações realizadas no StockWise, das mais recentes para as mais antigas." />

      <div className="flex gap-3 rounded-xl border border-info/25 bg-info/6 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          Este histórico é <strong>demonstrativo</strong>: fica salvo apenas neste navegador, junto com os demais dados, e mantém os{' '}
          {formatNumber(LIMITS.activity)} eventos mais recentes. Não pode ser editado pela interface, mas também não é uma trilha de auditoria
          inviolável, já que não existe servidor para garantir sua integridade.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setLimit(PAGE) }} placeholder="Buscar no resumo ou identificador" className="lg:max-w-sm lg:flex-1" />
          <div className="grid gap-3 sm:grid-cols-2 lg:flex">
            <Select value={entity} onValueChange={(v) => { setEntity(v); setLimit(PAGE) }}>
              <SelectTrigger className="lg:w-52" aria-label="Filtrar por entidade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                {ACTIVITY_ENTITIES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ACTIVITY_ENTITY_LABEL[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={(v) => { setAction(v); setLimit(PAGE) }}>
              <SelectTrigger className="lg:w-52" aria-label="Filtrar por ação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {ACTIVITY_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTIVITY_ACTION_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {events.length === 0 ? (
          <EmptyState icon={History} title="Nenhum evento encontrado" description="Ajuste os filtros para ver outras atividades." />
        ) : (
          <div className="divide-y">
            {grouped.map((g) => (
              <section key={g.day} aria-label={g.day}>
                <h2 className="sticky top-16 z-10 bg-muted/80 px-5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                  {format(parseISO(g.day), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h2>
                <ol className="divide-y">
                  {g.items.map((e) => (
                    <li key={e.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[60px_160px_1fr] sm:gap-4">
                      <time dateTime={e.at} className="tabular text-sm text-muted-foreground">
                        {format(parseISO(e.at), 'HH:mm')}
                      </time>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{ACTIVITY_ENTITY_LABEL[e.entity]}</Badge>
                        <span className="text-xs text-muted-foreground">{ACTIVITY_ACTION_LABEL[e.action]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm">{e.summary}</p>
                        {e.entityId && <p className="truncate font-mono text-[11px] text-muted-foreground">ID {e.entityId}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
        {events.length > limit && (
          <div className="border-t p-4 text-center">
            <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
              Carregar mais ({formatNumber(events.length - limit)} restantes)
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
