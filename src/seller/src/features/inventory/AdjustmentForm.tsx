import { useEffect, useState } from 'react'
import { PortalField, PortalSection } from '@aisley/ui/portal'
import { ApiError } from '../../lib/api'
import type { InventorySku } from '../../types/operations'
import type { useInventoryMutation } from './useInventoryMutation'

export function AdjustmentForm({
  sku,
  mutation,
  onDirtyChange,
}: {
  sku: InventorySku
  mutation: ReturnType<typeof useInventoryMutation>
  onDirtyChange: (dirty: boolean) => void
}) {
  const [type, setType] = useState('restock')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const inactive = sku.status !== 'active' || sku.product.status === 'archived'
  const blocked = mutation.busy || Boolean(mutation.pending)
  const errors =
    mutation.path?.endsWith('/adjustments') &&
    mutation.error instanceof ApiError
      ? mutation.error.errors
      : {}
  const dirty = Boolean(reason || quantity !== '1' || type !== 'restock')
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function success() {
    setReason('')
    setQuantity('1')
    setType('restock')
  }
  useEffect(() => {
    if (mutation.lastCommit?.path.endsWith('/adjustments')) success()
  }, [mutation.lastCommit])

  return (
    <PortalSection
      id="adjust-stock"
      title="Adjust stock"
      description="Record a physical stock change with a reason. Reserved units stay protected."
    >
      {inactive && (
        <p className="portal-feedback">
          This SKU is inactive or its Product is archived. Stock adjustments are
          unavailable.
        </p>
      )}
      <form
        className="portal-form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          if (blocked || inactive) return
          void mutation.send(
            {
              path: `/api/v1/seller/inventory/${encodeURIComponent(sku.id)}/adjustments`,
              method: 'POST',
              body: JSON.stringify({
                movement_type: type,
                quantity: Number(quantity),
                reason,
                idempotency_key: crypto.randomUUID(),
              }),
            },
            'Stock adjustment recorded.',
          )
        }}
      >
        <fieldset disabled={blocked || inactive} className="portal-form-stack">
          <div className="portal-field">
            <label htmlFor="adjustment-type">Adjustment type</label>
            <select
              id="adjustment-type"
              className="portal-input"
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-invalid={Boolean(errors.movement_type)}
              aria-describedby={
                errors.movement_type ? 'adjustment-type-error' : undefined
              }
            >
              <option value="restock">Restock</option>
              <option value="manual_increase">Manual increase</option>
              <option value="manual_decrease">Manual decrease</option>
              <option value="return_in">Return in</option>
            </select>
            {errors.movement_type && (
              <p className="portal-field-error" id="adjustment-type-error">
                {errors.movement_type[0]}
              </p>
            )}
          </div>
          <PortalField
            id="adjustment-quantity"
            label="Quantity"
            type="number"
            min={1}
            max={999999999}
            step={1}
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={errors.quantity?.[0]}
          />
          <div className="portal-field">
            <label htmlFor="adjustment-reason">Reason</label>
            <textarea
              id="adjustment-reason"
              className="portal-input"
              rows={3}
              maxLength={500}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={
                errors.reason ? 'adjustment-reason-error' : undefined
              }
            />
            {errors.reason && (
              <p id="adjustment-reason-error" className="portal-field-error">
                {errors.reason[0]}
              </p>
            )}
          </div>
        </fieldset>
        <button
          className="portal-button portal-button-primary"
          type="submit"
          disabled={blocked || inactive}
        >
          {mutation.busy && mutation.path?.endsWith('/adjustments')
            ? 'Recording…'
            : 'Record adjustment'}
        </button>
      </form>
    </PortalSection>
  )
}
