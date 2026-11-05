import type { CampaignPreview } from '../../lib/notificationCampaigns'
import { campaignDate, campaignNumber } from './format'

export function CampaignAudienceReview({ preview, dirty, busy, uncertain, onCalculate, onReview }: {
  preview: CampaignPreview | null
  dirty: boolean
  busy: boolean
  uncertain: boolean
  onCalculate: () => void
  onReview: () => void
}) {
  return <section className="portal-panel campaign-review" aria-labelledby="campaign-review-heading">
    <div className="campaign-section-heading">
      <h3 id="campaign-review-heading">Review audience</h3>
    </div>
    <p className="portal-secondary">Check eligible Customers for the saved revision before sending.</p>
    {dirty && <p className="campaign-advisory">Save your changes to calculate a new audience estimate.</p>}
    {uncertain && <p className="campaign-advisory">Send outcome unknown. Check status before editing or sending again.</p>}
    {preview && !dirty && <div className="campaign-audience-estimate">
      <p className="campaign-estimate-number">{campaignNumber(preview.eligible_count)}<span>eligible Customers</span>
      </p>
      <p className="portal-secondary">{preview.audience_label}</p>
      <p className="portal-secondary campaign-note">Calculated {campaignDate(preview.calculated_at)} · Revision {preview.revision}</p>
      {!preview.dispatch_allowed && <p className="campaign-advisory" role="status">A send requires 1–10,000 eligible Customers. {preview.eligible_count === 0 ? 'No Customers currently qualify.' : 'The current audience exceeds the send limit.'}</p>}
    </div>}
    <div className="portal-inline-actions campaign-review-actions">
      <button className="portal-button" disabled={busy || dirty || uncertain} onClick={onCalculate} type="button">{preview ? 'Recalculate audience' : 'Calculate audience'}</button>
      {preview?.dispatch_allowed && !dirty && !uncertain && <button className="portal-button portal-button-primary" disabled={busy} onClick={onReview} type="button">Review send</button>}
    </div>
    <p className="portal-secondary campaign-note">The estimate is advisory. Recipient eligibility is finalized when you confirm. Saving or calculating does not send a message.</p>
  </section>
}
