import { zodResolver } from '@hookform/resolvers/zod'
import { Database, Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAppData, useAppStore, useStoreApi } from '@/app/store'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FormField } from '@/components/shared/form-field'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { AppData, Settings } from '@/domain/entities'
import { defaultContext, logActivity } from '@/domain/services/context'
import { updateSettings } from '@/domain/services/settings.service'
import { errorMessage, useAction } from '@/hooks/use-action'
import { type BackupSummary, exportBackup, parseBackup } from '@/infrastructure/storage/backup'
import { downloadFile } from '@/lib/csv'
import { formatDateTime, formatNumber, toDayString } from '@/lib/format'

const schema = z.object({
  companyName: z.string().trim().min(2, 'Informe o nome da empresa').max(80),
  responsibleName: z.string().trim().min(2, 'Informe o nome do responsável').max(80),
  defaultLowStockThreshold: z.string().regex(/^\d{1,6}$/, 'Use um inteiro maior ou igual a zero'),
  expiryWarningDays: z
    .string()
    .regex(/^\d{1,3}$/, 'Use um número de dias')
    .refine((v) => Number(v) >= 1 && Number(v) <= 365, 'Entre 1 e 365 dias'),
  theme: z.enum(['light', 'dark', 'system']),
  pageSize: z.enum(['10', '20', '50']),
  compactTables: z.boolean(),
})
type Values = z.infer<typeof schema>

