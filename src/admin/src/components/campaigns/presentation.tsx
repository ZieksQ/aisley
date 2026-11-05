import type { CampaignInput, CampaignStatus } from '../../lib/notificationCampaigns'

const labels: Record<CampaignStatus, string> = {
  draft: 'Draft', preparing: 'Selecting recipients', queued: 'Queued', sending: 'Sending',
  completed: 'Completed', partially_failed: 'Partially failed', failed: 'Failed',
}
export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <span className="campaign-status" data-status={status}>{labels[status]}</span>
}
export function CampaignDestination({ input }: { input: CampaignInput }) {
  return <span className="campaign-destination">{input.destination_type
    ? `${input.destination_type === 'product' ? 'Product' : 'Shop'} · ${input.destination_id || 'ID required'}`
    : 'No destination'}</span>
}
export function CampaignMessagePreview({ input, saved = false }: { input: CampaignInput; saved?: boolean }) {
  return <section className="portal-panel campaign-preview" aria-label={saved ? 'Saved message' : 'Message preview'}>
    <div className="campaign-section-heading">
      <h3>{saved ? 'Saved message' : 'Message preview'}</h3>
      <span className="portal-secondary">In-app inbox</span>
    </div>
    <div className="campaign-inbox-message">
      <p className="campaign-message-title">{input.title || 'Your campaign title'}</p>
      <p className="campaign-message-body">{input.body || 'Your message will appear here as you write.'}</p>
      <CampaignDestination input={input} />
    </div>
    <p className="portal-secondary campaign-note">{saved ? 'Plain-text message saved for this campaign.' : 'Preview only. Saving a draft does not send a notification.'}</p>
  </section>
}
