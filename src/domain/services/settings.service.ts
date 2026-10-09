import type { AppData, Settings } from '@/domain/entities'
import { DomainError } from '@/domain/rules'
import { describeZodError, settingsSchema } from '@/domain/schemas'
import { type DomainContext, logActivity } from './context'

const FIELD_LABEL: Record<keyof Settings, string> = {
  companyName: 'nome da empresa',
  currency: 'moeda',
  defaultLowStockThreshold: 'estoque mínimo padrão',
  expiryWarningDays: 'antecedência de vencimento',
  theme: 'tema',
  pageSize: 'itens por página',
  compactTables: 'tabelas compactas',
  responsibleName: 'responsável',
}

export function updateSettings(data: AppData, input: Settings, ctx: DomainContext): AppData {
  const parsed = settingsSchema.safeParse({ ...input, companyName: input.companyName.trim(), responsibleName: input.responsibleName.trim() })
  if (!parsed.success) throw new DomainError(`Configuração inválida: ${describeZodError(parsed.error)}`)
  const next = parsed.data as Settings
  const changed = (Object.keys(FIELD_LABEL) as (keyof Settings)[]).filter((k) => next[k] !== data.settings[k])
  if (changed.length === 0) return data
  return logActivity({ ...data, settings: next }, ctx, {
    action: 'updated',
    entity: 'settings',
    entityId: null,
    summary: `Configurações alteradas: ${changed.map((k) => FIELD_LABEL[k]).join(', ')}.`,
  })
}