const toValues = (s: Settings): Values => ({
  companyName: s.companyName,
  responsibleName: s.responsibleName,
  defaultLowStockThreshold: String(s.defaultLowStockThreshold),
  expiryWarningDays: String(s.expiryWarningDays),
  theme: s.theme,
  pageSize: String(s.pageSize) as Values['pageSize'],
  compactTables: s.compactTables,
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
  return `${(bytes / 1024 / 1024).toFixed(2).replace('.', ',')} MB`
}

export default function SettingsPage() {
  const data = useAppData()
  const persistent = useAppStore((s) => s.persistent)
  const store = useStoreApi()
  const run = useAction()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{ data: AppData; summary: BackupSummary; fileName: string } | null>(null)
  const [confirm, setConfirm] = useState<'restore' | 'clear' | null>(null)
  const [clearText, setClearText] = useState('')

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(data.settings) })
  const { register, control, handleSubmit, reset, formState } = form
  const { errors, isDirty } = formState

  useEffect(() => reset(toValues(data.settings)), [data.settings, reset])

  const onSubmit = handleSubmit((v) => {
    run(
      (d, ctx) =>
        updateSettings(
          d,
          {
            ...d.settings,
            companyName: v.companyName,
            responsibleName: v.responsibleName,
            defaultLowStockThreshold: Number(v.defaultLowStockThreshold),
            expiryWarningDays: Number(v.expiryWarningDays),
            theme: v.theme,
            pageSize: Number(v.pageSize) as Settings['pageSize'],
            compactTables: v.compactTables,
          },
          ctx,
        ),
      'Configurações salvas.',
    )
  })

  const size = new Blob([JSON.stringify(data)]).size

  const exportAll = () => {
    downloadFile(`stockwise-backup-${toDayString(new Date())}.json`, exportBackup(data), 'application/json')
    toast.success('Backup exportado.')
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const result = parseBackup(text)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setPendingImport({ data: result.data, summary: result.summary, fileName: file.name })
    } catch {
      toast.error('Não foi possível ler o arquivo selecionado.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmImport = () => {
    if (!pendingImport) return
    try {
      const imported = logActivity(pendingImport.data, defaultContext, {
        action: 'imported',
        entity: 'system',
        entityId: null,
        summary: `Backup importado de ${pendingImport.fileName} (${pendingImport.summary.products} produtos, ${pendingImport.summary.movements} movimentações).`,
      })
      store.getState().replaceAll(imported)
      toast.success('Backup importado. Os dados anteriores foram substituídos.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
    setPendingImport(null)
  }

  const doReset = (kind: 'restore' | 'clear') => {
    try {
      if (kind === 'restore') store.getState().restoreDemo()
      else store.getState().clearAll()
      toast.success(kind === 'restore' ? 'Dados de demonstração restaurados.' : 'Dados locais apagados.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
    setConfirm(null)
    setClearText('')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Preferências da empresa demonstrativa, exibição e gerenciamento dos dados locais." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="self-start">
          <form onSubmit={onSubmit} noValidate>
            <CardHeader>
              <div>
                <CardTitle>Empresa e preferências</CardTitle>
                <CardDescription>Alterações ficam registradas no histórico de atividades.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nome da empresa" htmlFor="st-company" required error={errors.companyName?.message}>
                <Input id="st-company" {...register('companyName')} aria-invalid={!!errors.companyName} />
              </FormField>
              <FormField label="Responsável padrão" htmlFor="st-resp" required error={errors.responsibleName?.message} hint="Usado no perfil e nas movimentações">
                <Input id="st-resp" {...register('responsibleName')} aria-invalid={!!errors.responsibleName} />
              </FormField>
              <FormField label="Moeda" htmlFor="st-currency" hint="Nesta versão, somente real brasileiro">
                <Input id="st-currency" value="BRL (R$)" disabled readOnly />
              </FormField>
              <FormField label="Estoque mínimo padrão" htmlFor="st-min" required error={errors.defaultLowStockThreshold?.message} hint="Sugerido ao cadastrar produtos">
                <Input id="st-min" inputMode="numeric" {...register('defaultLowStockThreshold')} aria-invalid={!!errors.defaultLowStockThreshold} />
              </FormField>
              <FormField label="Alerta de vencimento (dias)" htmlFor="st-exp" required error={errors.expiryWarningDays?.message} hint="Antecedência para avisar sobre validade">
                <Input id="st-exp" inputMode="numeric" {...register('expiryWarningDays')} aria-invalid={!!errors.expiryWarningDays} />
              </FormField>
              <FormField label="Tema" htmlFor="st-theme">
                <Controller
                  control={control}
                  name="theme"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="st-theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">Seguir o sistema</SelectItem>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Escuro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Itens por página" htmlFor="st-page">
                <Controller
                  control={control}
                  name="pageSize"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="st-page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <Controller
                control={control}
                name="compactTables"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <span>
                      <span className="block text-sm font-medium">Tabelas compactas</span>
                      <span className="block text-xs text-muted-foreground">Menos espaço entre linhas</span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="outline" disabled={!isDirty} onClick={() => reset(toValues(data.settings))}>
                Descartar
              </Button>
              <Button type="submit" disabled={!isDirty}>
                Salvar configurações
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Dados locais</CardTitle>
                <CardDescription>Tudo fica salvo apenas neste navegador.</CardDescription>
              </div>
              <Database className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                {[
                  ['Produtos', data.products.length],
                  ['Movimentações', data.movements.length],
                  ['Pedidos', data.purchaseOrders.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-muted/50 p-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="tabular font-semibold">{formatNumber(Number(value))}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                Tamanho aproximado: {formatBytes(size)}. Versão do formato: {data.schemaVersion}.{' '}
                {persistent ? 'Armazenamento: localStorage.' : 'Armazenamento indisponível: os dados estão apenas em memória.'}
              </p>
              <div className="grid gap-2">
                <Button variant="outline" onClick={exportAll} className="justify-start">
                  <Download /> Exportar backup (JSON)
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="justify-start">
                  <Upload /> Importar backup
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Selecionar arquivo de backup"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
                <Button variant="outline" onClick={() => setConfirm('restore')} className="justify-start">
                  <RotateCcw /> Restaurar dados de demonstração
                </Button>
                <Button variant="outline" onClick={() => setConfirm('clear')} className="justify-start text-destructive hover:text-destructive">
                  <Trash2 /> Apagar todos os dados locais
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Limitações da persistência local</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-3 text-sm text-muted-foreground">
              <p>Os dados ficam no localStorage deste navegador: limpar os dados do site ou usar outro dispositivo faz com que eles não estejam disponíveis.</p>
              <p>Cada operação valida todas as regras antes de gravar, mas o localStorage não oferece transações nem controle de concorrência entre abas como um banco de dados.</p>
              <p>Exporte backups regularmente se usar a aplicação com dados próprios.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {pendingImport && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPendingImport(null)}
          title="Substituir os dados atuais pelo backup?"
          description={
            <div className="space-y-3">
              <p>
                O arquivo <strong className="text-foreground">{pendingImport.fileName}</strong> é válido
                {pendingImport.summary.exportedAt ? ` e foi exportado em ${formatDateTime(pendingImport.summary.exportedAt)}` : ''}
                {pendingImport.summary.migratedFrom ? `. Ele será convertido da versão ${pendingImport.summary.migratedFrom} para a atual` : ''}.
              </p>
              <ul className="grid grid-cols-2 gap-1 text-foreground">
                <li>{formatNumber(pendingImport.summary.products)} produtos</li>
                <li>{formatNumber(pendingImport.summary.categories)} categorias</li>
                <li>{formatNumber(pendingImport.summary.suppliers)} fornecedores</li>
                <li>{formatNumber(pendingImport.summary.movements)} movimentações</li>
                <li>{formatNumber(pendingImport.summary.purchaseOrders)} pedidos</li>
                <li>{formatNumber(pendingImport.summary.activity)} eventos</li>
              </ul>
              <p>Todos os dados atuais serão substituídos. Exporte um backup antes se quiser preservá-los.</p>
            </div>
          }
          confirmLabel="Substituir dados"
          destructive
          onConfirm={confirmImport}
        />
      )}

      <ConfirmDialog
        open={confirm === 'restore'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Restaurar dados de demonstração?"
        description="Produtos, categorias, fornecedores, movimentações, pedidos e histórico atuais serão substituídos pelo conjunto inicial. As configurações são mantidas."
        confirmLabel="Restaurar"
        destructive
        onConfirm={() => doReset('restore')}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null)
            setClearText('')
          }
        }}
        title="Apagar todos os dados locais?"
        description="Todos os registros serão removidos deste navegador e a aplicação ficará vazia. As configurações são mantidas. Esta ação não pode ser desfeita."
        confirmLabel="Apagar dados"
        destructive
        confirmDisabled={clearText.trim().toUpperCase() !== 'APAGAR'}
        onConfirm={() => doReset('clear')}
      >
        <div className="space-y-1.5">
          <Label htmlFor="clear-confirm">Digite APAGAR para confirmar</Label>
          <Input id="clear-confirm" value={clearText} onChange={(e) => setClearText(e.target.value)} autoComplete="off" />
        </div>
      </ConfirmDialog>
    </div>
  )
}
