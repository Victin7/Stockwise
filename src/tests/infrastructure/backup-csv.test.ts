import { describe, expect, it } from 'vitest'
import { buildReport } from '@/domain/services/reports.service'
import { exportBackup, parseBackup } from '@/infrastructure/storage/backup'
import { buildSeedData } from '@/infrastructure/storage/seed'
import { escapeCsvValue, toCsv } from '@/lib/csv'
import { buildFixture, createTestContext } from '../helpers'

describe('exportação e importação de backup', () => {
  it('faz o ciclo completo exportar → importar sem perdas', () => {
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx, 7)
    const json = exportBackup(data, new Date('2026-10-01T00:00:00Z'))
    const res = parseBackup(json)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data).toEqual(data)
    expect(res.summary).toMatchObject({ products: 1, movements: 1, exportedAt: '2026-10-01T00:00:00.000Z', migratedFrom: null })
  })

  it('aceita o objeto de dados sem envelope', () => {
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx)
    expect(parseBackup(JSON.stringify(data)).ok).toBe(true)
  })

  it('rejeita JSON inválido, formato desconhecido e dados inconsistentes', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: 'O arquivo não é um JSON válido.' })
    expect(parseBackup(JSON.stringify({ format: 'outro', data: {} })).ok).toBe(false)
    const { ctx } = createTestContext()
    const { data } = buildFixture(ctx)
    const dup = { ...data, products: [...data.products, { ...data.products[0]!, id: 'outro' }] }
    const res = parseBackup(JSON.stringify(dup))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/SKU duplicado/)
  })
})

describe('CSV', () => {
  it('escapa vírgulas, aspas e quebras de linha', () => {
    expect(escapeCsvValue('simples')).toBe('simples')
    expect(escapeCsvValue('a,b')).toBe('"a,b"')
    expect(escapeCsvValue('diz "olá"')).toBe('"diz ""olá"""')
    expect(escapeCsvValue('linha1\nlinha2')).toBe('"linha1\nlinha2"')
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(12.5)).toBe('12.5')
  })

  it('gera arquivo UTF-8 com BOM, cabeçalho e CRLF', () => {
    const csv = toCsv([{ key: 'nome', label: 'Nome' }, { key: 'obs', label: 'Observação' }], [{ nome: 'Café, 500 g', obs: 'ok' }])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿Nome,Observação\r\n"Café, 500 g",ok')
  })
})

describe('relatórios', () => {
  it('gera relatórios coerentes com os dados', () => {
    const now = new Date('2026-10-09T15:00:00')
    const data = buildSeedData(now)
    const position = buildReport(data, 'stock-position', {})
    expect(position.rows).toHaveLength(data.products.filter((p) => p.active).length)
    expect(position.totals!.valor).toBe(position.rows.reduce((s, r) => s + Number(r.valor), 0))
    const out = buildReport(data, 'out-of-stock', {})
    expect(out.rows.length).toBe(data.products.filter((p) => p.active && p.quantity === 0).length)
    const flow = buildReport(data, 'flow-by-period', { from: '2026-01-01', to: '2026-12-31' })
    const net = data.products.reduce((s, p) => s + p.quantity, 0)
    expect(flow.totals!.variacao).toBe(net)
  })
})
