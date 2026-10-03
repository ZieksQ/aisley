import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaCircleInfo, FaPlus, FaRotate } from 'react-icons/fa6'
import { ApiError } from '../../lib/api'
import { fetchShippingRates, publishShippingRate } from '../../lib/pricingSettings'
import { philippineRegions } from '../../lib/philippineRegions'
import type { ShippingRateVersion } from '../../types/pricingSettings'
import { RegionSurchargeEditor } from './RegionSurchargeEditor'
import { ShippingTariffForm } from './ShippingTariffForm'
import { formatDate, panelClass, primaryButtonClass, secondaryButtonClass, statusClass } from './ui'

function activeRate(rates: ShippingRateVersion[]) {
  const now = Date.now()
  return rates
    .filter((rate) => rate.status === 'published' && new Date(rate.effective_at).getTime() <= now)
    .sort((first, second) => new Date(second.effective_at).getTime() - new Date(first.effective_at).getTime() || second.version_number - first.version_number)[0] ?? null
}

export function ShippingTariffPanel({ canManage }: { canManage: boolean }) {
  const [rates, setRates] = useState<ShippingRateVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedRegionCode, setSelectedRegionCode] = useState(philippineRegions[0].code)

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchShippingRates(signal)
      setRates(response.data)
    } catch (caught) {
      if (!signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load shipping tariffs.')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, reloadKey])

  const current = useMemo(() => activeRate(rates), [rates])
  const latestPublished = rates.find((rate) => rate.status === 'published') ?? null
  const displayed = current ?? latestPublished
  const surchargeValues = Object.fromEntries((displayed?.region_surcharges ?? []).map((item) => [item.destination_region, String(item.surcharge_cents / 100)]))

  async function publish(rate: ShippingRateVersion) {
    if (!window.confirm(`Publish shipping tariff version ${rate.version_number}? Checkout will use it when its effective time arrives, and it cannot be edited afterward.`)) return
    setBusyId(rate.id)
    setError('')
    setMessage('')
    try {
      await publishShippingRate(rate.id)
      setMessage(`Shipping tariff version ${rate.version_number} was published.`)
      setReloadKey((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'This tariff is no longer a draft. The latest versions have been loaded.' : caught instanceof Error ? caught.message : 'Unable to publish the shipping tariff.')
      setReloadKey((value) => value + 1)
    } finally {
      setBusyId(null)
    }
  }

  if (showForm) {
    return <ShippingTariffForm source={current ?? latestPublished} onCancel={() => setShowForm(false)} onCreated={(rate) => { setShowForm(false); setMessage(`Shipping tariff version ${rate.version_number} was saved as a draft.`); setReloadKey((value) => value + 1) }} />
  }

  return (
    <section aria-labelledby="shipping-tariff-heading" className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold" id="shipping-tariff-heading">Shipping pricing</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Set destination-region surcharges used with Logistics service rates.</p>
        </div>
        {canManage ? <button className={primaryButtonClass} onClick={() => { setMessage(''); setShowForm(true) }} type="button"><FaPlus aria-hidden="true" />New tariff version</button> : null}
      </div>

      {message ? <p className="mt-5 border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{message}</p> : null}
      {error ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert"><span>{error}</span><button className="font-semibold underline underline-offset-2" onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button></div> : null}

      {loading ? <div aria-label="Loading shipping pricing" className={`${panelClass} mt-5 h-80 animate-pulse`} /> : displayed ? (
        <div className={`${panelClass} mt-5 overflow-hidden`}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-white/10 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-lg font-semibold">{current?.id === displayed.id ? 'Active tariff' : 'Latest published tariff'}</h4>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(displayed.status)}`}>Version {displayed.version_number}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Effective {formatDate(displayed.effective_at)} · {displayed.acceptances_count} active Logistics acceptance{displayed.acceptances_count === 1 ? '' : 's'}</p>
            </div>
            {!current ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Not active yet</span> : null}
          </div>

          <dl aria-label="Read-only parcel policy" className="grid border-b border-slate-200 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Volumetric divisor" value={displayed.volumetric_divisor.toLocaleString('en-PH')} />
            <Summary label="Regional surcharges" value={`${displayed.region_surcharges.length} of ${philippineRegions.length} regions`} />
            <Summary label="Maximum parcel weight" value={`${displayed.max_weight_grams / 1000} kg`} />
            <Summary label="Maximum dimensions" value={`${displayed.max_length_mm / 10} × ${displayed.max_width_mm / 10} × ${displayed.max_height_mm / 10} cm`} />
          </dl>

          <div className="p-5 sm:p-6">
            <div className="mb-5">
              <h4 className="font-semibold">Regional surcharge overview</h4>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select a region to inspect the published amount.</p>
            </div>
            <RegionSurchargeEditor readOnly onSelect={setSelectedRegionCode} selectedCode={selectedRegionCode} values={surchargeValues} />
          </div>
        </div>
      ) : (
        <div className={`${panelClass} mt-5 p-8 text-center`}><FaCircleInfo aria-hidden="true" className="mx-auto text-lg text-slate-400" /><h4 className="mt-3 font-semibold">No shipping tariff exists</h4><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">Create a draft with destination-region surcharges, then publish it before checkout can quote shipping.</p></div>
      )}

      {!loading && rates.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4"><h4 className="font-semibold">Version history</h4><button aria-label="Refresh shipping tariff versions" className={secondaryButtonClass} onClick={() => setReloadKey((value) => value + 1)} type="button"><FaRotate aria-hidden="true" />Refresh</button></div>
          <div className={`${panelClass} mt-3 overflow-x-auto`} role="region" aria-label="Shipping tariff version history" tabIndex={0}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-400"><tr><th className="px-4 py-3 font-semibold">Version</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Regions</th><th className="px-4 py-3 font-semibold">Effective</th><th className="px-4 py-3 text-right font-semibold">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">{rates.map((rate) => <tr key={rate.id}><td className="px-4 py-3 font-semibold">v{rate.version_number}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusClass(rate.status)}`}>{rate.status}</span></td><td className="px-4 py-3">{rate.region_surcharges.length}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(rate.effective_at)}</td><td className="px-4 py-3 text-right">{canManage && rate.status === 'draft' ? <button className="font-semibold text-[#4C1268] hover:underline disabled:opacity-50 dark:text-pink-300" disabled={busyId !== null} onClick={() => void publish(rate)} type="button">{busyId === rate.id ? 'Publishing…' : 'Publish'}</button> : <span className="text-slate-400">—</span>}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-slate-200 px-5 py-4 last:border-b-0 dark:border-white/10 sm:border-r lg:border-b-0 lg:last:border-r-0"><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
}
