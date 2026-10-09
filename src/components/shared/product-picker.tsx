import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Product } from '@/domain/entities'
import { formatNumber } from '@/lib/format'
import { cn, matchesSearch } from '@/lib/utils'

interface ProductPickerProps {
  id?: string
  products: Product[]
  value: string
  onChange: (productId: string) => void
  placeholder?: string
  invalid?: boolean
  disabledIds?: string[]
}

/** Combobox pesquisável de produtos (nome, SKU ou código de barras). */
export function ProductPicker({ id, products, value, onChange, placeholder = 'Selecione um produto', invalid, disabledIds = [] }: ProductPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = products.find((p) => p.id === value)
  const filtered = useMemo(
    () => products.filter((p) => matchesSearch(query, p.name, p.sku, p.barcode)).slice(0, 50),
    [products, query],
  )

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{selected.sku}</span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <div className="border-b p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, SKU ou código"
            aria-label="Buscar produto"
            className="h-8 w-full rounded-md bg-muted px-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div role="listbox" className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
          ) : (
            filtered.map((p) => {
              const disabled = disabledIds.includes(p.id) && p.id !== value
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={p.id === value}
                  disabled={disabled}
                  onClick={() => {
                    onChange(p.id)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-40',
                  )}
                >
                  <Check className={cn('size-4 shrink-0', p.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                  </span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatNumber(p.quantity)} {p.unit}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
