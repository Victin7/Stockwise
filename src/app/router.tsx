import { lazy } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from './layout/app-shell'
import { NotFoundPage } from './not-found'

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const ProductsPage = lazy(() => import('@/features/products/products-page'))
const CategoriesPage = lazy(() => import('@/features/categories/categories-page'))
const InventoryPage = lazy(() => import('@/features/inventory/inventory-page'))
const SuppliersPage = lazy(() => import('@/features/suppliers/suppliers-page'))
const PurchaseOrdersPage = lazy(() => import('@/features/purchase-orders/purchase-orders-page'))
const ReportsPage = lazy(() => import('@/features/reports/reports-page'))
const ActivityPage = lazy(() => import('@/features/activity-log/activity-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'produtos', element: <ProductsPage /> },
      { path: 'categorias', element: <CategoriesPage /> },
      { path: 'estoque', element: <InventoryPage /> },
      { path: 'fornecedores', element: <SuppliersPage /> },
      { path: 'pedidos', element: <PurchaseOrdersPage /> },
      { path: 'relatorios', element: <ReportsPage /> },
      { path: 'atividades', element: <ActivityPage /> },
      { path: 'configuracoes', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

/** Base do site sem a barra final (ex.: "/Stockwise"), para funcionar em subcaminhos como o GitHub Pages. */
export const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export function createAppRouter() {
  return createBrowserRouter(routes, { basename: ROUTER_BASENAME })
}
