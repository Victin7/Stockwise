import { addDays, setHours, setMinutes, startOfDay, subDays } from 'date-fns'
import type { AppData, ID, MovementType, Settings, Unit } from '@/domain/entities'
import type { DomainContext } from '@/domain/services/context'
import { createCategory } from '@/domain/services/categories.service'
import { registerMovement } from '@/domain/services/inventory.service'
import { createProduct } from '@/domain/services/products.service'
import {
  changeOrderStatus,
  createOrder,
  receiveOrder,
} from '@/domain/services/purchase-orders.service'
import { createSupplier, setSupplierActive } from '@/domain/services/suppliers.service'
import { createId } from '@/lib/id'
import { toDayString } from '@/lib/format'
import { CURRENT_SCHEMA_VERSION } from './migrations'

/**
 * Dados de demonstração — TODOS FICTÍCIOS.
 *
 * O seed é construído aplicando as próprias operações de domínio em ordem
 * cronológica, o que garante que saldos, movimentações, pedidos e histórico
 * sejam coerentes entre si (e exercita as regras de negócio).
 */

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'Armazém Horizonte',
  currency: 'BRL',
  defaultLowStockThreshold: 10,
  expiryWarningDays: 30,
  theme: 'system',
  pageSize: 10,
  compactTables: false,
  responsibleName: 'Ana Ribeiro',
}

export function createEmptyData(settings: Settings = DEFAULT_SETTINGS): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    products: [],
    categories: [],
    suppliers: [],
    movements: [],
    purchaseOrders: [],
    activity: [],
    settings: { ...settings },
    processedOperations: [],
    sequences: { purchaseOrder: 0 },
  }
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
function createRandom(seed: number) {
  let a = seed
  const next = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  }
}

const CATEGORIES = [
  { key: 'pap', name: 'Escritório e Papelaria', color: '#3B6FD8', description: 'Papéis, escrita e organização de escritório.' },
  { key: 'inf', name: 'Informática', color: '#7C5CD6', description: 'Periféricos, cabos e armazenamento.' },
  { key: 'lim', name: 'Limpeza e Higiene', color: '#1FA39A', description: 'Produtos de limpeza e descartáveis de higiene.' },
  { key: 'ali', name: 'Alimentos e Bebidas', color: '#E0912B', description: 'Copa e itens perecíveis.' },
  { key: 'emb', name: 'Embalagens', color: '#A07850', description: 'Caixas, fitas e proteção para expedição.' },
  { key: 'fer', name: 'Ferramentas', color: '#5F6B7A', description: 'Ferramentas manuais, elétricas e acessórios.' },
  { key: 'ele', name: 'Material Elétrico', color: '#C99A06', description: 'Iluminação, proteção e instalação elétrica.' },
  { key: 'epi', name: 'EPI e Segurança', color: '#D2553F', description: 'Equipamentos de proteção individual.' },
] as const
type CategoryKey = (typeof CATEGORIES)[number]['key']

