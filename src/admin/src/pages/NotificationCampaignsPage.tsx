import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LuPlus, LuRefreshCw } from 'react-icons/lu'
import { PortalPagination, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { CampaignHistory } from '../components/campaigns/CampaignHistory'
import { campaignDate, campaignNumber } from '../components/campaigns/format'
import { ApiError } from '../lib/api'
import { listCampaigns } from '../lib/notificationCampaigns'
import type { Campaign } from '../lib/notificationCampaigns'
import '../components/campaigns/campaigns.css'

export function NotificationCampaignsPage() {
  const { admin } = useAuth()
  if (!admin?.permissions.includes('notification-campaigns.view')) return <div className="portal-page">
    <PortalState title="Access restricted" description="You do not have permission to view campaigns." error />
  </div>
  return <CampaignWorkspace key={`${admin.id}:${admin.permissions.join(',')}`} canManage={admin.permissions.includes('notification-campaigns.manage')} />
}
function CampaignWorkspace({ canManage }: { canManage: boolean }) {
  const [params, setParams] = useSearchParams()
  const requestedPage = Number(params.get('page') ?? 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [result, setResult] = useState<{ data: Campaign[]; meta: { last_page: number; total: number } } | null>(null)
  const [loadedPage, setLoadedPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => { document.title = 'Campaigns | Aisley Admin' }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void listCampaigns(page, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (page > response.meta.last_page) {
        setParams(current => { const next = new URLSearchParams(current); next.set('page', String(Math.max(1, response.meta.last_page))); return next }, { replace: true })
        return
      }
      setResult(response)
      setLoadedPage(page)
      setUpdatedAt(new Date().toISOString())
    }).catch(reason => {
      if (controller.signal.aborted) return
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) { setResult(null); setDenied(true) }
      setError(reason instanceof Error ? reason.message : 'Campaign history is unavailable.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, reload, setParams])
  const current = loadedPage === page
  if (denied) return <div className="portal-page">
    <PortalState title="Access restricted" error description="Your campaign access has changed. Refresh your session to continue." />
  </div>
  return <div className="portal-page campaigns-page">
    <div className="portal-page-header">
      <div>
        <h2 className="portal-page-heading">Campaigns</h2>
        <p className="portal-page-description">In-app messages for Customers who opted in to promotions.</p>
      </div>
      <div className="portal-inline-actions">
        <button className="portal-button" disabled={loading} onClick={() => setReload(value => value + 1)} type="button">
          <LuRefreshCw aria-hidden="true" />Refresh</button>
        {canManage && <Link className="portal-button portal-button-primary" to="/notification-campaigns/new">
          <LuPlus aria-hidden="true" />New campaign</Link>}
      </div>
    </div>
    <section aria-labelledby="campaign-history-heading">
      <div className="campaign-section-heading campaign-history-heading">
        <h3 id="campaign-history-heading">Campaign history{result && current ? <span className="campaign-total">{campaignNumber(result.meta.total)}</span> : null}</h3>
        <p className="portal-secondary">{updatedAt && current ? `Updated ${campaignDate(updatedAt)}` : 'Newest first'}</p>
      </div>
      {error && <PortalState title="Could not load campaign history" description={`${error}${updatedAt && current ? ` Last updated ${campaignDate(updatedAt)}.` : ''}`} error action={<button className="portal-button" disabled={loading} onClick={() => setReload(value => value + 1)}>Retry history</button>} />}
      <div aria-busy={loading}>
        {loading && !current ? <PortalSkeleton label="Loading campaign history" />
          : result && current ? result.data.length ? <CampaignHistory campaigns={result.data} />
            : <PortalState title="No campaigns yet" description="Create a draft to prepare your first in-app message. Nothing is sent until you review and confirm."
              action={canManage ? <Link className="portal-button portal-button-primary" to="/notification-campaigns/new">Create your first draft</Link> : undefined} /> : null}
      </div>
      {result && current && <PortalPagination page={page} lastPage={result.meta.last_page} total={result.meta.total} disabled={loading}
        onPage={value => setParams(currentParams => { const next = new URLSearchParams(currentParams); if (value === 1) next.delete('page'); else next.set('page', String(value)); return next })} />}
      <p className="campaign-note portal-secondary">Persisted means saved to a Customer inbox, not read. Drafts have not been sent.</p>
    </section>
  </div>
}
