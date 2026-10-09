import type {
  ActivityAction,
  ActivityEntity,
  MovementType,
  PurchaseOrderStatus,
  Unit,
} from '@/domain/entities'
import type { StockStatus } from '@/domain/rules'

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  in: 'Entrada',
  out: 'Saída',
  adjust_in: 'Ajuste positivo',
  adjust_out: 'Ajuste negativo',
}

export const ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  approved: 'Aprovado',
  partially_received: 'Parcialmente recebido',
  received: 'Recebido',
  cancelled: 'Cancelado',
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Normal',
  low: 'Estoque baixo',
  out: 'Sem estoque',
  over: 'Acima do máximo',
}

export const UNIT_LABEL: Record<Unit, string> = {
  un: 'Unidade (un)',
  cx: 'Caixa (cx)',
  pct: 'Pacote (pct)',
  kg: 'Quilograma (kg)',
  g: 'Grama (g)',
  l: 'Litro (l)',
  ml: 'Mililitro (ml)',
  m: 'Metro (m)',
  rolo: 'Rolo',
  par: 'Par',
  resma: 'Resma',
}

export const ACTIVITY_ENTITY_LABEL: Record<ActivityEntity, string> = {
  product: 'Produto',
  category: 'Categoria',
  supplier: 'Fornecedor',
  movement: 'Movimentação',
  purchase_order: 'Pedido de compra',
  settings: 'Configurações',
  system: 'Sistema',
}

export const ACTIVITY_ACTION_LABEL: Record<ActivityAction, string> = {
  created: 'Criação',
  updated: 'Edição',
  deleted: 'Exclusão',
  activated: 'Ativação',
  deactivated: 'Inativação',
  stock_in: 'Entrada',
  stock_out: 'Saída',
  stock_adjusted: 'Ajuste',
  submitted: 'Envio para aprovação',
  approved: 'Aprovação',
  received: 'Recebimento',
  cancelled: 'Cancelamento',
  imported: 'Importação',
  reset: 'Restauração',
}

/** Motivos sugeridos por tipo de movimentação. */
export const MOVEMENT_REASONS: Record<MovementType, string[]> = {
  in: ['Compra', 'Devolução de cliente', 'Transferência recebida', 'Saldo inicial'],
  out: ['Venda', 'Consumo interno', 'Transferência enviada', 'Devolução ao fornecedor'],
  adjust_in: ['Sobra no inventário', 'Correção de lançamento'],
  adjust_out: ['Falta no inventário', 'Avaria', 'Vencimento', 'Correção de lançamento'],
}
