import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { useSettings } from '@/app/store'
import { useUiStore } from '@/app/ui-store'
import { Logo } from '@/components/shared/logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { NAV_GROUPS } from './nav'

export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5 px-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {!collapsed && <p className="px-3 pb-1 text-xs text-sidebar-muted">{group.label}</p>}
          {group.items.map((item) => {
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white',
                    isActive && 'bg-sidebar-accent font-medium text-white',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-signal transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden="true"
                    />
                    <item.icon className="size-[18px] shrink-0" />
                    {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            )
            return collapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const { companyName } = useSettings()
  return (
    <aside
      className={cn(
        'no-print sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-white transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-[268px]',
      )}
    >
      <div className={cn('flex h-16 items-center px-5', collapsed && 'justify-center px-0')}>
        <Logo collapsed={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}>
        {!collapsed && (
          <div className="mb-2 rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-white">{companyName}</p>
            <p className="text-xs text-sidebar-muted">Ambiente de demonstração</p>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
            collapsed && 'w-9 justify-center px-0',
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && 'Recolher menu'}
        </button>
      </div>
    </aside>
  )
}
