import { useEffect, useState } from 'react'
import { ConfirmationDialog } from '@aisley/ui/portal'
import type { InventorySku } from '../../types/operations'
import { AdjustmentForm } from './AdjustmentForm'
import { ThresholdForm } from './ThresholdForm'
import { useInventoryMutation } from './useInventoryMutation'
import { useInventoryGuard } from './useInventoryGuard'

export function InventoryForms({
  sku,
  onCommitted,
  onGuardChange,
  onAccessLost,
}: {
  sku: InventorySku
  onCommitted: () => void
  onGuardChange: (blocked: boolean) => void
  onAccessLost: () => void
}) {
  const [adjustmentDirty, setAdjustmentDirty] = useState(false)
  const [thresholdDirty, setThresholdDirty] = useState(false)
  const mutation = useInventoryMutation(onCommitted, onAccessLost)
  const blocked = mutation.busy || Boolean(mutation.pending)
  const dirty = adjustmentDirty || thresholdDirty
  const blocker = useInventoryGuard(
    dirty,
    mutation.busy,
    Boolean(mutation.pending),
  )
  useEffect(() => {
    onGuardChange(dirty || blocked)
  }, [dirty, blocked, onGuardChange])

  return (
    <aside className="portal-form-stack" aria-label="Inventory controls">
      {mutation.notice && (
        <p className="portal-feedback" role="status">
          {mutation.notice}
        </p>
      )}
      {mutation.error && (
        <div className="portal-state portal-state-error" role="alert">
          <p>{mutation.error.message}</p>
          {mutation.pending && (
            <>
              <p className="portal-secondary">
                The result is uncertain. Retry the exact saved request before
                making another change.
              </p>
              <button
                className="portal-button mt-3"
                disabled={mutation.busy}
                onClick={() => {
                  if (mutation.pending)
                    void mutation.send(
                      mutation.pending,
                      mutation.pending.path.endsWith('/threshold')
                        ? 'Threshold saved.'
                        : 'Stock adjustment recorded.',
                    )
                }}
              >
                {mutation.busy ? 'Retrying…' : 'Retry same request'}
              </button>
            </>
          )}
        </div>
      )}
      <AdjustmentForm
        sku={sku}
        mutation={mutation}
        onDirtyChange={setAdjustmentDirty}
      />
      <ThresholdForm
        sku={sku}
        mutation={mutation}
        onDirtyChange={setThresholdDirty}
      />
      {blocker.state === 'blocked' && (
        <ConfirmationDialog
          title={
            blocked
              ? 'Finish the stock update'
              : 'Discard unsaved inventory input?'
          }
          confirmLabel={blocked ? 'Stay on page' : 'Discard input'}
          onClose={() => blocker.reset()}
          onConfirm={() => (blocked ? blocker.reset() : blocker.proceed())}
        >
          <p>
            {blocked
              ? 'Resolve the pending stock request before leaving this page.'
              : 'Your unsaved adjustment and threshold input will be discarded.'}
          </p>
        </ConfirmationDialog>
      )}
    </aside>
  )
}
