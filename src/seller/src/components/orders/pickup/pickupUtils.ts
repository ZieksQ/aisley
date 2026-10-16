import type { SellerOrder } from '../../../types/orders'

export type ProviderOrderGroup = {
  key: string
  provider: SellerOrder['shipping_provider']
  orders: SellerOrder[]
}

export function groupOrdersByProvider(orders: SellerOrder[]): ProviderOrderGroup[] {
  const groups = orders.reduce<Record<string, ProviderOrderGroup>>((result, order) => {
    const key = order.shipping_provider?.id ?? 'unassigned'
    const group = result[key] ??= { key, provider: order.shipping_provider, orders: [] }
    group.orders.push(order)
    return result
  }, {})

  return Object.values(groups)
}
