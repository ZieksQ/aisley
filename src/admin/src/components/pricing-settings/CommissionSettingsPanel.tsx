import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaCircleInfo, FaPlus } from 'react-icons/fa6'
import { ApiError } from '../../lib/api'
import { fetchCommissionPolicies, publishCommissionPolicy } from '../../lib/pricingSettings'
import type { CommissionBeneficiary, CommissionPolicy } from '../../types/pricingSettings'
import { CommissionPolicyForm } from './CommissionPolicyForm'
import { CommissionPolicyHistory } from './CommissionPolicyHistory'
import { CommissionPublishDialog } from './CommissionPublishDialog'
import { formatDate, panelClass, primaryButtonClass, secondaryButtonClass } from './ui'

const beneficiaryLabels: Record<CommissionBeneficiary, string> = { seller: 'Seller commission', logistics: 'Logistics commission' }

export function CommissionSettingsPanel({ canManage }: { canManage: boolean }) {
  const [policies, setPolicies] = useState<CommissionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [messageWarning, setMessageWarning] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [formBeneficiary, setFormBeneficiary] = useState<CommissionBeneficiary | null>(null)
  const [publishTarget, setPublishTarget] = useState<CommissionPolicy | null>(null)
  const [publishError, setPublishError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const mutation = useRef(false)

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchCommissionPolicies(signal)
      if (!signal.aborted) setPolicies(response.data)
    } catch (caught) {
      if (!signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Unable to load commission policies.')
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
          setPolicies([])
          setFormBeneficiary(null)
          setPublishTarget(null)
        }
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, reloadKey])

  useEffect(() => {
    const boundaries = policies.flatMap((policy) => [policy.effective_at, policy.ends_at])
      .filter((date): date is string => !!date).map((date) => new Date(date).getTime()).filter((time) => time > Date.now())
    if (!boundaries.length) return
    const timer = window.setTimeout(() => setReloadKey((value) => value + 1), Math.min(Math.min(...boundaries) - Date.now() + 100, 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [policies, reloadKey])

  useEffect(() => {
    if (!canManage) { setFormBeneficiary(null); setPublishTarget(null) }
  }, [canManage])

  const active = useMemo(() => ({
    seller: policies.find((policy) => policy.beneficiary_type === 'seller' && policy.status === 'active'),
    logistics: policies.find((policy) => policy.beneficiary_type === 'logistics' && policy.status === 'active'),
  }), [policies])

  function openForm(type: CommissionBeneficiary = 'seller') {
    setMessage('')
    setFormBeneficiary(type)
  }

  async function publish() {
    if (!publishTarget || mutation.current || !canManage) return
    mutation.current = true
    setPublishing(true)
    setPublishError('')
    setMessage('')
    try {
      await publishCommissionPolicy(publishTarget.id)
      setMessageWarning(false)
      setMessage(`${beneficiaryLabels[publishTarget.beneficiary_type]} was published.`)
      setPublishTarget(null)
      setReloadKey((value) => value + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 422) setPublishError(caught.message)
      else {
        setPublishTarget(null)
        setMessageWarning(true)
        setMessage(caught instanceof ApiError && caught.status === 409
          ? 'This policy was already published. Refreshing the latest policy history.'
          : 'Publication could not be confirmed. Review the refreshed history before trying again.')
        setReloadKey((value) => value + 1)
      }
    } finally {
      mutation.current = false
      setPublishing(false)
    }
  }

  const busy = publishing || loading || !!error

  return <section aria-labelledby="commission-settings-heading" className="mt-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 className="font-semibold" id="commission-settings-heading">Commissions</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Set the platform percentage deducted from Seller proceeds and the quoted Logistics pool.</p></div>
      {canManage ? <button className={primaryButtonClass} disabled={busy} onClick={() => openForm()} type="button"><FaPlus aria-hidden="true" />New commission policy</button> : null}
    </div>

    {message ? <p className={`mt-5 border-l-2 px-3 py-2 text-sm ${messageWarning ? 'border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200' : 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'}`} role="status">{message}</p> : null}
    {error ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert"><span>{error}</span><button className={secondaryButtonClass} onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button></div> : null}

    {canManage && formBeneficiary ? <CommissionPolicyForm initialBeneficiary={formBeneficiary} initialRate={active[formBeneficiary]?.rate_basis_points ?? 500} onClose={() => setFormBeneficiary(null)} onCreated={(policy) => {
      setFormBeneficiary(null)
      setMessageWarning(false)
      setMessage(`${beneficiaryLabels[policy.beneficiary_type]} policy was saved. Publish it to apply the rate.`)
      setReloadKey((value) => value + 1)
    }} onReconcile={() => {
      setFormBeneficiary(null)
      setMessageWarning(true)
      setMessage('Creation could not be confirmed. Review the refreshed policy history before creating another policy.')
      setReloadKey((value) => value + 1)
    }} /> : null}
    {canManage && publishTarget ? <CommissionPublishDialog busy={publishing} error={publishError} onClose={() => setPublishTarget(null)} onConfirm={() => void publish()} policy={publishTarget} /> : null}

    {loading ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400" role="status">Loading commission policies…</p> : null}
    {loading && policies.length === 0 ? <div aria-label="Loading commission policies" className={`${panelClass} mt-5 h-40 animate-pulse`} /> : !error ? <div className={`${panelClass} mt-5 divide-y divide-slate-200 overflow-hidden dark:divide-white/10`}>
      {(['seller', 'logistics'] as CommissionBeneficiary[]).map((type) => {
        const policy = active[type]
        return <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" key={type}>
          <div><h4 className="font-semibold">{beneficiaryLabels[type]}</h4><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{policy ? `Effective ${formatDate(policy.effective_at)}` : 'No active policy. Publish a policy before accepting checkout Orders.'}</p></div>
          <div className="flex flex-wrap items-center gap-4"><p className="text-2xl font-semibold tabular-nums">{policy ? `${(policy.rate_basis_points / 100).toFixed(2)}%` : '—'}</p>{canManage ? <button className={secondaryButtonClass} disabled={busy} onClick={() => openForm(type)} type="button">Create successor</button> : null}</div>
        </article>
      })}
    </div> : null}

    {!loading && !error && policies.length === 0 ? <div className="mt-5 flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400"><FaCircleInfo aria-hidden="true" className="mt-1 shrink-0" /><p>Create and publish both Seller and Logistics commission policies before accepting checkout Orders.</p></div> : null}
    {!error && policies.length > 0 ? <CommissionPolicyHistory busy={busy} canManage={canManage} onPublish={(policy) => { setPublishError(''); setPublishTarget(policy) }} onRefresh={() => setReloadKey((value) => value + 1)} policies={policies} /> : null}
  </section>
}
