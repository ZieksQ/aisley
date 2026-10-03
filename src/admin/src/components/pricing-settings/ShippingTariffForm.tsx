import { useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowLeft, FaFloppyDisk } from 'react-icons/fa6'
import { ApiError } from '../../lib/api'
import { createShippingRate } from '../../lib/pricingSettings'
import type { ShippingRatePayload, ShippingRateVersion } from '../../types/pricingSettings'
import { philippineRegions } from '../../lib/philippineRegions'
import { RegionSurchargeEditor } from './RegionSurchargeEditor'
import { inputClass, panelClass, primaryButtonClass, secondaryButtonClass, toLocalDateTime } from './ui'

type FormState = {
  effectiveAt: string
  surcharges: Record<string, string>
}

function initialState(source: ShippingRateVersion | null): FormState {
  return {
    effectiveAt: toLocalDateTime(),
    surcharges: Object.fromEntries((source?.region_surcharges ?? []).map((item) => [item.destination_region, String(item.surcharge_cents / 100)])),
  }
}

function nonnegativeNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function ShippingTariffForm({ source, onCancel, onCreated }: { source: ShippingRateVersion | null; onCancel: () => void; onCreated: (rate: ShippingRateVersion) => void }) {
  const [form, setForm] = useState(() => initialState(source))
  const [selectedRegionCode, setSelectedRegionCode] = useState(philippineRegions[0].code)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function validate(): ShippingRatePayload | null {
    const effective = new Date(form.effectiveAt)
    const errors: Record<string, string> = {}
    if (Number.isNaN(effective.getTime())) errors.effectiveAt = 'Choose when this tariff becomes effective.'

    const surcharges = Object.entries(form.surcharges).flatMap(([region, value]) => {
      if (value === '') return []
      const amount = nonnegativeNumber(value)
      if (amount === null) {
        errors.surcharges = 'Every configured surcharge must be zero or a positive amount.'
        return []
      }
      return [{ region, surcharge_cents: Math.round(amount * 100) }]
    })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return null

    return {
      currency: 'PHP',
      effective_at: effective.toISOString(),
      region_surcharges: surcharges,
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError('')
    const payload = validate()
    if (!payload) return
    setBusy(true)
    try {
      const response = await createShippingRate(payload)
      onCreated(response.data)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldErrors((current) => ({
          ...current,
          effectiveAt: caught.errors.effective_at?.[0] ?? current.effectiveAt,
          surcharges: caught.errors.region_surcharges?.[0] ?? caught.errors['region_surcharges.0.region']?.[0] ?? current.surcharges,
        }))
      } else setError('Unable to create the shipping tariff draft.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={`${panelClass} mt-6 overflow-hidden`} onSubmit={save}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-white/10 sm:p-6">
        <div>
          <h3 className="text-lg font-semibold">New shipping tariff version</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Set destination-region surcharges and an effective time. The draft does not affect checkout until it is published and effective.</p>
        </div>
        <button className={secondaryButtonClass} disabled={busy} onClick={onCancel} type="button"><FaArrowLeft aria-hidden="true" />Back to current settings</button>
      </div>

      {error ? <p className="mx-5 mt-5 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert">{error}</p> : null}

      <div className="p-5 sm:p-6">
        <Field error={fieldErrors.effectiveAt} label="Effective date and time" name="effectiveAt"><input className={inputClass} onChange={(event) => setForm({ ...form, effectiveAt: event.target.value })} required type="datetime-local" value={form.effectiveAt} /></Field>

        <section aria-labelledby="tariff-regions-heading" className="mt-8 border-t border-slate-200 pt-6 dark:border-white/10">
          <h4 className="font-semibold" id="tariff-regions-heading">Regional surcharges</h4>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Select a region on the map or from the list, then set the surcharge for deliveries to that region.</p>
          {fieldErrors.surcharges ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.surcharges}</p> : null}
          <div className="mt-5"><RegionSurchargeEditor onSelect={setSelectedRegionCode} onValuesChange={(surcharges) => setForm({ ...form, surcharges })} selectedCode={selectedRegionCode} values={form.surcharges} /></div>
        </section>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.02] sm:flex-row sm:justify-end">
        <button className={secondaryButtonClass} disabled={busy} onClick={onCancel} type="button">Cancel</button>
        <button className={primaryButtonClass} disabled={busy} type="submit"><FaFloppyDisk aria-hidden="true" />{busy ? 'Saving draft…' : 'Save draft'}</button>
      </div>
    </form>
  )
}

function Field({ children, error, label, name }: { children: React.ReactNode; error?: string; label: string; name: string }) {
  return <label className="block text-sm font-semibold" htmlFor={name}>{label}<span className="mt-2 block">{children}</span>{error ? <span className="mt-1.5 block text-xs font-normal text-rose-700 dark:text-rose-300" role="alert">{error}</span> : null}</label>
}
