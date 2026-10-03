import { useCallback, useEffect, useState } from 'react'
import { FaArrowsRotate } from 'react-icons/fa6'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ActionButton, ErrorNotice } from '../components/PickupUi'
import { acceptTariff, createRateCard, loadShippingRates, publishRateCard } from '../features/shippingRates/api'
import { CoveragePanel } from '../features/shippingRates/CoveragePanel'
import { RateCardsPanel } from '../features/shippingRates/RateCardsPanel'
import { ShippingRateSections, useShippingRateSection } from '../features/shippingRates/ShippingRateSections'
import { TariffPanel } from '../features/shippingRates/TariffPanel'
import type { RateCard, RateCardDraft, ShopCategoryOption, TariffAcceptance } from '../features/shippingRates/types'
import { ApiError } from '../lib/api'

export function ShippingRatesPage() {
  const { logout } = useAuth()
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
    setLoading(true)
    setError('')
    try {
      const data = await loadShippingRates()
      setTariffs(data.tariffs)
      setCards(data.cards)
      setShopCategories(data.shopCategories)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await logout().catch(() => undefined)
        navigate('/login', { replace: true })
        return
      }
      setError(caught instanceof Error ? caught.message : 'Shipping rates could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [logout, navigate])

  useEffect(() => { document.title = 'Shipping rates | Aisley Logistics'; void load() }, [load])

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

  return <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Shipping rates</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Accept destination surcharges, review service coverage, and manage your organization's rate cards.</p></div><ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton></div>
    <div className="mt-5"><ShippingRateSections active={activeTab} onChange={setActiveTab} /></div>
    {notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {loading && !tariffs.length && !cards.length ? <div aria-label="Loading shipping rates" className="mt-4 space-y-3" role="status"><div className="h-24 animate-pulse border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" /><div className="h-52 animate-pulse border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" /></div> : <div aria-labelledby={`shipping-rates-tab-${activeTab}`} className="mt-4" id={`shipping-rates-panel-${activeTab}`} role="tabpanel">{activeTab === 'tariff' ? <TariffPanel acceptingId={acceptingId} onAccept={accept} tariffs={tariffs} /> : activeTab === 'coverage' ? <CoveragePanel cards={cards} shopCategories={shopCategories} /> : <RateCardsPanel cards={cards} shopCategories={shopCategories} onCreate={create} onPublish={publish} publishingId={publishingId} />}</div>}
  </div>
}
