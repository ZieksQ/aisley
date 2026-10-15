import type { InventorySku } from '../../types/operations'

export function StockState({ state }: { state: InventorySku['stock_state'] }) {
  const tone =
    state === 'out' ? 'danger' : state === 'low' ? 'warning' : 'success'
  return (
    <span className={`portal-tag portal-tag-${tone}`}>
      {state === 'out'
        ? 'Out of stock'
        : state === 'low'
          ? 'Low stock'
          : 'In stock'}
    </span>
  )
}
