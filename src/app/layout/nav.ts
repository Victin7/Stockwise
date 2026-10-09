import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  Tags,
  Truck,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/produtos', label: 'Produtos', icon: Package },
      { to: '/categorias', label: 'Categorias', icon: Tags },
    ],
  },
  {
    label: 'Operação',
    items: [
      { to: '/estoque', label: 'Estoque e movimentações', icon: Boxes },
      { to: '/fornecedores', label: 'Fornecedores', icon: Truck },
      { to: '/pedidos', label: 'Pedidos de compra', icon: ClipboardList },
    ],
  },
  {
    label: 'Análise',
    items: [
      { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
      { to: '/atividades', label: 'Histórico de atividades', icon: History },
    ],
  },
  {
    label: 'Sistema',
    items: [{ to: '/configuracoes', label: 'Configurações', icon: Settings }],
  },
]
