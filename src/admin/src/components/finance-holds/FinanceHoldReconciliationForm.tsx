import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaPlus, FaTrashCan } from 'react-icons/fa6'
import { ApiError } from '../../lib/api'
import { reconcileFinanceHold } from '../../lib/financeHolds'
import type { FinanceHold, LogisticsOrganizationOption, LogisticsServiceType } from '../../types/financeHolds'
import { formatMoney, inputClass, panelClass, primaryButtonClass, secondaryButtonClass } from '../pricing-settings/ui'

type AllocationRow = {
  key: string
  organizationId: string
  serviceType: LogisticsServiceType
  amount: string
}

const serviceLabels: Record<LogisticsServiceType, string> = {
  first_mile: 'First mile',
  linehaul: 'Linehaul',
  last_mile: 'Last mile',
}

function row(organizationId = '', serviceType: LogisticsServiceType = 'first_mile'): AllocationRow {
  return { key: crypto.randomUUID(), organizationId, serviceType, amount: '' }
}

function cents(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN
}

export function FinanceHoldReconciliationForm({ hold, organizations, onReconciled }: { hold: FinanceHold; organizations: LogisticsOrganizationOption[]; onReconciled: () => void }) {
  const selectedProviderId = hold.order?.selected_logistics_organization?.id ?? ''
  const [rows, setRows] = useState<AllocationRow[]>(() => [row(selectedProviderId)])
  const [subsidy, setSubsidy] = useState('0')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const currency = hold.order?.currency ?? 'PHP'
  const pool = hold.pricing?.logistics_pool_cents ?? 0
  const subsidyCents = Number.isNaN(cents(subsidy)) ? 0 : cents(subsidy)
  const allocationTotal = useMemo(() => rows.reduce((total, item) => total + (Number.isNaN(cents(item.amount)) ? 0 : cents(item.amount)), 0), [rows])
  const targetTotal = pool + subsidyCents
  const difference = targetTotal - allocationTotal

  function updateRow(key: string, values: Partial<AllocationRow>) {
    setRows((current) => current.map((item) => item.key === key ? { ...item, ...values } : item))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const errors: Record<string, string> = {}
    const parsedSubsidy = cents(subsidy)
    if (!Number.isFinite(parsedSubsidy) || parsedSubsidy < 0) errors.subsidy = 'Enter zero or a positive subsidy.'
    if (!notes.trim()) errors.notes = 'Explain the carrier evidence used for this reconciliation.'
    const allocations = rows.map((item) => ({ logistics_organization_id: item.organizationId, service_type: item.serviceType, amount_cents: cents(item.amount) }))
    if (allocations.some((item) => !item.logistics_organization_id || !Number.isFinite(item.amount_cents) || item.amount_cents < 1)) errors.allocations = 'Complete every row with an organization, service, and positive amount.'
    const keys = allocations.map((item) => `${item.logistics_organization_id}:${item.service_type}`)
    if (new Set(keys).size !== keys.length) errors.allocations = 'Combine duplicate organization and service rows.'
    if (Number.isFinite(parsedSubsidy) && allocations.every((item) => Number.isFinite(item.amount_cents)) && allocationTotal !== pool + parsedSubsidy) errors.total = `Allocations must equal ${formatMoney(pool + parsedSubsidy, currency)}.`
    setFieldErrors(errors)
    setError('')
    if (Object.keys(errors).length > 0) return
    if (!window.confirm(`Reconcile ${formatMoney(allocationTotal, currency)} across ${rows.length} carrier allocation${rows.length === 1 ? '' : 's'}? This releases the hold and cannot be edited.`)) return

    setBusy(true)
    try {
      await reconcileFinanceHold(hold.id, { platform_subsidy_cents: parsedSubsidy, notes: notes.trim(), allocations })
      onReconciled()
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.status === 409 || caught.status === 404 ? 'This hold changed or was already resolved. Reload it before taking another action.' : caught.message)
        setFieldErrors((current) => ({ ...current, allocations: caught.errors.allocations?.[0] ?? current.allocations }))
      } else setError('Unable to reconcile this Finance hold.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={`${panelClass} mt-6 overflow-hidden`} onSubmit={submit}>
      <div className="border-b border-slate-200 p-5 dark:border-white/10 sm:p-6"><h3 className="font-semibold">Manual carrier allocations</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Use operational evidence to assign the frozen Logistics pool. A subsidy is paid by the platform and does not change the Customer charge.</p></div>
      {error ? <p className="mx-5 mt-5 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert">{error}</p> : null}

      <div className="p-5 sm:p-6">
        <dl className="grid gap-4 border-b border-slate-200 pb-5 dark:border-white/10 sm:grid-cols-3">
          <Total label="Frozen Logistics pool" value={formatMoney(pool, currency)} />
          <Total label="Platform subsidy" value={formatMoney(subsidyCents, currency)} />
          <Total emphasis={difference !== 0} label="Remaining to allocate" value={formatMoney(difference, currency)} />
        </dl>

        <div className="mt-6 space-y-4">
          {rows.map((item, index) => (
            <fieldset className="grid gap-3 border-b border-slate-200 pb-4 last:border-b-0 dark:border-white/10 sm:grid-cols-[1.3fr_0.8fr_0.7fr_auto] sm:items-end" key={item.key}>
              <legend className="sr-only">Allocation {index + 1}</legend>
              <label className="text-sm font-semibold" htmlFor={`allocation-organization-${item.key}`}>Logistics organization<select className={`${inputClass} mt-2`} id={`allocation-organization-${item.key}`} onChange={(event) => updateRow(item.key, { organizationId: event.target.value })} value={item.organizationId}><option value="">Select organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.business_name}{organization.hub_name ? ` — ${organization.hub_name}` : ''}</option>)}</select></label>
              <label className="text-sm font-semibold" htmlFor={`allocation-service-${item.key}`}>Service<select className={`${inputClass} mt-2`} id={`allocation-service-${item.key}`} onChange={(event) => updateRow(item.key, { serviceType: event.target.value as LogisticsServiceType })} value={item.serviceType}>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-semibold" htmlFor={`allocation-amount-${item.key}`}>Amount (PHP)<input className={`${inputClass} mt-2`} id={`allocation-amount-${item.key}`} inputMode="decimal" min="0.01" onChange={(event) => updateRow(item.key, { amount: event.target.value })} placeholder="0.00" step="0.01" type="number" value={item.amount} /></label>
              <button aria-label={`Remove allocation ${index + 1}`} className="grid size-11 place-items-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] disabled:opacity-40 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-rose-300" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((rowItem) => rowItem.key !== item.key))} type="button"><FaTrashCan aria-hidden="true" /></button>
            </fieldset>
          ))}
        </div>
        {fieldErrors.allocations ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.allocations}</p> : null}
        {fieldErrors.total ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.total}</p> : null}
        <button className={`${secondaryButtonClass} mt-4`} disabled={rows.length >= 100} onClick={() => setRows((current) => [...current, row('', 'linehaul')])} type="button"><FaPlus aria-hidden="true" />Add carrier allocation</button>

        <div className="mt-6 grid gap-5 border-t border-slate-200 pt-5 dark:border-white/10 sm:grid-cols-[220px_1fr]">
          <label className="text-sm font-semibold" htmlFor="hold-subsidy">Platform subsidy (PHP)<input className={`${inputClass} mt-2`} id="hold-subsidy" inputMode="decimal" min="0" onChange={(event) => setSubsidy(event.target.value)} step="0.01" type="number" value={subsidy} />{fieldErrors.subsidy ? <span className="mt-1.5 block text-xs font-normal text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.subsidy}</span> : null}</label>
          <label className="text-sm font-semibold" htmlFor="hold-notes">Reconciliation note<textarea className={`${inputClass} mt-2 min-h-28 py-3`} id="hold-notes" maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Describe the dispatch, handoff, or delivery evidence used to assign each carrier." value={notes} />{fieldErrors.notes ? <span className="mt-1.5 block text-xs font-normal text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.notes}</span> : null}</label>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.02]"><button className={primaryButtonClass} disabled={busy || organizations.length === 0 || difference !== 0} type="submit">{busy ? 'Reconciling…' : 'Reconcile and release hold'}</button></div>
    </form>
  )
}

function Total({ emphasis = false, label, value }: { emphasis?: boolean; label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className={`mt-1 font-semibold tabular-nums ${emphasis ? 'text-amber-700 dark:text-amber-300' : ''}`}>{value}</dd></div>
}
