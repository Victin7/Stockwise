import { FileJson, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useAppData } from '@/app/store'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { ProductPicker } from '@/components/shared/product-picker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  buildReport,
  type ColumnFormat,
  exportValue,
  REPORT_IDS,
  REPORTS,
  type ReportFilters,
  type ReportId,
  type ReportRow,
} from '@/domain/services/reports.service'
import { downloadFile, toCsv } from '@/lib/csv'
import { formatCurrency, formatDate, formatDateTime, formatNumber, toDayString } from '@/lib/format'
import { cn } from '@/lib/utils'
import { subDays } from 'date-fns'
import { toast } from 'sonner'

function formatCell(value: string | number | null | undefined, format: ColumnFormat): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (format) {
    case 'currency':
      return formatCurrency(Number(value))
    case 'number':
      return formatNumber(Number(value))
    case 'percent':
      return `${(Number(value) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    case 'date':
      return formatDate(String(value))
    case 'datetime':
      return formatDateTime(String(value))
    default:
      return String(value)
  }
}

const isNumeric = (f: ColumnFormat) => f === 'number' || f === 'currency' || f === 'percent'

export default function ReportsPage() {
  const data = useAppData()
  const [params, setParams] = useSearchParams()
  const reportParam = params.get('r')
  const reportId: ReportId = REPORT_IDS.includes(reportParam as ReportId) ? (reportParam as ReportId) : 'stock-position'
  const definition = REPORTS.find((r) => r.id === reportId)!

  const filters: ReportFilters = {
    from: params.get('de') ?? toDayString(subDays(new Date(), 29)),
    to: params.get('ate') ?? toDayString(new Date()),
    categoryId: params.get('categoria') ?? undefined,
    productId: params.get('produto') ?? undefined,
    supplierId: params.get('fornecedor') ?? undefined,
  }
  const active: ReportFilters = Object.fromEntries(
    definition.filters.map((k) => [k, filters[k]]).filter(([, v]) => v),
  ) as ReportFilters

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const invalidRange = Boolean(active.from && active.to && active.from > active.to)
  const report = useMemo(() => (invalidRange ? null : buildReport(data, reportId, active)), [data, reportId, JSON.stringify(active), invalidRange])

  const fileBase = `stockwise-${reportId}-${toDayString(new Date())}`

  const exportCsv = () => {
    if (!report) return
    type Row = Record<string, string | number | null>
    const rows: Row[] = [...report.rows, ...(report.totals ? [report.totals] : [])].map((r) =>
      Object.fromEntries(report.columns.map((c) => [c.key, exportValue(r[c.key] ?? null, c.format)])),
    )
    const columns = report.columns.map((c) => ({
      key: c.key,
      label: c.format === 'currency' ? `${c.label} (R$)` : c.format === 'percent' ? `${c.label} (%)` : c.label,
    }))
    downloadFile(`${fileBase}.csv`, toCsv(columns, rows), 'text/csv')
    toast.success('Relatório exportado em CSV.')
  }

  const exportJson = () => {
    if (!report) return
    const payload = {
      relatorio: definition.title,
      geradoEm: new Date().toISOString(),
      empresa: data.settings.companyName,
      filtros: active,
      colunas: report.columns.map((c) => ({ chave: c.key, rotulo: c.label, formato: c.format })),
      linhas: report.rows.map((r: ReportRow) => Object.fromEntries(report.columns.map((c) => [c.key, exportValue(r[c.key] ?? null, c.format)]))),
      totais: report.totals
        ? Object.fromEntries(report.columns.map((c) => [c.key, exportValue(report.totals![c.key] ?? null, c.format)]))
        : null,
      observacao: 'Valores monetários em reais; percentuais de 0 a 100.',
    }
    downloadFile(`${fileBase}.json`, JSON.stringify(payload, null, 2), 'application/json')
    toast.success('Relatório exportado em JSON.')
  }

  const filterSummary = [
    active.from && active.to ? `Período: ${formatDate(active.from)} a ${formatDate(active.to)}` : null,
    active.categoryId ? `Categoria: ${data.categories.find((c) => c.id === active.categoryId)?.name}` : null,
    active.productId ? `Produto: ${data.products.find((p) => p.id === active.productId)?.name}` : null,
    active.supplierId ? `Fornecedor: ${data.suppliers.find((s) => s.id === active.supplierId)?.companyName}` : null,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Relatórios"
          description="Relatórios calculados a partir dos dados atuais, com exportação em CSV e JSON e versão para impressão."
          actions={
            <>
              <Button variant="outline" onClick={exportCsv} disabled={!report || report.rows.length === 0}>
                <FileSpreadsheet /> CSV
              </Button>
              <Button variant="outline" onClick={exportJson} disabled={!report || report.rows.length === 0}>
                <FileJson /> JSON
              </Button>
              <Button onClick={() => window.print()} disabled={!report || report.rows.length === 0}>
                <Printer /> Imprimir
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Relatórios disponíveis" className="no-print">
          <div className="xl:hidden">
            <Select value={reportId} onValueChange={(v) => setParam('r', v)}>
              <SelectTrigger aria-label="Relatório">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORTS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ul className="hidden space-y-1 xl:block">
            {REPORTS.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setParam('r', r.id)}
                  aria-current={r.id === reportId ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    r.id === reportId ? 'bg-card font-medium shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <FileText className={cn('mt-0.5 size-4 shrink-0', r.id === reportId && 'text-primary')} />
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <Card className="print-area min-w-0 overflow-hidden">
          <div className="border-b p-5">
            <div className="print-only mb-3 text-xs">
              {data.settings.companyName}, StockWise. Gerado em {formatDateTime(new Date())}.
            </div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{definition.title}</h2>
            <p className="text-sm text-muted-foreground">{definition.description}</p>
            {filterSummary.length > 0 && <p className="print-only mt-1 text-xs">{filterSummary.join('; ')}</p>}

            {definition.filters.length > 0 && (
              <div className="no-print mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {definition.filters.includes('from') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="r-from" className="text-xs text-muted-foreground">De</Label>
                    <Input id="r-from" type="date" value={filters.from} onChange={(e) => setParam('de', e.target.value)} />
                  </div>
                )}
                {definition.filters.includes('to') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="r-to" className="text-xs text-muted-foreground">Até</Label>
                    <Input id="r-to" type="date" value={filters.to} onChange={(e) => setParam('ate', e.target.value)} />
                  </div>
                )}
                {definition.filters.includes('categoryId') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Categoria</Label>
                    <Select value={filters.categoryId ?? 'all'} onValueChange={(v) => setParam('categoria', v)}>
                      <SelectTrigger aria-label="Categoria">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {data.categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {definition.filters.includes('supplierId') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                    <Select value={filters.supplierId ?? 'all'} onValueChange={(v) => setParam('fornecedor', v)}>
                      <SelectTrigger aria-label="Fornecedor">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {data.suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {definition.filters.includes('productId') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="r-product" className="text-xs text-muted-foreground">Produto</Label>
                    <div className="flex gap-1">
                      <ProductPicker id="r-product" products={data.products} value={filters.productId ?? ''} onChange={(v) => setParam('produto', v)} placeholder="Todos" />
                      {filters.productId && (
                        <Button variant="ghost" size="sm" onClick={() => setParam('produto', undefined)}>
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {invalidRange ? (
            <p className="p-6 text-center text-sm text-destructive" role="alert">
              A data inicial é posterior à data final. Ajuste o período.
            </p>
          ) : !report || report.rows.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhum dado para os filtros selecionados" description="Amplie o período ou remova filtros." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {report.columns.map((c) => (
                      <TableHead key={c.key} className={cn(isNumeric(c.format) && 'text-right')}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, i) => (
                    <TableRow key={i}>
                      {report.columns.map((c) => (
                        <TableCell key={c.key} className={cn('text-sm', c.key === 'produto' || c.key === 'motivo' ? 'min-w-48' : 'whitespace-nowrap', isNumeric(c.format) && 'tabular text-right', c.key === 'sku' && 'font-mono text-xs')}>
                          {formatCell(row[c.key], c.format)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                {report.totals && (
                  <TableFooter>
                    <TableRow className="hover:bg-transparent">
                      {report.columns.map((c) => (
                        <TableCell key={c.key} className={cn('text-sm font-semibold', isNumeric(c.format) && 'tabular text-right')}>
                          {report.totals![c.key] !== undefined ? formatCell(report.totals![c.key], c.format) : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              <p className="border-t px-5 py-3 text-xs text-muted-foreground">{formatNumber(report.rows.length)} linha(s)</p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
