import { Bell, CircleUser, LogOut, Menu, Moon, Settings, Sun } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useSettings } from '@/app/store'
import { useUiStore } from '@/app/ui-store'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAction } from '@/hooks/use-action'
import { type NotificationTone, useNotifications } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { updateSettings } from '@/domain/services/settings.service'
import { GlobalSearch } from './global-search'
import { SidebarNav } from './sidebar'
import { toast } from 'sonner'

const TONE_DOT: Record<NotificationTone, string> = { out: 'bg-out', low: 'bg-low', info: 'bg-info' }

function NotificationsMenu() {
  const notifications = useNotifications()
  const read = useUiStore((s) => s.readNotifications)
  const markRead = useUiStore((s) => s.markNotificationsRead)
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !read.includes(n.id))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações (${unread.length} não lidas)`}>
          <Bell />
          {unread.length > 0 && (
            <span className="tabular absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-out px-1 text-[10px] leading-4 font-semibold text-white">
              {unread.length > 99 ? '99+' : unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notificações</p>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            disabled={unread.length === 0}
            onClick={() => markRead(notifications.map((n) => n.id))}
          >
            Marcar todas como lidas
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum alerta no momento.</p>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="items-start gap-3 py-2"
                onSelect={() => {
                  markRead([n.id])
                  navigate(n.to)
                }}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_DOT[n.tone], read.includes(n.id) && 'opacity-30')} />
                <span className="min-w-0">
                  <span className={cn('block text-sm', !read.includes(n.id) && 'font-medium')}>{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.description}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeToggle({ effective }: { effective: 'light' | 'dark' }) {
  const run = useAction()
  const next = effective === 'dark' ? 'light' : 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={effective === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
      onClick={() => run((d, ctx) => updateSettings(d, { ...d.settings, theme: next }, ctx))}
    >
      {effective === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}

function ProfileMenu() {
  const { responsibleName, companyName } = useSettings()
  const initials = responsibleName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted"
          aria-label="Menu do perfil"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium">{responsibleName}</span>
            <span className="block text-xs text-muted-foreground">Administrador</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block">{responsibleName}</span>
          <span className="block text-xs font-normal text-muted-foreground">{companyName}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/configuracoes">
            <Settings /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/atividades">
            <CircleUser /> Minhas atividades
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast.info('Este é um perfil demonstrativo; não há sessão para encerrar.')}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({ effectiveTheme }: { effectiveTheme: 'light' | 'dark' }) {
  const mobileOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobile = useUiStore((s) => s.setMobileNav)
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Abrir menu">
        <Menu />
      </Button>
      <div className="flex-1">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle effective={effectiveTheme} />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar text-white">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal</SheetDescription>
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <div className="overflow-y-auto py-3">
            <SidebarNav collapsed={false} onNavigate={() => setMobile(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
