import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={MapPinOff}
      title="Página não encontrada"
      description="O endereço acessado não existe no StockWise. Verifique o link ou volte ao painel."
      action={
        <Button asChild>
          <Link to="/">Ir para o dashboard</Link>
        </Button>
      }
    />
  )
}
