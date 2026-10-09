import type { AppData } from '@/domain/entities'

/**
 * Verifica a consistência referencial do estado (usado ao importar backups
 * e ao carregar dados do armazenamento). Retorna a lista de problemas.
 */
export function findIntegrityIssues(data: AppData): string[] {
  const issues: string[] = []
  const categoryIds = new Set(data.categories.map((c) => c.id))
  const supplierIds = new Set(data.suppliers.map((s) => s.id))
  const productIds = new Set(data.products.map((p) => p.id))
  const orderIds = new Set(data.purchaseOrders.map((o) => o.id))

  const skus = new Set<string>()
  for (const p of data.products) {
    const sku = p.sku.trim().toUpperCase()
    if (skus.has(sku)) issues.push(`SKU duplicado: ${p.sku}`)
    skus.add(sku)
    if (!categoryIds.has(p.categoryId)) issues.push(`Produto ${p.sku} referencia uma categoria inexistente.`)
    if (p.supplierId && !supplierIds.has(p.supplierId)) {
      issues.push(`Produto ${p.sku} referencia um fornecedor inexistente.`)
    }
    if (p.maxStock !== null && p.maxStock < p.minStock) {
      issues.push(`Produto ${p.sku} tem estoque máximo menor que o mínimo.`)
    }
  }
  const ops = new Set<string>()
  for (const m of data.movements) {
    if (!productIds.has(m.productId)) issues.push(`Movimentação ${m.id} referencia um produto inexistente.`)
    if (m.purchaseOrderId && !orderIds.has(m.purchaseOrderId)) {
      issues.push(`Movimentação ${m.id} referencia um pedido inexistente.`)
    }
    if (ops.has(m.operationId)) issues.push(`Operação duplicada: ${m.operationId}`)
    ops.add(m.operationId)
  }
  for (const o of data.purchaseOrders) {
    if (!supplierIds.has(o.supplierId)) issues.push(`Pedido ${o.number} referencia um fornecedor inexistente.`)
    for (const i of o.items) {
      if (!productIds.has(i.productId)) issues.push(`Pedido ${o.number} contém produto inexistente.`)
      if (i.receivedQuantity > i.quantity) issues.push(`Pedido ${o.number} tem item recebido acima do solicitado.`)
    }
  }
  return issues
}
