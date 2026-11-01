import { useCallback, useEffect, useRef, useState } from 'react'
import { LuRefreshCw } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ErrorNotice } from '../components/PickupUi'
import { PortalButton, PortalSkeleton } from '@aisley/ui/portal'
import { acceptTariff, createRateCard, loadShippingRates, publishRateCard } from '../features/shippingRates/api'
import { CoveragePanel } from '../features/shippingRates/CoveragePanel'
import { RateCardsPanel } from '../features/shippingRates/RateCardsPanel'
import { ShippingRateSections, useShippingRateSection } from '../features/shippingRates/ShippingRateSections'
import { TariffPanel } from '../features/shippingRates/TariffPanel'
import type { RateCard, RateCardDraft, ShopCategoryOption, TariffAcceptance } from '../features/shippingRates/types'
import { ApiError } from '../lib/api'

export function ShippingRatesPage() {
  const { logistics, logout } = useAuth()
  const loadId = useRef(0)
  const [loaded, setLoaded] = useState(false)
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useShippingRateSection()
  const [tariffs, setTariffs] = useState<TariffAcceptance[]>([])
  const [cards, setCards] = useState<RateCard[]>([])
  const [shopCategories, setShopCategories] = useState<ShopCategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const id = ++loadId.current
    setLoading(true)
    setError('')
    try {
      const data = await loadShippingRates()
      if (id !== loadId.current) return
      setLoaded(true)
      setTariffs(data.tariffs)
      setCards(data.cards)
      setShopCategories(data.shopCategories)
    } catch (caught) {
      if (id !== loadId.current) return
      if (caught instanceof ApiError && caught.status === 401) {
        await logout().catch(() => undefined)
        navigate('/login', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
        navigate('/policy-consent', { replace: true })
        return
      }
      setError(caught instanceof Error ? caught.message : 'Shipping rates could not be loaded.')
    } finally {
      if (id === loadId.current) setLoading(false)
    }
  }, [logistics?.id, logout, navigate])

  useEffect(() => {
    document.title = 'Shipping rates | Aisley Logistics'
    setLoaded(false)
    setTariffs([])
    setCards([])
    setShopCategories([])
    void load()
    return () => { loadId.current += 1 }
  }, [load])

  async function accept(id: string) {
    setAcceptingId(id)
    setError('')
    setNotice('')
    try { await acceptTariff(id); setNotice('Platform tariff accepted.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The tariff could not be accepted.') }
    finally { setAcceptingId(null) }
  }

  async function create(draft: RateCardDraft) {
    setError('')
    setNotice('')
    await createRateCard(draft)
    setNotice('Rate card draft created. Review it before publishing.')
    await load()
  }

  async function publish(id: string) {
    setPublishingId(id)
    setError('')
    setNotice('')
    try { await publishRateCard(id); setNotice('Rate card published. The previous published version is now archived.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The rate card could not be published.') }
    finally { setPublishingId(null) }
  }

  return <div className="portal-page shipping-rates-workspace">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="portal-page-heading">Shipping rates</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--portal-muted)]">Accept destination surcharges, review service coverage, and manage your organization's rate cards.</p>
      </div>
      <PortalButton isLoading={loading} onClick={() => void load()}>
        <LuRefreshCw aria-hidden="true" />
        Refresh
      </PortalButton>
    </div>
    <div className="mt-5">
      <ShippingRateSections active={activeTab} onChange={setActiveTab} />
    </div>
    {notice ? <p
      className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200"
      role="status">{notice}</p> : null}
    {error ? <div className="mt-4">
      <ErrorNotice message={error} retry={() => void load()} />
    </div> : null}
    {loading && !loaded ? <PortalSkeleton label="Loading shipping rates" /> : !loaded ? null : <div
      aria-labelledby={`shipping-rates-tab-${activeTab}`}
      className="mt-4"
      id={`shipping-rates-panel-${activeTab}`}
      role="tabpanel">
      {activeTab === 'tariff' ? <TariffPanel acceptingId={acceptingId} onAccept={accept} tariffs={tariffs} /> : activeTab === 'coverage' ? <CoveragePanel cards={cards} shopCategories={shopCategories} /> : <RateCardsPanel
        cards={cards}
        shopCategories={shopCategories}
        onCreate={create}
        onPublish={publish}
        publishingId={publishingId} />}
    </div>}
  </div>
}
