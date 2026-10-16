import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PortalField, PortalSection } from '@aisley/ui/portal'
import { ApiError } from '../../lib/api'
import type { InventorySku } from '../../types/operations'
import type { useInventoryMutation } from './useInventoryMutation'

export function ThresholdForm({
  sku,
  mutation,
  onDirtyChange,
}: {
  sku: InventorySku
  mutation: ReturnType<typeof useInventoryMutation>
  onDirtyChange: (dirty: boolean) => void
}) {
  const [values, setValues] = useState(() => ({
    draft: sku.alert_threshold?.toString() ?? '',
    saved: sku.alert_threshold?.toString() ?? '',
  }))
  const blocked = mutation.busy || Boolean(mutation.pending)
  const errors =
    mutation.path?.endsWith('/threshold') && mutation.error instanceof ApiError
      ? mutation.error.errors
      : {}
  const dirty = values.draft !== values.saved
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    setValues((current) =>
      current.draft === current.saved
        ? {
            draft: sku.alert_threshold?.toString() ?? '',
            saved: sku.alert_threshold?.toString() ?? '',
          }
        : current,
    )
  }, [sku.alert_threshold])
  useEffect(() => {
    if (mutation.lastCommit?.path.endsWith('/threshold')) {
      setValues((current) => ({ ...current, saved: current.draft }))
    }
  }, [mutation.lastCommit])

  return (
    <PortalSection
      id="stock-threshold"
      title="Low-stock threshold"
      description="Alerts use available stock. Leave blank to disable; zero alerts when stock runs out."
    >
      <form
        className="portal-form-stack"
        onSubmit={(event) => {
          event.preventDefault()
          if (blocked) return
          void mutation.send(
            {
              path: `/api/v1/seller/inventory/${encodeURIComponent(sku.id)}/threshold`,
              method: 'PATCH',
              body: JSON.stringify({
                alert_threshold:
                  values.draft === '' ? null : Number(values.draft),
              }),
            },
            'Threshold saved.',
          )
        }}
      >
        <PortalField
          id="stock-threshold-value"
          label="Alert threshold"
          type="number"
          min={0}
          max={999999999}
          step={1}
          value={values.draft}
          disabled={blocked}
          onChange={(event) =>
            setValues((current) => ({ ...current, draft: event.target.value }))
          }
          error={errors.alert_threshold?.[0]}
        />
        <button type="submit" className="portal-button" disabled={blocked}>
          {mutation.busy && mutation.path?.endsWith('/threshold')
            ? 'Saving…'
            : 'Save threshold'}
        </button>
        <Link className="portal-link text-sm" to="/low-stock-alerts">
          View alert history
        </Link>
      </form>
    </PortalSection>
  )
}