const SUPPLIERS = [
  { key: 'atl', companyName: 'Papelaria Atlântida Ltda', contactName: 'Marina Couto', email: 'vendas@atlantida.example', phone: '(11) 4002-1180', cnpj: '12.345.678/0001-90', address: 'Rua das Acácias, 120 — Vila Fictícia, São Paulo/SP', notes: 'Entrega às terças e quintas.', active: true },
  { key: 'tec', companyName: 'TecnoVértice Informática Ltda', contactName: 'Rafael Moura', email: 'comercial@tecnovertice.example', phone: '(11) 4003-2291', cnpj: '23.456.789/0001-01', address: 'Av. dos Circuitos, 845 — Distrito Exemplo, Campinas/SP', notes: 'Pedido mínimo de R$ 500,00.', active: true },
  { key: 'lim', companyName: 'Limpa Mais Distribuidora', contactName: 'Juliana Prado', email: 'pedidos@limpamais.example', phone: '(11) 4004-3302', cnpj: '34.567.890/0001-12', address: 'Rua do Sabão, 77 — Jardim Modelo, Guarulhos/SP', notes: 'Também fornece EPIs.', active: true },
  { key: 'sab', companyName: 'Sabor do Vale Alimentos', contactName: 'Otávio Lins', email: 'atendimento@sabordovale.example', phone: '(19) 4005-4413', cnpj: '45.678.901/0001-23', address: 'Estrada do Pomar, km 4 — Vale Imaginário, Jundiaí/SP', notes: 'Validade mínima de 90 dias na entrega.', active: true },
  { key: 'nsu', companyName: 'Norte Sul Embalagens', contactName: 'Camila Teixeira', email: 'vendas@nortesul.example', phone: '(11) 4006-5524', cnpj: '56.789.012/0001-34', address: 'Rua da Expedição, 300 — Polo Exemplo, Barueri/SP', notes: '', active: true },
  { key: 'cap', companyName: 'Ferragens Capivara', contactName: 'Diego Ramalho', email: 'loja@capivara.example', phone: '(11) 4007-6635', cnpj: '67.890.123/0001-45', address: 'Av. do Ferro, 1500 — Centro Fictício, Osasco/SP', notes: 'Aceita devolução em até 7 dias.', active: true },
  { key: 'vol', companyName: 'Voltz Materiais Elétricos', contactName: 'Patrícia Nunes', email: 'contato@voltz.example', phone: '(11) 4008-7746', cnpj: '78.901.234/0001-56', address: 'Rua da Corrente, 64 — Bairro Teste, Santo André/SP', notes: '', active: true },
  { key: 'cer', companyName: 'Distribuidora Cerrado Ltda', contactName: 'Henrique Sales', email: 'contato@cerrado.example', phone: '(62) 4009-8857', cnpj: null, address: 'Quadra Exemplo, Lote 9 — Goiânia/GO', notes: 'Fornecedor desativado após atrasos recorrentes.', active: true },
] as const
type SupplierKey = (typeof SUPPLIERS)[number]['key']

type Profile = 'ok' | 'low' | 'out'

interface SeedProduct {
  sku: string
  name: string
  cat: CategoryKey
  unit: Unit
  cost: number
  price: number
  min: number
  max?: number
  sup: SupplierKey
  barcode?: string
  /** Validade em dias a partir de hoje. */
  expiry?: number
  profile: Profile
  description: string
}

