import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaCircleInfo, FaPlus, FaRotate } from 'react-icons/fa6'
import { ApiError } from '../../lib/api'
import { createCommissionPolicy, fetchCommissionPolicies, publishCommissionPolicy } from '../../lib/pricingSettings'
import type { CommissionBeneficiary, CommissionPolicy } from '../../types/pricingSettings'
import { formatDate, inputClass, panelClass, primaryButtonClass, secondaryButtonClass, statusClass, toLocalDateTime } from './ui'

const beneficiaryLabels: Record<CommissionBeneficiary, string> = {
  seller: 'Seller commission',
  logistics: 'Logistics commission',
}

function activePolicy(policies: CommissionPolicy[], beneficiary: CommissionBeneficiary) {
  const now = Date.now()
  return policies
    .filter((policy) => policy.beneficiary_type === beneficiary && policy.status === 'published' && new Date(policy.effective_at).getTime() <= now && (!policy.ends_at || new Date(policy.ends_at).getTime() > now))
    .sort((first, second) => new Date(second.effective_at).getTime() - new Date(first.effective_at).getTime())[0] ?? null
}

export function CommissionSettingsPanel({ canManage }: { canManage: boolean }) {
  const [policies, setPolicies] = useState<CommissionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [beneficiary, setBeneficiary] = useState<CommissionBeneficiary>('seller')
  const [rate, setRate] = useState('5')
  const [effectiveAt, setEffectiveAt] = useState(toLocalDateTime())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchCommissionPolicies(signal)
      setPolicies(response.data)
    } catch (caught) {
      if (!signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load commission policies.')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, reloadKey])

  const active = useMemo(() => ({ seller: activePolicy(policies, 'seller'), logistics: activePolicy(policies, 'logistics') }), [policies])

  function openForm(type: CommissionBeneficiary = 'seller') {
    setBeneficiary(type)
    setRate(active[type] ? String(active[type].rate_basis_points / 100) : '5')
    setEffectiveAt(toLocalDateTime())
    setFieldErrors({})
    setError('')
    setMessage('')
    setShowForm(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    const percent = Number(rate)
    const effective = new Date(effectiveAt)
    const errors: Record<string, string> = {}
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) errors.rate = 'Enter a percentage from 0 to 100.'
    if (Number.isNaN(effective.getTime())) errors.effectiveAt = 'Choose when this commission becomes effective.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      const response = await createCommissionPolicy({ beneficiary_type: beneficiary, rate_basis_points: Math.round(percent * 100), effective_at: effective.toISOString() })
      setShowForm(false)
      setMessage(`${beneficiaryLabels[beneficiary]} draft was created.`)
      setPolicies((current) => [response.data, ...current])
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldErrors({ rate: caught.errors.rate_basis_points?.[0] ?? '', effectiveAt: caught.errors.effective_at?.[0] ?? '' })
      } else setError('Unable to create the commission policy draft.')
    } finally {
      setSaving(false)
    }
  }

  async function publish(policy: CommissionPolicy) {
    if (!window.confirm(`Publish this ${beneficiaryLabels[policy.beneficiary_type].toLowerCase()} at ${(policy.rate_basis_points / 100).toFixed(2)}%? It will replace the current policy when effective.`)) return
    setBusyId(policy.id)
    setError('')
    setMessage('')
    try {
      await publishCommissionPolicy(policy.id)
      setMessage(`${beneficiaryLabels[policy.beneficiary_type]} was published.`)
      setReloadKey((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'This policy is no longer a draft. The latest policies have been loaded.' : caught instanceof Error ? caught.message : 'Unable to publish the commission policy.')
      setReloadKey((value) => value + 1)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="commission-settings-heading" className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="font-semibold" id="commission-settings-heading">Commissions</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Set the platform percentage deducted from Seller proceeds and the quoted Logistics pool.</p></div>
        {canManage ? <button className={primaryButtonClass} onClick={() => openForm()} type="button"><FaPlus aria-hidden="true" />New commission policy</button> : null}
      </div>

      {message ? <p className="mt-5 border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{message}</p> : null}
      {error ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert"><span>{error}</span><button className="font-semibold underline underline-offset-2" onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button></div> : null}

      {showForm ? (
        <form className={`${panelClass} mt-5 p-5 sm:p-6`} onSubmit={save}>
          <div className="flex items-start justify-between gap-4"><div><h4 className="font-semibold">New commission policy</h4><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Saving creates a draft. Publishing it is a separate confirmation.</p></div><button className="text-sm font-semibold text-slate-500 hover:text-slate-950 dark:hover:text-white" disabled={saving} onClick={() => setShowForm(false)} type="button">Close</button></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold" htmlFor="commission-beneficiary">Beneficiary<select className={`${inputClass} mt-2`} id="commission-beneficiary" onChange={(event) => setBeneficiary(event.target.value as CommissionBeneficiary)} value={beneficiary}><option value="seller">Seller</option><option value="logistics">Logistics</option></select></label>
            <label className="text-sm font-semibold" htmlFor="commission-rate">Commission rate (%)<input className={`${inputClass} mt-2`} id="commission-rate" inputMode="decimal" max="100" min="0" onChange={(event) => setRate(event.target.value)} required step="0.01" type="number" value={rate} />{fieldErrors.rate ? <span className="mt-1.5 block text-xs font-normal text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.rate}</span> : null}</label>
            <label className="text-sm font-semibold" htmlFor="commission-effective">Effective date and time<input className={`${inputClass} mt-2`} id="commission-effective" onChange={(event) => setEffectiveAt(event.target.value)} required type="datetime-local" value={effectiveAt} />{fieldErrors.effectiveAt ? <span className="mt-1.5 block text-xs font-normal text-rose-700 dark:text-rose-300" role="alert">{fieldErrors.effectiveAt}</span> : null}</label>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button className={secondaryButtonClass} disabled={saving} onClick={() => setShowForm(false)} type="button">Cancel</button><button className={primaryButtonClass} disabled={saving} type="submit">{saving ? 'Saving draft…' : 'Save draft'}</button></div>
        </form>
      ) : null}

      {loading ? <div aria-label="Loading commission policies" className={`${panelClass} mt-5 h-40 animate-pulse`} /> : (
        <div className={`${panelClass} mt-5 divide-y divide-slate-200 overflow-hidden dark:divide-white/10`}>
          {(['seller', 'logistics'] as CommissionBeneficiary[]).map((type) => {
            const policy = active[type]
            return <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" key={type}><div><h4 className="font-semibold">{beneficiaryLabels[type]}</h4><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{policy ? `Effective ${formatDate(policy.effective_at)}` : 'No active policy. Checkout requires a published policy.'}</p></div><div className="flex items-center gap-4"><p className="text-2xl font-semibold tabular-nums">{policy ? `${(policy.rate_basis_points / 100).toFixed(2)}%` : '—'}</p>{canManage ? <button className="text-sm font-semibold text-[#4C1268] hover:underline dark:text-pink-300" onClick={() => openForm(type)} type="button">Create successor</button> : null}</div></article>
          })}
        </div>
      )}

      {!loading && policies.length === 0 ? <div className="mt-5 flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400"><FaCircleInfo aria-hidden="true" className="mt-1 shrink-0" /><p>Create and publish both Seller and Logistics commission policies before accepting checkout Orders.</p></div> : null}

      {!loading && policies.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4"><h4 className="font-semibold">Policy history</h4><button aria-label="Refresh commission policy history" className={secondaryButtonClass} onClick={() => setReloadKey((value) => value + 1)} type="button"><FaRotate aria-hidden="true" />Refresh</button></div>
          <div className={`${panelClass} mt-3 overflow-x-auto`} role="region" aria-label="Commission policy history" tabIndex={0}>
            <table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-400"><tr><th className="px-4 py-3 font-semibold">Beneficiary</th><th className="px-4 py-3 font-semibold">Rate</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Effective</th><th className="px-4 py-3 font-semibold">Ends</th><th className="px-4 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-white/10">{policies.map((policy) => <tr key={policy.id}><td className="px-4 py-3 font-semibold capitalize">{policy.beneficiary_type}</td><td className="px-4 py-3 tabular-nums">{(policy.rate_basis_points / 100).toFixed(2)}%</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusClass(policy.status)}`}>{policy.status}</span></td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(policy.effective_at)}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{policy.ends_at ? formatDate(policy.ends_at) : '—'}</td><td className="px-4 py-3 text-right">{canManage && policy.status === 'draft' ? <button className="font-semibold text-[#4C1268] hover:underline disabled:opacity-50 dark:text-pink-300" disabled={busyId !== null} onClick={() => void publish(policy)} type="button">{busyId === policy.id ? 'Publishing…' : 'Publish'}</button> : <span className="text-slate-400">—</span>}</td></tr>)}</tbody></table>
          </div>
        </div>
      ) : null}
    </section>
  )
}
