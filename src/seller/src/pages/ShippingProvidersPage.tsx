import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaLocationDot, FaTruck } from 'react-icons/fa6'
import { useAuth } from '../auth/useAuth'
import { OrderButton, OrderError, orderPanel } from '../components/orders/OrderUi'
import { ApiError } from '../lib/api'
import { getSellerLogisticsOptions, type LogisticsOption } from '../lib/sellerLogisticsOptions'
import { getShippingProviders, type ShippingProviderSetting, updateShippingProvider } from '../lib/sellerShippingProviders'
import { useOrderAccessError } from '../lib/useSellerOrders'

type ProviderRow = ShippingProviderSetting & { recommendation: LogisticsOption | null }

export function ShippingProvidersPage() {
  const { seller } = useAuth()
  const accessError = useOrderAccessError()
  const [providers, setProviders] = useState<ShippingProviderSetting[]>([])
  const [recommendations, setRecommendations] = useState<LogisticsOption[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { document.title = 'Shipping providers | Aisley Seller' }, [])

  const load = useCallback(async (force = false) => {
    if (!seller) { setLoading(false); return }
    setLoading(true)
    setError('')
    setNotice('')
    const [settings, ranked] = await Promise.allSettled([
      getShippingProviders(),
      getSellerLogisticsOptions(seller.id, force),
    ])

    if (settings.status === 'rejected') {
      if (!accessError(settings.reason)) {
        setError(settings.reason instanceof ApiError ? settings.reason.message : 'Shipping providers could not be loaded.')
      }
      setLoading(false)
      return
    }

    setProviders(settings.value.data)
    setRecommendations(ranked.status === 'fulfilled' ? ranked.value.data : [])
    setLoading(false)
  }, [accessError, seller])

  useEffect(() => { void load() }, [load])

  const rows = useMemo<ProviderRow[]>(() => {
    const ranked = new Map(recommendations.map((provider) => [provider.id, provider]))
    const rank = new Map(recommendations.map((provider, index) => [provider.id, index]))

    return providers
      .map((provider) => ({ ...provider, recommendation: ranked.get(provider.organization_id) ?? null }))
      .sort((left, right) => {
        const leftRank = rank.get(left.organization_id) ?? Number.MAX_SAFE_INTEGER
        const rightRank = rank.get(right.organization_id) ?? Number.MAX_SAFE_INTEGER
        return leftRank - rightRank || left.business_name.localeCompare(right.business_name)
      })
  }, [providers, recommendations])

  async function toggle(provider: ShippingProviderSetting) {
    if (savingId) return
    const next = !provider.is_enabled
    setSavingId(provider.organization_id)
    setError('')
    setNotice('')
    try {
      const response = await updateShippingProvider(provider, next)
      setProviders((current) => current.map((item) => item.organization_id === provider.organization_id
        ? { ...item, is_enabled: response.data.is_enabled, revision: response.data.revision }
        : item))
      setNotice(`${provider.business_name} is now ${next ? 'available' : 'unavailable'} to Customers at checkout.`)
    } catch (reason) {
      if (!accessError(reason)) {
        setError(reason instanceof ApiError && reason.status === 409
          ? 'This provider setting changed elsewhere. The list has been refreshed.'
          : reason instanceof ApiError ? reason.message : 'The provider setting could not be saved.')
        if (reason instanceof ApiError && reason.status === 409) void load(true)
      }
    } finally { setSavingId('') }
  }

  const enabledCount = providers.filter((provider) => provider.is_enabled).length

  return <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
      <div><h2 className="text-2xl font-semibold">Shipping providers</h2><p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">Choose which providers Customers can use for new Orders from your Shop. Existing Orders keep the provider chosen at checkout.</p></div>
      <OrderButton isLoading={loading} loadingLabel="Refreshing" onClick={() => void load(true)}>Refresh</OrderButton>
    </div>

    {error ? <OrderError message={error} retry={() => void load(true)} /> : null}
    {notice ? <p className="my-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <section className={`${orderPanel} mt-5 overflow-hidden`} aria-labelledby="provider-list-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <div><h3 className="font-semibold" id="provider-list-heading">Available providers</h3><p className="mt-1 text-sm text-zinc-500">{enabledCount} of {providers.length} enabled</p></div>
        {recommendations.length ? <p className="text-xs text-zinc-500">Sorted by pickup-address match and road distance</p> : null}
      </div>

      {loading && providers.length === 0 ? <p className="p-5 text-sm text-zinc-500" role="status">Loading shipping providers…</p> : null}
      {!loading && providers.length === 0 ? <div className="p-8 text-center"><FaTruck aria-hidden="true" className="mx-auto text-zinc-400" /><p className="mt-3 text-sm font-medium">No providers are available</p><p className="mt-1 text-sm text-zinc-500">A Logistics organization needs an active account and operational hub before it can appear here.</p></div> : null}
      {rows.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{rows.map((provider) => {
        const recommendation = provider.recommendation
        const isSaving = savingId === provider.organization_id
        return <li className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={provider.organization_id}>
          <div className="min-w-0">
            <div className="flex items-start gap-3"><FaTruck aria-hidden="true" className="mt-1 shrink-0 text-[#4C1268] dark:text-purple-300" /><div className="min-w-0"><h4 className="font-medium">{provider.business_name}</h4><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{provider.hub.name}</p></div></div>
            {recommendation ? <div className="mt-3 flex items-start gap-2 border-l-2 border-zinc-300 pl-3 text-xs leading-5 text-zinc-600 dark:border-white/20 dark:text-zinc-400"><FaLocationDot aria-hidden="true" className="mt-0.5 shrink-0" /><p>{recommendationText(recommendation)}<span className="block">{providerArea(recommendation)}</span></p></div> : <p className="mt-3 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-amber-800 dark:text-amber-300">Add a complete default pickup address to see city, region, and distance recommendations.</p>}
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-t border-zinc-200 pt-4 text-sm sm:border-0 sm:pt-0" htmlFor={`provider-${provider.organization_id}`}>
            <span className="font-medium">{isSaving ? 'Saving…' : provider.is_enabled ? 'Enabled' : 'Disabled'}</span>
            <input aria-describedby={`provider-help-${provider.organization_id}`} checked={provider.is_enabled} className="size-5 accent-[#E6007A]" disabled={Boolean(savingId)} id={`provider-${provider.organization_id}`} onChange={() => void toggle(provider)} role="switch" type="checkbox" />
            <span className="sr-only" id={`provider-help-${provider.organization_id}`}>Controls whether Customers may select {provider.business_name} for new Orders.</span>
          </label>
        </li>
      })}</ul> : null}
    </section>
    {recommendations.length ? <p className="mt-3 text-[11px] text-zinc-500">Distance data © Geoapify · OpenStreetMap contributors</p> : null}
  </main>
}

function recommendationText(provider: LogisticsOption) {
  const reason = provider.recommendation_reason === 'same_city'
    ? 'Hub in the same city as your default pickup address'
    : provider.recommendation_reason === 'same_province'
      ? 'Hub in the same province as your default pickup address'
      : provider.recommendation_reason === 'same_region'
        ? 'Hub in the same region as your default pickup address'
      : provider.recommendation_reason === 'nearest_by_road'
        ? 'Nearest eligible hub by available road distance'
        : 'Eligible hub outside your city and province'
  const distance = provider.distance_km === null ? '' : ` · ${provider.distance_km.toFixed(1)} km by road`
  return `${provider.recommended ? 'Recommended · ' : ''}${reason}${distance}`
}

function providerArea(provider: LogisticsOption) {
  const { city_municipality: city, province, region } = provider.hub.area
  return [city, province, region].filter(Boolean).join(', ')
}
