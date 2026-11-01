import { useState } from 'react'
import type { FormEvent } from 'react'
import { PortalButton, PortalField, PortalModal } from '@aisley/ui/portal'
import { ApiError } from '../../lib/api'
import type { Truck, TruckInput } from './types'

type Props = { truck?: Truck; onSave: (input: TruckInput, truck?: Truck) => Promise<void>; onClose: () => void }

export function FleetTruckForm({ truck, onSave, onClose }: Props) {
  const initial = { plate_number: truck?.plate_number ?? '', make: truck?.make ?? '', model: truck?.model ?? '', max_parcels: String(truck?.max_parcels ?? 100) }
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [discarding, setDiscarding] = useState(false)
  const dirty = JSON.stringify(initial) !== JSON.stringify(form)

  function close() {
    if (busy) return
    if (dirty) setDiscarding(true)
    else onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setErrors({})
    if (!form.plate_number.trim() || !Number.isInteger(Number(form.max_parcels)) || Number(form.max_parcels) < 1 || Number(form.max_parcels) > 10000) {
      setError('Enter a plate number and a whole parcel limit from 1 to 10,000.')
      return
    }
    setBusy(true)
    try {
      await onSave({ plate_number: form.plate_number.trim(), make: form.make.trim() || null, model: form.model.trim() || null, max_parcels: Number(form.max_parcels) }, truck)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Truck details could not be saved. Your input has been kept.')
      if (caught instanceof ApiError) setErrors(caught.errors)
    } finally { setBusy(false) }
  }

  return <PortalModal
    title={truck ? `Edit truck · ${truck.plate_number}` : 'Register company truck'}
    description="Company-owned trucks are separate from Couriers’ personal vehicles."
    busy={busy}
    onClose={close}>
    <form className="portal-form-stack" onSubmit={(event) => void submit(event)}>
      <PortalField
        label="Plate number"
        required
        maxLength={64}
        value={form.plate_number}
        onChange={(event) => setForm({ ...form, plate_number: event.target.value })}
        error={errors.plate_number?.[0]}
        disabled={busy} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PortalField
          label="Make"
          maxLength={255}
          value={form.make}
          onChange={(event) => setForm({ ...form, make: event.target.value })}
          error={errors.make?.[0]}
          disabled={busy} />
        <PortalField
          label="Model"
          maxLength={255}
          value={form.model}
          onChange={(event) => setForm({ ...form, model: event.target.value })}
          error={errors.model?.[0]}
          disabled={busy} />
      </div>
      <PortalField
        label="Maximum parcels"
        hint="Whole parcel count, from 1 to 10,000. Existing reservations remain enforced by the server."
        required
        type="number"
        min={1}
        max={10000}
        step={1}
        value={form.max_parcels}
        onChange={(event) => setForm({ ...form, max_parcels: event.target.value })}
        error={errors.max_parcels?.[0]}
        disabled={busy} />
      {error ? <p className="portal-field-error" role="alert">{error}</p> : null}
      {discarding ? <div className="portal-feedback" role="alert">
        <p>Discard your unsaved truck details?</p>
        <div className="portal-inline-actions mt-3">
          <PortalButton onClick={() => setDiscarding(false)}>
            Keep editing
          </PortalButton>
          <PortalButton variant="danger" onClick={onClose}>
            Discard changes
          </PortalButton>
        </div>
      </div> : null}
      <div className="portal-inline-actions justify-end">
        <PortalButton disabled={busy} onClick={close}>
          Cancel
        </PortalButton>
        <PortalButton variant="primary" isLoading={busy} type="submit">
          {truck ? 'Save changes' : 'Register truck'}
        </PortalButton>
      </div>
    </form>
  </PortalModal>
}
