import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CampaignForm } from '../components/campaigns/CampaignForm'
import { ApiError } from '../lib/api'
import { getCampaign, previewCampaign, sendCampaign, updateCampaign } from '../lib/notificationCampaigns'
import type { Campaign, CampaignInput, CampaignPreview } from '../lib/notificationCampaigns'

function message(error: unknown) {
  if (error instanceof ApiError) return Object.values(error.errors)[0]?.[0] ?? error.message
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

export function NotificationCampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { admin } = useAuth()
  const canView = admin?.permissions.includes('notification-campaigns.view') ?? false
  const canManage = admin?.permissions.includes('notification-campaigns.manage') ?? false
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const sendKey = useRef<string | null>(null)
  const activeStatus = campaign?.status

  const refresh = useCallback(async () => {
    if (!campaignId) return
    const result = await getCampaign(campaignId)
    setCampaign(result.data)
  }, [campaignId])

  useEffect(() => {
    document.title = 'Notification campaign | Aisley Admin'
    if (!canView) return
    let current = true
    getCampaign(campaignId ?? '').then((response) => {
      if (current) setCampaign(response.data)
    }).catch((reason) => {
      if (current) setError(message(reason))
    }).finally(() => {
      if (current) setLoading(false)
    })
    return () => { current = false }
  }, [campaignId, canView])

  useEffect(() => {
    if (!activeStatus || !['preparing', 'queued', 'sending'].includes(activeStatus)) return
    const timer = window.setInterval(() => {
      void refresh().catch((reason) => setError(message(reason)))
    }, 5000)
    return () => window.clearInterval(timer)
  }, [activeStatus, refresh])

  async function save(input: CampaignInput) {
    if (!campaignId || !campaign) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await updateCampaign(campaignId, input, campaign.revision)
      setCampaign(response.data)
      setPreview(null)
      setConfirming(false)
      setNotice('Draft saved. Preview the updated revision before sending.')
    } catch (reason) {
      setError(message(reason))
      if (reason instanceof ApiError && reason.status === 409) void refresh()
    } finally {
      setBusy(false)
    }
  }

  async function calculatePreview() {
    if (!campaignId || !campaign) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await previewCampaign(campaignId, campaign.revision)
      setPreview(result.data)
      await refresh()
    } catch (reason) {
      setError(message(reason))
      if (reason instanceof ApiError && reason.status === 409) void refresh()
    } finally {
      setBusy(false)
    }
  }

  async function confirmSend() {
    if (!campaignId || !campaign || !preview?.dispatch_allowed) return
    setBusy(true)
    setError('')
    setNotice('')
    sendKey.current ??= crypto.randomUUID()
    try {
      const result = await sendCampaign(campaignId, campaign.revision, sendKey.current)
      setCampaign(result.data)
      setConfirming(false)
      setNotice('Campaign queued. Persisted delivery results will update here.')
    } catch (reason) {
      try {
        await refresh()
      } catch { /* Keep the same idempotency key for the next retry. */ }
      setError(`${message(reason)} The campaign was refreshed; if it is still a draft, retry with the same send request.`)
    } finally {
      setBusy(false)
    }
  }

  if (!canView) {
    return <p className="mx-auto max-w-5xl p-8 text-sm" role="alert">You do not have permission to view notification campaigns.</p>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
      <Link className="text-sm font-medium text-[#4C1268] dark:text-pink-300" to="/notification-campaigns">← Campaign history</Link>
      {loading ? (
        <p className="text-sm text-slate-500">Loading campaign…</p>
      ) : !campaign ? (
        <p className="text-sm text-rose-700" role="alert">{error || 'Campaign not found.'}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{campaign.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{campaign.status.replaceAll('_', ' ')} · Revision {campaign.revision}</p>
            </div>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-white/20" onClick={() => void refresh().catch((reason) => setError(message(reason)))} type="button">Refresh status</button>
          </div>
          {notice && <p className="border-l-2 border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p>}
          {error && <p className="border-l-2 border-rose-600 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert">{error}</p>}
          {campaign.status === 'draft' ? (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#180f20]">
                <h3 className="mb-4 font-semibold">Draft message</h3>
                {canManage ? (
                  <CampaignForm busy={busy} buttonLabel="Save draft" initial={campaign} key={campaign.revision} onSave={save} />
                ) : <p className="whitespace-pre-wrap text-sm">{campaign.body}</p>}
              </section>
              {canManage && (
                <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#180f20]">
                  <h3 className="font-semibold">Preview and send</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The count is advisory. Eligible recipients are frozen when you confirm.</p>
                  <button className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/20" disabled={busy} onClick={() => void calculatePreview()} type="button">Calculate eligible audience</button>
                  {preview && (
                    <div className="mt-4 border-t border-slate-200 pt-4 text-sm dark:border-white/10">
                      <p>{preview.audience_label}: <strong>{preview.eligible_count}</strong> eligible at {new Date(preview.calculated_at).toLocaleString()}</p>
                      {!preview.dispatch_allowed && <p className="mt-2 text-amber-700 dark:text-amber-300">A send requires 1–10,000 eligible Customers.</p>}
                    </div>
                  )}
                  {preview?.dispatch_allowed && !confirming && (
                    <button className="mt-4 rounded-md bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => setConfirming(true)} type="button">Review send</button>
                  )}
                  {confirming && (
                    <div aria-label="Confirm campaign send" className="mt-4 border border-slate-300 p-4 text-sm dark:border-white/20" role="group">
                      <h4 className="font-semibold">Confirm send</h4>
                      <p className="mt-2">{campaign.title}</p>
                      <p className="mt-1 whitespace-pre-wrap">{campaign.body}</p>
                      <p className="mt-3">Audience: {preview?.audience_label} · Estimated {preview?.eligible_count}</p>
                      <div className="mt-4 flex gap-2">
                        <button className="rounded-md bg-[#4C1268] px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void confirmSend()} type="button">{busy ? 'Sending…' : 'Confirm and queue'}</button>
                        <button className="rounded-md border border-slate-300 px-4 py-2 dark:border-white/20" disabled={busy} onClick={() => setConfirming(false)} type="button">Cancel</button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#180f20]">
              <h3 className="font-semibold">Delivery results</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{campaign.body}</p>
              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm dark:border-white/10 sm:grid-cols-4">
                <div><dt>Frozen audience</dt><dd className="font-semibold">{campaign.snapshot_count}</dd></div>
                <div><dt>Persisted</dt><dd className="font-semibold">{campaign.delivered_count}</dd></div>
                <div><dt>Skipped</dt><dd className="font-semibold">{campaign.skipped_count}</dd></div>
                <div><dt>Failed</dt><dd className="font-semibold">{campaign.failed_count}</dd></div>
              </dl>
              <p className="mt-4 text-xs text-slate-500">Persisted means saved to the Customer inbox, not read by a Customer.</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