const PRODUCTS: SeedProduct[] = [
  { sku: 'PAP-0001', name: 'Papel sulfite A4 75 g', cat: 'pap', unit: 'resma', cost: 24.9, price: 34.9, min: 40, max: 300, sup: 'atl', barcode: '7891000100013', profile: 'low', description: 'Resma com 500 folhas, alvura 90%.' },
  { sku: 'PAP-0002', name: 'Caneta esferográfica azul (cx 50)', cat: 'pap', unit: 'cx', cost: 38, price: 55, min: 10, sup: 'atl', profile: 'ok', description: 'Ponta média 1.0 mm.' },
  { sku: 'PAP-0003', name: 'Grampeador médio 26/6', cat: 'pap', unit: 'un', cost: 19.5, price: 32.9, min: 8, sup: 'atl', profile: 'ok', description: 'Capacidade para 25 folhas.' },
  { sku: 'PAP-0004', name: 'Bloco adesivo 76 × 76 mm', cat: 'pap', unit: 'pct', cost: 6.2, price: 11.9, min: 30, sup: 'atl', profile: 'ok', description: 'Pacote com 4 blocos de 100 folhas.' },
  { sku: 'INF-0001', name: 'Mouse óptico USB', cat: 'inf', unit: 'un', cost: 12.9, price: 29.9, min: 15, sup: 'tec', barcode: '7891000200010', profile: 'low', description: '1200 dpi, cabo de 1,5 m.' },
  { sku: 'INF-0002', name: 'Teclado ABNT2 USB', cat: 'inf', unit: 'un', cost: 34, price: 69.9, min: 10, sup: 'tec', profile: 'ok', description: 'Teclas silenciosas, resistente a respingos.' },
  { sku: 'INF-0003', name: 'Cabo HDMI 2 m', cat: 'inf', unit: 'un', cost: 11.5, price: 27.9, min: 20, sup: 'tec', profile: 'ok', description: 'Versão 2.0, suporte a 4K.' },
  { sku: 'INF-0004', name: 'Pen drive 32 GB', cat: 'inf', unit: 'un', cost: 22, price: 44.9, min: 15, sup: 'tec', barcode: '7891000200041', profile: 'out', description: 'USB 3.0.' },
  { sku: 'LIM-0001', name: 'Detergente neutro 500 ml', cat: 'lim', unit: 'un', cost: 1.89, price: 3.49, min: 60, sup: 'lim', expiry: 20, profile: 'low', description: 'Biodegradável.' },
  { sku: 'LIM-0002', name: 'Álcool 70% 1 l', cat: 'lim', unit: 'un', cost: 6.4, price: 11.9, min: 40, sup: 'lim', expiry: 300, profile: 'ok', description: 'Uso geral para limpeza de superfícies.' },
  { sku: 'LIM-0003', name: 'Papel toalha interfolha', cat: 'lim', unit: 'pct', cost: 9.8, price: 16.9, min: 50, sup: 'lim', profile: 'ok', description: 'Pacote com 1000 folhas.' },
  { sku: 'LIM-0004', name: 'Saco de lixo 100 l', cat: 'lim', unit: 'pct', cost: 14.2, price: 24.9, min: 25, sup: 'lim', profile: 'ok', description: 'Pacote com 100 unidades, reforçado.' },
  { sku: 'ALI-0001', name: 'Café torrado e moído 500 g', cat: 'ali', unit: 'pct', cost: 15.9, price: 27.9, min: 30, sup: 'sab', barcode: '7891000400017', expiry: 95, profile: 'ok', description: 'Torra média, embalagem a vácuo.' },
  { sku: 'ALI-0002', name: 'Açúcar refinado 1 kg', cat: 'ali', unit: 'pct', cost: 4.2, price: 6.99, min: 40, sup: 'sab', expiry: 200, profile: 'ok', description: '' },
  { sku: 'ALI-0003', name: 'Água mineral 500 ml (cx 12)', cat: 'ali', unit: 'cx', cost: 9.6, price: 18, min: 20, sup: 'sab', expiry: 18, profile: 'ok', description: 'Sem gás.' },
  { sku: 'ALI-0004', name: 'Biscoito cream cracker 200 g', cat: 'ali', unit: 'pct', cost: 3.1, price: 5.99, min: 40, sup: 'sab', expiry: 60, profile: 'out', description: '' },
  { sku: 'EMB-0001', name: 'Caixa de papelão 40 × 30 × 20 cm', cat: 'emb', unit: 'un', cost: 2.35, price: 4.5, min: 100, max: 800, sup: 'nsu', profile: 'low', description: 'Onda simples.' },
  { sku: 'EMB-0002', name: 'Fita adesiva transparente 45 mm', cat: 'emb', unit: 'rolo', cost: 4.1, price: 8.9, min: 60, sup: 'nsu', profile: 'ok', description: 'Rolo com 100 m.' },
  { sku: 'EMB-0003', name: 'Plástico bolha 1 m × 100 m', cat: 'emb', unit: 'rolo', cost: 89, price: 149, min: 5, sup: 'nsu', profile: 'ok', description: '' },
  { sku: 'EMB-0004', name: 'Envelope kraft A4 (pct 50)', cat: 'emb', unit: 'pct', cost: 18, price: 32, min: 15, sup: 'nsu', profile: 'ok', description: '' },
  { sku: 'FER-0001', name: 'Trena de aço 5 m', cat: 'fer', unit: 'un', cost: 14.8, price: 29.9, min: 10, sup: 'cap', profile: 'ok', description: 'Trava automática.' },
  { sku: 'FER-0002', name: 'Jogo de chaves de fenda (6 peças)', cat: 'fer', unit: 'un', cost: 27.5, price: 54.9, min: 6, sup: 'cap', profile: 'ok', description: 'Fenda e Phillips.' },
  { sku: 'FER-0003', name: 'Furadeira de impacto 650 W', cat: 'fer', unit: 'un', cost: 189, price: 329, min: 3, max: 15, sup: 'cap', barcode: '7891000600011', profile: 'ok', description: 'Mandril de 13 mm, 127 V.' },
  { sku: 'FER-0004', name: 'Broca aço rápido 8 mm', cat: 'fer', unit: 'un', cost: 6.9, price: 14.9, min: 20, sup: 'cap', profile: 'out', description: '' },
  { sku: 'ELE-0001', name: 'Lâmpada LED bulbo 9 W', cat: 'ele', unit: 'un', cost: 5.4, price: 12.9, min: 50, sup: 'vol', profile: 'ok', description: 'Luz branca 6500 K, bivolt.' },
  { sku: 'ELE-0002', name: 'Fita isolante 19 mm × 20 m', cat: 'ele', unit: 'rolo', cost: 2.9, price: 6.5, min: 40, sup: 'vol', profile: 'out', description: 'Antichama.' },
  { sku: 'ELE-0003', name: 'Tomada 2P+T 10 A', cat: 'ele', unit: 'un', cost: 7.8, price: 15.9, min: 30, sup: 'vol', profile: 'ok', description: 'Padrão NBR 14136.' },
  { sku: 'ELE-0004', name: 'Disjuntor monopolar 20 A', cat: 'ele', unit: 'un', cost: 16.5, price: 32, min: 12, sup: 'vol', profile: 'low', description: 'Curva C.' },
  { sku: 'EPI-0001', name: 'Luva nitrílica (cx 100)', cat: 'epi', unit: 'cx', cost: 32, price: 58, min: 20, sup: 'lim', expiry: 400, profile: 'low', description: 'Tamanho M, sem pó.' },
  { sku: 'EPI-0002', name: 'Máscara PFF2', cat: 'epi', unit: 'un', cost: 2.4, price: 5.9, min: 100, sup: 'lim', expiry: 12, profile: 'ok', description: 'Com válvula, CA fictício.' },
  { sku: 'EPI-0003', name: 'Óculos de proteção incolor', cat: 'epi', unit: 'un', cost: 8.7, price: 18.9, min: 15, sup: 'lim', profile: 'ok', description: 'Lente antirrisco.' },
  { sku: 'EPI-0004', name: 'Protetor auricular tipo plug', cat: 'epi', unit: 'par', cost: 1.3, price: 3.5, min: 80, sup: 'lim', profile: 'ok', description: 'Silicone, com cordão.' },
]

