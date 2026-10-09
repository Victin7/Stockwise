import type { ActivityEvent, AppData } from '@/domain/entities'
import { LIMITS } from '@/domain/rules'
import { createId } from '@/lib/id'

/**
 * Dependências injetáveis das operações de domínio.
 * Permite testes determinísticos (relógio e geração de IDs controlados).
 */
export interface DomainContext {
  now: () => Date
  newId: () => string
}

export const defaultContext: DomainContext = {
  now: () => new Date(),
  newId: createId,
}

/** Registra um evento no histórico de atividades (mais recentes primeiro, limitado). */
export function logActivity(
  data: AppData,
  ctx: DomainContext,
  event: Omit<ActivityEvent, 'id' | 'at'> & { at?: string },
): AppData {
  const entry: ActivityEvent = {
    id: ctx.newId(),
    at: event.at ?? ctx.now().toISOString(),
    action: event.action,
    entity: event.entity,
    entityId: event.entityId,
    summary: event.summary,
  }
  return { ...data, activity: [entry, ...data.activity].slice(0, LIMITS.activity) }
}

/** Marca uma operação como processada (proteção contra duplicidade). */
export function markOperation(data: AppData, operationId: string): AppData {
  return {
    ...data,
    processedOperations: [operationId, ...data.processedOperations].slice(0, LIMITS.processedOperations),
  }
}

export function wasProcessed(data: AppData, operationId: string): boolean {
  return (
    data.processedOperations.includes(operationId) ||
    data.movements.some((m) => m.operationId === operationId)
  )
}
