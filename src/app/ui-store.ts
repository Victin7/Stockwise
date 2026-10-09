import { create } from 'zustand'

/** Estado efêmero de interface (não persistido). */
interface UiState {
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  readNotifications: string[]
  toggleSidebar: () => void
  setMobileNav: (open: boolean) => void
  markNotificationsRead: (ids: string[]) => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  readNotifications: [],
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  markNotificationsRead: (ids) => set((s) => ({ readNotifications: [...new Set([...s.readNotifications, ...ids])] })),
}))