const AISLES: Record<CategoryKey, string> = { pap: 'A', inf: 'B', lim: 'C', ali: 'D', emb: 'E', fer: 'F', ele: 'G', epi: 'H' }
const RESPONSIBLES = ['Ana Ribeiro', 'Bruno Tavares', 'Carla Menezes', 'Diego Farias'] as const
const OUT_REASONS = ['Venda', 'Venda', 'Venda', 'Consumo interno', 'Transferência enviada'] as const

interface SeedOrder {
  sup: SupplierKey
  created: number
  expectedIn: number
  items: { sku: string; qty: number }[]
  notes: string
  /** Sequência de eventos: dia relativo e ação. */
  flow: (
    | { day: number; action: 'submit' | 'approve' }
    | { day: number; action: 'cancel'; reason: string }
    | { day: number; action: 'receive'; lines: Record<string, number> }
  )[]
}

const ORDERS: SeedOrder[] = [
  { sup: 'atl', created: -72, expectedIn: 7, notes: 'Reposição trimestral de papelaria.', items: [{ sku: 'PAP-0001', qty: 200 }, { sku: 'PAP-0004', qty: 60 }], flow: [{ day: -71, action: 'submit' }, { day: -70, action: 'approve' }, { day: -64, action: 'receive', lines: { 'PAP-0001': 200, 'PAP-0004': 60 } }] },
  { sup: 'tec', created: -58, expectedIn: 10, notes: '', items: [{ sku: 'INF-0001', qty: 40 }, { sku: 'INF-0002', qty: 20 }, { sku: 'INF-0003', qty: 30 }], flow: [{ day: -58, action: 'submit' }, { day: -57, action: 'approve' }, { day: -50, action: 'receive', lines: { 'INF-0001': 40, 'INF-0002': 20, 'INF-0003': 30 } }] },
  { sup: 'cer', created: -47, expectedIn: 10, notes: 'Cotação alternativa para tomadas.', items: [{ sku: 'ELE-0003', qty: 50 }], flow: [{ day: -47, action: 'submit' }, { day: -44, action: 'cancel', reason: 'Prazo de entrega incompatível.' }] },
  { sup: 'lim', created: -42, expectedIn: 6, notes: '', items: [{ sku: 'LIM-0001', qty: 120 }, { sku: 'LIM-0002', qty: 60 }], flow: [{ day: -42, action: 'submit' }, { day: -41, action: 'approve' }, { day: -37, action: 'receive', lines: { 'LIM-0001': 120, 'LIM-0002': 60 } }] },
  { sup: 'sab', created: -31, expectedIn: 5, notes: 'Itens de copa.', items: [{ sku: 'ALI-0001', qty: 50 }, { sku: 'ALI-0002', qty: 60 }], flow: [{ day: -31, action: 'submit' }, { day: -30, action: 'approve' }, { day: -26, action: 'receive', lines: { 'ALI-0001': 50, 'ALI-0002': 60 } }] },
  { sup: 'nsu', created: -21, expectedIn: 7, notes: 'Entrega fracionada combinada com o fornecedor.', items: [{ sku: 'EMB-0001', qty: 300 }, { sku: 'EMB-0002', qty: 120 }], flow: [{ day: -21, action: 'submit' }, { day: -20, action: 'approve' }, { day: -13, action: 'receive', lines: { 'EMB-0001': 150, 'EMB-0002': 120 } }] },
  { sup: 'cap', created: -16, expectedIn: 6, notes: '', items: [{ sku: 'FER-0003', qty: 6 }, { sku: 'FER-0001', qty: 15 }], flow: [{ day: -16, action: 'submit' }, { day: -15, action: 'approve' }, { day: -9, action: 'receive', lines: { 'FER-0003': 2 } }] },
  { sup: 'vol', created: -9, expectedIn: 5, notes: '', items: [{ sku: 'ELE-0004', qty: 30 }, { sku: 'ELE-0001', qty: 100 }], flow: [{ day: -9, action: 'submit' }, { day: -8, action: 'approve' }] },
  { sup: 'lim', created: -5, expectedIn: 7, notes: 'Urgente: estoque de luvas abaixo do mínimo.', items: [{ sku: 'EPI-0001', qty: 40 }, { sku: 'EPI-0002', qty: 300 }], flow: [{ day: -5, action: 'submit' }, { day: -4, action: 'approve' }] },
  { sup: 'tec', created: -3, expectedIn: 10, notes: '', items: [{ sku: 'INF-0004', qty: 50 }], flow: [{ day: -3, action: 'submit' }] },
  { sup: 'sab', created: -2, expectedIn: 4, notes: '', items: [{ sku: 'ALI-0004', qty: 80 }, { sku: 'ALI-0003', qty: 30 }], flow: [{ day: -2, action: 'submit' }] },
  { sup: 'atl', created: -1, expectedIn: 8, notes: 'Aguardando cotação de grampeadores.', items: [{ sku: 'PAP-0002', qty: 10 }, { sku: 'PAP-0003', qty: 12 }], flow: [] },
  { sup: 'cap', created: 0, expectedIn: 9, notes: '', items: [{ sku: 'FER-0004', qty: 60 }], flow: [] },
]

