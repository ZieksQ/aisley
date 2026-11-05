import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import { ConfirmationDialog, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { CampaignForm } from '../components/campaigns/CampaignForm'
import { CampaignAudienceReview } from '../components/campaigns/CampaignAudienceReview'
import { CampaignDeliveryResults } from '../components/campaigns/CampaignDeliveryResults'
import { CampaignNavigationGuard } from '../components/campaigns/CampaignNavigationGuard'
import { CampaignDestination, CampaignMessagePreview, CampaignStatusBadge } from '../components/campaigns/presentation'
import { campaignDate, campaignNumber } from '../components/campaigns/format'
import { useCampaignEditor } from '../components/campaigns/useCampaignEditor'
import '../components/campaigns/campaigns.css'

export function NotificationCampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { admin } = useAuth()
  const canManage = admin?.permissions.includes('notification-campaigns.manage') ?? false
  if (!admin?.permissions.includes('notification-campaigns.view') || (!campaignId && !canManage))
    return <div className="portal-page">
      <PortalState title="Access restricted" description="You do not have permission to open this campaign workspace." error />
    </div>
  return <CampaignEditor key={`${admin.id}:${admin.permissions.join(',')}:${campaignId ?? 'new'}`} id={campaignId} canManage={canManage} />
}
function CampaignEditor({ id, canManage }: { id?: string; canManage: boolean }) {
  const editor = useCampaignEditor(id, canManage)
  const { campaign, input, preview, dirty, busy, uncertain } = editor
  const [confirming, setConfirming] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { document.title = `${id ? 'Campaign detail' : 'New campaign'} | Aisley Admin` }, [id])
  useEffect(() => { if (editor.createdId) navigate(`/notification-campaigns/${editor.createdId}`, { replace: true }) }, [editor.createdId, navigate])
  if (editor.denied) return <div className="portal-page">
    <PortalState title="Access restricted" description="Your campaign access has changed. Refresh your session to continue." error />
  </div>
  const isDraft = !id || campaign?.status === 'draft'
  const locked = busy || editor.refreshing || uncertain
  return <div className="portal-page campaigns-page">
    <CampaignNavigationGuard dirty={dirty && isDraft && canManage} busy={busy} uncertain={uncertain} />
    <Link className="portal-link campaign-back" to="/notification-campaigns">
      <LuArrowLeft aria-hidden="true" />Campaign history</Link>
    <div className="portal-page-header">
      <div>
        <h2 className="portal-page-heading">{!id ? 'New campaign' : isDraft ? 'Campaign draft' : 'Campaign delivery'}</h2>
        <p className="portal-page-description">{!id ? 'Prepare an in-app message. Review and confirm before sending.' : campaign?.title ?? 'Review the message and its delivery status.'}</p>
        {campaign && <div className="campaign-detail-meta">
          <CampaignStatusBadge status={campaign.status} />
          <span>Revision {campaign.revision}</span>
          <span>Created {campaignDate(campaign.created_at)}</span>
        </div>}
      </div>
      {id && <div className="campaign-refresh">
        <button className="portal-button" disabled={busy || editor.refreshing} onClick={() => void editor.refresh()} type="button">
          <LuRefreshCw aria-hidden="true" />{editor.refreshing ? 'Checking…' : 'Check status'}</button>
        {editor.updatedAt && <p className="portal-secondary">Updated {campaignDate(editor.updatedAt)}</p>}
      </div>}
    </div>
    {editor.notice && <p className="campaign-notice" role="status">{editor.notice}</p>}
    {editor.error && <PortalState title={editor.error.operation === 'load' ? 'Could not load campaign status' : `Could not ${editor.error.operation === 'preview' ? 'calculate audience' : editor.error.operation === 'send' ? 'confirm the send outcome' : 'save the draft'}`}
      description={`${editor.error.message}${uncertain ? ' Check status to reconcile this request. Editing and sending are paused.' : ''}`} error
      action={editor.error.operation === 'load' || uncertain ? <button className="portal-button" disabled={busy || editor.refreshing} onClick={() => void editor.refresh()}>Retry status check</button> : undefined} />}
    {editor.loading ? <PortalSkeleton label="Loading campaign" /> : id && !campaign ? (!editor.error && <PortalState title="Campaign unavailable" description="Return to campaign history to choose another campaign." />) : <>
      {isDraft && canManage ? <div className="campaign-editor-grid">
        <CampaignForm input={input} busy={locked} dirty={dirty} errors={editor.errors} onChange={editor.change} onSave={() => void editor.save()} isNew={!id} />
        <div className="campaign-editor-aside">
          <CampaignMessagePreview input={input} />
          {campaign && id && <CampaignAudienceReview preview={preview} dirty={dirty} busy={busy || editor.refreshing} uncertain={uncertain} onCalculate={() => void editor.calculate()} onReview={() => setConfirming(true)} />}
          {!id && <section className="portal-panel campaign-review">
            <h3>Before you send</h3>
            <p className="portal-secondary">Create the draft first, then calculate the eligible audience and review the saved message. You will confirm once more before it is queued.</p>
          </section>}
          {campaign && editor.conflict && <CampaignMessagePreview input={campaign} saved />}
        </div>
      </div> : campaign && (campaign.status === 'draft' ? <div className="campaign-editor-grid">
        <CampaignMessagePreview input={campaign} saved />
        <section className="portal-panel campaign-review">
          <h3>Draft details</h3>
          <p className="portal-secondary">{campaign.audience_label}</p>
          <p className="campaign-note">This draft has not been sent. Your access allows viewing campaigns only.</p>
        </section>
      </div> : <div className="campaign-editor-grid">
        <CampaignDeliveryResults campaign={campaign} />
        <CampaignMessagePreview input={campaign} saved />
      </div>)}
    </>}
    {confirming && campaign?.status === 'draft' && preview?.dispatch_allowed && !dirty && !uncertain && <ConfirmationDialog
      title="Send this campaign?" confirmLabel="Confirm and queue" busy={busy} confirmDisabled={editor.refreshing}
      onClose={() => setConfirming(false)} onConfirm={() => { void editor.send().finally(() => setConfirming(false)) }}>
      <div className="campaign-confirm-message">
        <p className="campaign-message-title">{campaign.title}</p>
        <p className="campaign-message-body">{campaign.body}</p>
        <CampaignDestination input={campaign} />
      </div>
      <p>{preview.audience_label}: approximately <strong>{campaignNumber(preview.eligible_count)}</strong> Customers.</p>
      <p>Revision {campaign.revision}. Eligibility is finalized on confirmation. Once queued, the message cannot be edited.</p>
    </ConfirmationDialog>}
  </div>
}
