import { useEffect, useState } from 'react'
import { FaArrowLeft, FaRotate } from 'react-icons/fa6'
import { Link, useLocation } from 'react-router-dom'
import { fetchFinanceHold } from '../../lib/financeHolds'
import type { FinanceHold, LogisticsOrganizationOption } from '../../types/financeHolds'
import { FinanceHoldReconciliationForm } from './FinanceHoldReconciliationForm'
import { formatDate, formatMoney, panelClass, secondaryButtonClass } from '../pricing-settings/ui'

export function FinanceHoldDetail({ canManage, holdId }: { canManage: boolean; holdId: string }) {
  const location = useLocation()
  const backTo = typeof location.state === 'object' && location.state && 'from' in location.state ? `/finance-holds${String(location.state.from)}` : '/finance-holds'
  const [hold, setHold] = useState<FinanceHold | null>(null)
  const [organizations, setOrganizations] = useState<LogisticsOrganizationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchFinanceHold(holdId, controller.signal)
      .then((response) => { setHold(response.data); setOrganizations(response.organizations) })
      .catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load this Finance hold.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [holdId, reloadKey])

  if (loading) return <div aria-label="Loading Finance hold" className={`${panelClass} mt-6 h-72 animate-pulse`} />
  if (error || !hold) return <div className="mt-6 border-l-2 border-rose-600 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert"><p>{error || 'Finance hold not found.'}</p><button className={`${secondaryButtonClass} mt-4`} onClick={() => setReloadKey((value) => value + 1)} type="button"><FaRotate aria-hidden="true" />Retry</button></div>

  const pricing = hold.pricing
  const currency = hold.order?.currency ?? 'PHP'
  const organizationNames = Object.fromEntries(organizations.map((organization) => [organization.id, organization.business_name]))

  return (
    <>
      <div className="mt-6"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#4C1268] hover:underline dark:text-pink-300" to={backTo}><FaArrowLeft aria-hidden="true" />Back to Finance holds</Link></div>
      {message ? <p className="mt-5 border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{message}</p> : null}

      <section className={`${panelClass} mt-5 overflow-hidden`} aria-labelledby="finance-hold-detail-heading">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-white/10 sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold" id="finance-hold-detail-heading">Order {hold.order?.reference ?? 'unavailable'}</h3><span className={`rounded-md px-2 py-1 text-xs font-semibold ${hold.is_open ? 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>{hold.is_open ? 'Open' : 'Resolved'}</span></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hold.reason_label} · placed {formatDate(hold.placed_at)}</p></div><p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{hold.order?.shop_name}</p></div>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Logistics pool" value={formatMoney(pricing?.logistics_pool_cents ?? 0, currency)} />
          <Detail label="Customer shipping" value={formatMoney(pricing?.quoted_shipping_fee_cents ?? 0, currency)} />
          <Detail label="Selected provider" value={hold.order?.selected_logistics_organization?.business_name ?? 'Unavailable'} />
          <Detail label="Route status" value={pricing?.route_status?.replaceAll('_', ' ') ?? 'Unavailable'} />
          <Detail label="Destination" value={[pricing?.destination.city_municipality, pricing?.destination.province, pricing?.destination.region].filter(Boolean).join(', ') || 'Unavailable'} />
          <Detail label="Billable weight" value={pricing ? `${(pricing.billable_weight_grams / 1000).toFixed(3)} kg` : 'Unavailable'} />
          <Detail label={pricing?.pricing_model === 'logistics_service_base_v1' ? 'Logistics service bases' : 'Historical platform base'} value={formatMoney(pricing?.base_fee_cents ?? 0, currency)} />
          <Detail label="Category weight/size extras" value={formatMoney(pricing?.additional_weight_fee_cents ?? 0, currency)} />
          <Detail label="Region surcharge" value={formatMoney(pricing?.destination_surcharge_cents ?? 0, currency)} />
        </dl>
        {hold.notes ? <div className="border-t border-slate-200 p-5 text-sm leading-6 dark:border-white/10 sm:p-6"><p className="font-semibold">Hold note</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{hold.notes}</p></div> : null}
      </section>

      {!hold.is_open && hold.reconciliation ? (
        <section className={`${panelClass} mt-6 overflow-hidden`} aria-labelledby="hold-resolution-heading">
          <div className="border-b border-slate-200 p-5 dark:border-white/10 sm:p-6"><h3 className="font-semibold" id="hold-resolution-heading">Reconciliation</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Resolved {formatDate(hold.reconciliation.reconciled_at)} · subsidy {formatMoney(hold.reconciliation.platform_subsidy_cents, currency)}</p></div>
          <div className="divide-y divide-slate-200 dark:divide-white/10">{hold.reconciliation.allocations.map((allocation) => <div className="flex flex-col gap-1 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between" key={`${allocation.logistics_organization_id}:${allocation.service_type}`}><div><p className="font-semibold">{organizationNames[allocation.logistics_organization_id] ?? allocation.logistics_organization_id}</p><p className="mt-0.5 capitalize text-slate-500 dark:text-slate-400">{allocation.service_type.replaceAll('_', ' ')}</p></div><p className="font-semibold tabular-nums">{formatMoney(allocation.amount_cents, currency)}</p></div>)}</div>
          <div className="border-t border-slate-200 p-5 text-sm leading-6 dark:border-white/10 sm:p-6"><p className="font-semibold">Audit note</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{hold.reconciliation.notes}</p></div>
        </section>
      ) : null}

      {hold.is_open && canManage ? <FinanceHoldReconciliationForm hold={hold} organizations={organizations} onReconciled={() => { setMessage('The carrier allocations were recorded and the Finance hold was released.'); setReloadKey((value) => value + 1) }} /> : null}
      {hold.is_open && !canManage ? <p className="mt-6 border-l-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">You have read-only Finance access. An Admin with Finance management permission must reconcile this hold.</p> : null}
      {hold.is_open && canManage && organizations.length === 0 ? <p className="mt-4 text-sm text-rose-700 dark:text-rose-300" role="alert">No active Logistics organization is available for allocation.</p> : null}
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10 lg:border-r"><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words font-semibold capitalize">{value}</dd></div>
}
