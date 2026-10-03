import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../lib/api'
import { createCommissionPolicy } from '../../lib/pricingSettings'
import type { CommissionBeneficiary, CommissionPolicy } from '../../types/pricingSettings'
import { CommissionDialog } from './CommissionDialog'
import { inputClass, primaryButtonClass, secondaryButtonClass, toLocalDateTime } from './ui'

type Props = {
  initialBeneficiary: CommissionBeneficiary
  initialRate: number
  onClose: () => void
  onCreated: (policy: CommissionPolicy) => void
  onReconcile: () => void
}

export function CommissionPolicyForm({ initialBeneficiary, initialRate, onClose, onCreated, onReconcile }: Props) {
  const [beneficiary, setBeneficiary] = useState(initialBeneficiary)
  const [rate, setRate] = useState(String(initialRate / 100))
  const [scheduled, setScheduled] = useState(false)
  const [effectiveAt, setEffectiveAt] = useState(toLocalDateTime())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [uncertain, setUncertain] = useState(false)

  function close() {
    if (discarding) setDiscarding(false)
    else if (dirty) setDiscarding(true)
    else onClose()
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving || uncertain) return
    const percent = Number(rate)
    const effective = new Date(effectiveAt)
    const errors: Record<string, string> = {}
    if (!rate.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100) errors.rate = 'Enter a percentage from 0 to 100.'
    if (scheduled && (Number.isNaN(effective.getTime()) || effective.getTime() <= Date.now())) errors.effectiveAt = 'Choose a future date and time.'
    setFieldErrors(errors)
    setError('')
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      const response = await createCommissionPolicy({ beneficiary_type: beneficiary, rate_basis_points: Math.round(percent * 100), effective_at: scheduled ? effective.toISOString() : null })
      onCreated(response.data)
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) { onReconcile(); return }
      setError(caught instanceof Error ? caught.message : 'Unable to create the commission policy.')
      if (caught instanceof ApiError) setFieldErrors({ rate: caught.errors.rate_basis_points?.[0] ?? '', effectiveAt: caught.errors.effective_at?.[0] ?? '', beneficiary: caught.errors.beneficiary_type?.[0] ?? '' })
      if (!(caught instanceof ApiError) || caught.status >= 500) setUncertain(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <CommissionDialog busy={saving} onClose={close} title={discarding ? 'Discard commission policy?' : 'New commission policy'}>
      {discarding ? <>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Your unsaved commission policy will be discarded.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className={secondaryButtonClass} onClick={() => setDiscarding(false)} type="button">Keep editing</button>
          <button className={primaryButtonClass} onClick={onClose} type="button">Discard changes</button>
        </div>
      </> : <form className="mt-4" onChange={() => setDirty(true)} onSubmit={save}>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">Save the policy, then publish it to apply the rate. Without a schedule, publishing applies it immediately.</p>
        <fieldset className="mt-5 space-y-4" disabled={saving}>
          <label className="block text-sm font-semibold" htmlFor="commission-beneficiary">Beneficiary
            <select className={`${inputClass} mt-2`} data-initial-focus id="commission-beneficiary" onChange={(event) => setBeneficiary(event.target.value as CommissionBeneficiary)} value={beneficiary}><option value="seller">Seller</option><option value="logistics">Logistics</option></select>
            {fieldErrors.beneficiary ? <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.beneficiary}</span> : null}
          </label>
          <label className="block text-sm font-semibold" htmlFor="commission-rate">Commission rate (%)
            <input aria-describedby={fieldErrors.rate ? 'commission-rate-error' : undefined} aria-invalid={!!fieldErrors.rate} className={`${inputClass} mt-2`} id="commission-rate" inputMode="decimal" max="100" min="0" onChange={(event) => setRate(event.target.value)} required step="0.01" type="number" value={rate} />
            {fieldErrors.rate ? <span className="mt-1.5 block text-xs font-normal text-rose-700 dark:text-rose-300" id="commission-rate-error" role="alert">{fieldErrors.rate}</span> : null}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input checked={scheduled} className="size-4 accent-[#4C1268]" onChange={(event) => setScheduled(event.target.checked)} type="checkbox" />Schedule an effective date</label>
          {scheduled ? <label className="block text-sm font-semibold" htmlFor="commission-effective">Effective date and time
            <input aria-describedby={fieldErrors.effectiveAt ? 'commission-effective-error' : 'commission-timezone'} aria-invalid={!!fieldErrors.effectiveAt} className={`${inputClass} mt-2`} id="commission-effective" onChange={(event) => setEffectiveAt(event.target.value)} required type="datetime-local" value={effectiveAt} />
            <span className="mt-1.5 block text-xs font-normal text-slate-500 dark:text-slate-400" id="commission-timezone">Your local time ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Publish before this time for scheduled activation.</span>
            {fieldErrors.effectiveAt ? <span className="mt-1.5 block text-xs font-normal text-rose-700 dark:text-rose-300" id="commission-effective-error" role="alert">{fieldErrors.effectiveAt}</span> : null}
          </label> : null}
        </fieldset>
        {error ? <p className="mt-4 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}
        {uncertain ? <p className="mt-3 text-sm text-amber-800 dark:text-amber-200" role="alert">Creation could not be confirmed. Review policy history before submitting again.</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className={secondaryButtonClass} disabled={saving} onClick={close} type="button">Cancel</button>
          {uncertain ? <button className={primaryButtonClass} onClick={onReconcile} type="button">Review policy history</button> : <button className={primaryButtonClass} disabled={saving} type="submit">{saving ? 'Saving policy…' : 'Save policy'}</button>}
        </div>
      </form>}
    </CommissionDialog>
  )
}
