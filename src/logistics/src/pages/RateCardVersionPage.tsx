import { useEffect, useState } from 'react'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PortalButton, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { loadRateCards } from '../features/shippingRates/api'
import { manilaDate } from '../features/shippingRates/formatters'
import { RateCardPricing } from '../features/shippingRates/RateCardPricing'
import type { RateCard } from '../features/shippingRates/types'
import { ApiError } from '../lib/api'

export function RateCardVersionPage() {
  const { cardId = '' } = useParams()
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const [card, setCard] = useState<RateCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    document.title = 'Rate card version | Aisley Logistics'
    setCard(null)
    setLoading(true)
    setError('')
    void loadRateCards().then((response) => {
      if (active) setCard(response.data.find((item) => item.id === cardId) ?? null)
    }).catch(async (caught: unknown) => {
      if (!active) return
      if (caught instanceof ApiError && caught.status === 401) {
        await logout().catch(() => undefined)
        if (active) navigate('/login', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
        navigate('/policy-consent', { replace: true })
        return
      }
      setError(caught instanceof Error ? caught.message : 'Rate card information could not be loaded.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [cardId, logistics?.id, logout, navigate, refresh])

  return <div className="portal-page space-y-6">
    <Link className="portal-button portal-button-ghost" to="/shipping-rates?view=rate-cards">
      <LuArrowLeft aria-hidden="true" />
      Back to rate cards
    </Link>
    <header className="portal-page-header">
      <div>
        <h2 className="portal-page-heading">{card ? `Rate card · Version ${card.version_number}` : 'Rate card version'}</h2>
        <p className="portal-page-description">Service fees, category rules, and parcel limits for this immutable version.</p>
      </div>
      <PortalButton isLoading={loading} onClick={() => setRefresh((value) => value + 1)}>
        <LuRefreshCw aria-hidden="true" />
        Refresh
      </PortalButton>
    </header>
    {loading ? <PortalSkeleton label="Loading rate card version" /> : error ? <PortalState
      error
      title="Rate card could not be loaded"
      description={error}
      action={<PortalButton onClick={() => setRefresh((value) => value + 1)}>
        Try again
      </PortalButton>} /> : card ? <>
        <section className="portal-panel">
          <dl className="portal-definition-list lg:grid-cols-4">
            <div>
              <dt>Status</dt>
              <dd><span
                className={`portal-tag capitalize ${card.status === 'published' ? 'portal-tag-success' : card.status === 'draft' ? 'portal-tag-warning' : ''}`}>{card.status}</span></dd>
            </div>
            <div>
              <dt>Effective · Manila time</dt>
              <dd>{manilaDate(card.effective_at)}</dd>
            </div>
            <div>
              <dt>Published · Manila time</dt>
              <dd>{card.published_at ? manilaDate(card.published_at) : 'Not published'}</dd>
            </div>
            <div>
              <dt>Currency / revision</dt>
              <dd>{card.currency} · {card.revision}</dd>
            </div>
          </dl>
        </section>
        {card.status === 'published' && new Date(card.effective_at).getTime() > Date.now() ? <p className="portal-feedback" role="status">Published, but not yet effective. This version takes effect {manilaDate(card.effective_at)}.</p> : null}
        <RateCardPricing card={card} />
      </> : <PortalState
      title="Rate card unavailable"
      description="This version does not exist or is unavailable to your organization." />}
  </div>
}
