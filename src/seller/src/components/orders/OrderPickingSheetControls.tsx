import { IconButton } from '@aisley/ui/portal'
import { LuPrinter } from 'react-icons/lu'
import { pickingSheetLimit, type OrderPickingSelection } from '../../lib/useOrderPickingSheet'
import { OrderButton } from './OrderUi'

export function OrderPickingSheetControls({ selection, disabled }: {
  selection: OrderPickingSelection
  disabled: boolean
}) {
  if (!selection.active) {
    return (
      <IconButton id="order-print-selection" label="Select orders to print" disabled={disabled}
        aria-controls="monitoring-results" onClick={() => selection.setActive(true)}>
        <LuPrinter aria-hidden="true" />
      </IconButton>
    )
  }

  function cancel() {
    selection.setActive(false)
    requestAnimationFrame(() => document.getElementById('order-print-selection')?.focus())
  }

  return (
    <div className="order-print-controls">
      <span role="status">{selection.selectedIds.size} selected · max {pickingSheetLimit}</span>
      <OrderButton variant="primary" disabled={disabled || !selection.selectedIds.size}
        isLoading={selection.printing} loadingLabel="Preparing PDF…" onClick={() => void selection.print()}>
        <LuPrinter aria-hidden="true" />Print ({selection.selectedIds.size})
      </OrderButton>
      <OrderButton autoFocus variant="ghost" disabled={selection.printing} onClick={cancel}>Cancel</OrderButton>
    </div>
  )
}
