import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useSettings } from '@/app/store'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  /** Valor usado na ordenação; sem ele, a coluna não é ordenável. */
  sortValue?: (row: T) => string | number | null
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Oculta a coluna em telas menores. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export interface SortState {
  id: string
  direction: 'asc' | 'desc'
}

interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  initialSort?: SortState
  onRowClick?: (row: T) => void
  empty: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }
  /** Reinicia a paginação quando muda (ex.: filtros). */
  resetKey?: string
  caption?: string
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

export function DataTable<T>({ rows, columns, getRowId, initialSort, onRowClick, empty, resetKey, caption }: DataTableProps<T>) {
  const { pageSize, compactTables } = useSettings()
  const [sort, setSort] = useState<SortState | undefined>(initialSort)
  const [page, setPage] = useState(0)

  useEffect(() => setPage(0), [resetKey, pageSize])

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.id === sort.id)
    if (!column?.sortValue) return rows
    const get = column.sortValue
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va === vb) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
      return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * factor
    })
  }, [rows, columns, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (id: string) => {
    setSort((prev) =>
      prev?.id === id ? (prev.direction === 'asc' ? { id, direction: 'desc' } : undefined) : { id, direction: 'asc' },
    )
  }

  if (rows.length === 0) return <EmptyState {...empty} />

  return (
    <div>
      <Table className={cn(compactTables && '[&_td]:py-1.5')}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const active = sort?.id === col.id
              const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideBelow && HIDE[col.hideBelow],
                    col.className,
                  )}
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.id)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded hover:text-foreground',
                        active && 'text-foreground',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {col.header}
                      <Icon className={cn('size-3', !active && 'opacity-40')} />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => (
            <TableRow
              key={getRowId(row)}
              className={cn(onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? (e) => {
                if ((e.target as HTMLElement).closest('button, a, [role=menuitem], input')) return
                onRowClick(row)
              } : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideBelow && HIDE[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-col items-center justify-between gap-2 border-t px-5 py-3 text-sm text-muted-foreground sm:flex-row">
        <p className="tabular">
          {formatNumber(current * pageSize + 1)}–{formatNumber(Math.min(sorted.length, (current + 1) * pageSize))} de{' '}
          {formatNumber(sorted.length)}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Página anterior">
            <ChevronLeft />
          </Button>
          <span className="tabular min-w-20 text-center">
            Página {current + 1} de {pageCount}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1} aria-label="Próxima página">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
