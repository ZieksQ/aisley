import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CampaignForm } from '../components/campaigns/CampaignForm'
import { ApiError } from '../lib/api'
import { createCampaign, emptyCampaign, listCampaigns } from '../lib/notificationCampaigns'
import type { Campaign, CampaignInput } from '../lib/notificationCampaigns'

export function NotificationCampaignsPage() {
  const { admin } = useAuth()
  const navigate = useNavigate()
  const canManage = admin?.permissions.includes('notification-campaigns.manage') ?? false
  const canView = admin?.permissions.includes('notification-campaigns.view') ?? false
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    document.title = 'Notification campaigns | Aisley Admin'
    if (!canView) return
    let current = true
    setLoading(true)
    listCampaigns(page).then((response) => {
      if (current) {
        setCampaigns(response.data)
        setLastPage(response.meta.last_page)
      }
    }).catch((reason) => {
      if (current) setError(reason instanceof Error ? reason.message : 'Campaign history is unavailable.')
    }).finally(() => {
      if (current) setLoading(false)
    })
    return () => { current = false }
  }, [canView, page, reload])

  async function save(input: CampaignInput) {
    setBusy(true)
    setError('')
    try {
      const result = await createCampaign(input)
      navigate(`/notification-campaigns/${result.data.id}`)
    } catch (reason) {
      setError(reason instanceof ApiError ? Object.values(reason.errors)[0]?.[0] ?? reason.message : 'The campaign could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (!canView) {
    return <p className="mx-auto max-w-5xl p-8 text-sm" role="alert">You do not have permission to view notification campaigns.</p>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-8">
      <div>
        <h2 className="text-xl font-semibold">In-app notification campaigns</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Compose Customer messages and review delivery results. This does not send browser push or SMS.</p>
      </div>
      {error && (
        <p className="border-l-2 border-rose-600 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert">
          {error} <button className="ml-2 underline" onClick={() => setReload((value) => value + 1)} type="button">Retry</button>
        </p>
      )}
      {canManage && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#180f20]">
          <h3 className="mb-4 font-semibold">New draft</h3>
          <CampaignForm busy={busy} buttonLabel="Create draft" initial={emptyCampaign} onSave={save} />
        </section>
      )}
      <section>
        <h3 className="mb-3 font-semibold">Campaign history</h3>
        <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#180f20]">
          {loading ? <p className="p-5 text-sm text-slate-500">Loading campaigns…</p> : campaigns.length === 0 ? <p className="p-5 text-sm text-slate-500">No campaigns yet.</p> : campaigns.map((campaign) => (
            <Link className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-white/5" key={campaign.id} to={`/notification-campaigns/${campaign.id}`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{campaign.title}</span>
                <span className="text-xs text-slate-500">{new Date(campaign.created_at).toLocaleString()} · {campaign.audience_label}</span>
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-300">{campaign.status.replaceAll('_', ' ')} · {campaign.delivered_count}/{campaign.snapshot_count} persisted</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button>
          <span>{page} / {lastPage}</span>
          <button disabled={page >= lastPage} onClick={() => setPage(page + 1)} type="button">Next</button>
        </div>
      </section>
    </div>
  )
}
