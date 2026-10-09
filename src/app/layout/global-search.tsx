import { ClipboardList, Package, Search, Tags, Truck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppData } from '@/app/store'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { matchesSearch } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Result {
  id: string
  group: string
  icon: typeof Package
  title: string
  detail: string
  to: string
}

/** Busca global: produtos (nome, SKU, código de barras), fornecedores, pedidos e categorias. */
export function GlobalSearch() {
  const data = useAppData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]'))) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo<Result[]>(() => {
    if (query.trim().length < 2) return []
    const products = data.products
      .filter((p) => matchesSearch(query, p.name, p.sku, p.barcode))
      .slice(0, 6)
      .map((p) => ({ id: p.id, group: 'Produtos', icon: Package, title: p.name, detail: `${p.sku}, saldo ${p.quantity} ${p.unit}`, to: `/produtos?ver=${p.id}` }))
    const suppliers = data.suppliers
      .filter((s) => matchesSearch(query, s.companyName, s.contactName, s.cnpj))
      .slice(0, 3)
      .map((s) => ({ id: s.id, group: 'Fornecedores', icon: Truck, title: s.companyName, detail: s.contactName || s.email, to: `/fornecedores?ver=${s.id}` }))
    const orders = data.purchaseOrders
      .filter((o) => matchesSearch(query, o.number))
      .slice(0, 3)
      .map((o) => ({ id: o.id, group: 'Pedidos', icon: ClipboardList, title: o.number, detail: data.suppliers.find((s) => s.id === o.supplierId)?.companyName ?? '', to: `/pedidos?ver=${o.id}` }))
    const categories = data.categories
      .filter((c) => matchesSearch(query, c.name))
      .slice(0, 3)
      .map((c) => ({ id: c.id, group: 'Categorias', icon: Tags, title: c.name, detail: 'Ver produtos da categoria', to: `/produtos?categoria=${c.id}` }))
    return [...products, ...suppliers, ...orders, ...categories]
  }, [query, data])

  useEffect(() => setActive(0), [query])

  const go = (r: Result) => {
    navigate(r.to)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <Popover open={open && query.trim().length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && results[active]) {
                go(results[active])
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder={compact ? 'Buscar…' : 'Buscar produto, SKU, código de barras, fornecedor…'}
            aria-label="Busca global"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls="global-search-results"
            className="h-9 w-full rounded-lg border border-input bg-background pr-12 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
            Ctrl K
          </kbd>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-80 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div id="global-search-results" role="listbox">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum resultado para “{query}”.</p>
          ) : (
            results.map((r, i) => (
              <div key={`${r.group}-${r.id}`}>
                {(i === 0 || results[i - 1]!.group !== r.group) && (
                  <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{r.group}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn('flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm', i === active && 'bg-muted')}
                >
                  <r.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