type TimelineStep = { at: Date; order: number; run: (data: AppData, ctx: DomainContext) => AppData }

/**
 * Gera o conjunto completo de dados de demonstração relativo à data `now`.
 */
export function buildSeedData(now: Date = new Date(), randomSeed = 20261009): AppData {
  // Algumas passadas ajustam o saldo inicial de cada produto para que o perfil
  // desejado (normal, baixo, sem estoque) seja atingido sem grandes lançamentos
  // de correção no fim do período.
  const adjust: Record<string, number> = {}
  let result = simulate(now, randomSeed, adjust)
  for (let pass = 0; pass < 4 && Object.values(result.residual).some((v) => v !== 0); pass++) {
    for (const [sku, delta] of Object.entries(result.residual)) adjust[sku] = (adjust[sku] ?? 0) + delta
    result = simulate(now, randomSeed, adjust)
  }
  return result.data
}

function simulate(
  now: Date,
  randomSeed: number,
  adjust: Record<string, number>,
): { data: AppData; residual: Record<string, number> } {
  const rnd = createRandom(randomSeed)
  const rndTarget = createRandom(randomSeed + 7919)
  const rndClose = createRandom(randomSeed + 104729)
  const targets = Object.fromEntries(
    PRODUCTS.map((p) => [
      p.sku,
      p.profile === 'out'
        ? 0
        : p.profile === 'low'
          ? Math.max(1, Math.round((p.min * rndTarget.int(35, 90)) / 100))
          : Math.min(p.max ?? Number.MAX_SAFE_INTEGER, Math.round((p.min * rndTarget.int(16, 34)) / 10)),
    ]),
  )
  let clock = now
  const ctx: DomainContext = { now: () => clock, newId: createId }
  const today = startOfDay(now)
  const at = (day: number, hour = rnd.int(8, 17), minute = rnd.int(0, 59)) => {
    const d = setMinutes(setHours(addDays(today, day), hour), minute)
    return d > now ? now : d
  }

  let data = createEmptyData()
  clock = subDays(today, 90)

  const categoryIds = {} as Record<CategoryKey, ID>
  for (const c of CATEGORIES) {
    const res = createCategory(data, { name: c.name, description: c.description, color: c.color }, ctx)
    data = res.data
    categoryIds[c.key] = res.category.id
  }
  const supplierIds = {} as Record<SupplierKey, ID>
  for (const s of SUPPLIERS) {
    const { key: _key, ...input } = s
    const res = createSupplier(data, { ...input, cnpj: input.cnpj }, ctx)
    data = res.data
    supplierIds[s.key] = res.supplier.id
  }
  const productIds: Record<string, ID> = {}
  PRODUCTS.forEach((p, index) => {
    const res = createProduct(
      data,
      {
        sku: p.sku,
        name: p.name,
        description: p.description,
        categoryId: categoryIds[p.cat],
        unit: p.unit,
        unitCost: Math.round(p.cost * 100),
        salePrice: Math.round(p.price * 100),
        minStock: p.min,
        maxStock: p.max ?? null,
        supplierId: supplierIds[p.sup],
        location: `${AISLES[p.cat]}-${String((index % 4) + 1).padStart(2, '0')}-${String(rnd.int(1, 4)).padStart(2, '0')}`,
        barcode: p.barcode ?? null,
        expiryDate: p.expiry !== undefined ? toDayString(addDays(today, p.expiry)) : null,
        active: true,
        initialQuantity: 0,
        operationId: createId(),
        responsible: DEFAULT_SETTINGS.responsibleName,
      },
      ctx,
    )
    data = res.data
    productIds[p.sku] = res.product.id
  })

  // Monta a linha do tempo de movimentações e pedidos
  const steps: TimelineStep[] = []
  let seq = 0
  const balanceOf = (d: AppData, sku: string) => d.products.find((p) => p.id === productIds[sku])?.quantity ?? 0
  const move = (sku: string, type: MovementType, qty: number, reason: string, responsible: string, notes = '') =>
    (d: AppData, c: DomainContext): AppData => {
      const available = balanceOf(d, sku)
      const quantity = type === 'out' || type === 'adjust_out' ? Math.min(qty, available) : qty
      if (quantity <= 0) return d
      return registerMovement(
        d,
        { operationId: createId(), productId: productIds[sku]!, type, quantity, reason, responsible, notes, occurredAt: c.now().toISOString() },
        c,
      ).data
    }

  for (const p of PRODUCTS) {
    const base = Math.round(p.min * (p.profile === 'ok' ? rnd.int(25, 40) / 10 : rnd.int(18, 26) / 10))
    const initial = Math.max(1, base + (adjust[p.sku] ?? 0))
    steps.push({ at: at(-rnd.int(80, 86)), order: seq++, run: move(p.sku, 'in', initial, 'Saldo inicial', RESPONSIBLES[0], 'Carga inicial do inventário') })
    const outs = rnd.int(3, 5)
    for (let i = 0; i < outs; i++) {
      const qty = Math.max(1, Math.round(p.min * rnd.int(3, 9) / 10))
      steps.push({ at: at(-rnd.int(2, 75)), order: seq++, run: move(p.sku, 'out', qty, rnd.pick(OUT_REASONS), rnd.pick(RESPONSIBLES)) })
    }
    if (rnd.next() < 0.25) {
      steps.push({ at: at(-rnd.int(5, 60)), order: seq++, run: move(p.sku, 'adjust_out', Math.max(1, Math.round(p.min * 0.05)), rnd.pick(['Avaria', 'Falta no inventário']), RESPONSIBLES[2], 'Constatado na contagem cíclica.') })
    }
    if (rnd.next() < 0.12) {
      steps.push({ at: at(-rnd.int(5, 60)), order: seq++, run: move(p.sku, 'adjust_in', Math.max(1, Math.round(p.min * 0.05)), 'Sobra no inventário', RESPONSIBLES[2]) })
    }
  }

  ORDERS.forEach((o) => {
    let orderId: ID | null = null
    steps.push({
      at: at(o.created, 9, rnd.int(0, 30)),
      order: seq++,
      run: (d, c) => {
        const res = createOrder(
          d,
          {
            supplierId: supplierIds[o.sup],
            expectedAt: toDayString(addDays(today, o.created + o.expectedIn)),
            notes: o.notes,
            items: o.items.map((i) => {
              const product = d.products.find((p) => p.id === productIds[i.sku])!
              return { productId: product.id, quantity: i.qty, unitCost: product.unitCost }
            }),
          },
          c,
        )
        orderId = res.order.id
        return res.data
      },
    })
    for (const step of o.flow) {
      steps.push({
        at: at(step.day, step.action === 'receive' ? 14 : 11, rnd.int(0, 59)),
        order: seq++,
        run: (d, c) => {
          if (!orderId) return d
          if (step.action === 'submit') return changeOrderStatus(d, orderId, 'pending', c)
          if (step.action === 'approve') return changeOrderStatus(d, orderId, 'approved', c)
          if (step.action === 'cancel') return changeOrderStatus(d, orderId, 'cancelled', c, step.reason)
          if (step.action !== 'receive') return d
          const lines = step.lines
          const order = d.purchaseOrders.find((x) => x.id === orderId)!
          return receiveOrder(
            d,
            orderId,
            {
              operationId: createId(),
              responsible: RESPONSIBLES[1],
              occurredAt: c.now().toISOString(),
              lines: order.items.map((item) => {
                const sku = Object.keys(productIds).find((k) => productIds[k] === item.productId)!
                return { itemId: item.id, quantity: lines[sku] ?? 0 }
              }),
            },
            c,
          )
        },
      })
    }
  })

  // Fornecedor desativado depois do pedido cancelado (mantém o histórico)
  steps.push({ at: at(-40, 10, 5), order: seq++, run: (d, c) => setSupplierActive(d, supplierIds.cer, false, c) })

  steps.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order)
  for (const step of steps) {
    clock = step.at
    data = step.run(data, ctx)
  }

  // Fechamento: diferença residual em relação ao perfil desejado
  const residual: Record<string, number> = {}
  PRODUCTS.forEach((p, index) => {
    clock = at(index % 3 === 0 ? 0 : -1, rndClose.int(8, 11), rndClose.int(0, 59))
    const current = balanceOf(data, p.sku)
    const target = targets[p.sku]!
    residual[p.sku] = target - current
    if (current > target) {
      data = move(p.sku, 'out', current - target, 'Venda', RESPONSIBLES[index % RESPONSIBLES.length]!)(data, ctx)
    } else if (current < target) {
      data = move(p.sku, 'in', target - current, 'Transferência recebida', RESPONSIBLES[1], 'Transferência da filial demonstrativa.')(data, ctx)
    }
  })

  return { data, residual }
}
