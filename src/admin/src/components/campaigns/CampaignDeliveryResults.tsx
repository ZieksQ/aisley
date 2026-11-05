import type { Campaign } from '../../lib/notificationCampaigns'
import { campaignDate, campaignNumber } from './format'

export function CampaignDeliveryResults({ campaign }: { campaign: Campaign }) {
  const selecting = campaign.status === 'preparing'
  const active = ['preparing', 'queued', 'sending'].includes(campaign.status)
  const description = selecting ? 'Recipient selection is in progress. Delivery starts after the snapshot is complete.'
    : active ? 'Delivery is in progress. Results refresh every five seconds from the server.'
      : campaign.status === 'completed' ? 'Processing is complete. Review the persisted and skipped results below.'
        : 'Some delivery work did not complete. These results reflect the server’s current record.'
  return <section className="portal-panel campaign-results" aria-labelledby="campaign-results-heading">
    <div className="campaign-section-heading">
      <h3 id="campaign-results-heading">Delivery results</h3>
    </div>
    <p className="portal-secondary">{description}</p>
    <dl className="campaign-result-grid">
      {[
        ['Frozen audience', selecting ? 'Selecting' : campaignNumber(campaign.snapshot_count)],
        ['Persisted', campaignNumber(campaign.delivered_count)],
        ['Skipped', campaignNumber(campaign.skipped_count)],
        ['Failed', campaignNumber(campaign.failed_count)],
      ].map(([label, value]) => <div key={label} data-result={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>)}
    </dl>
    <p className="portal-secondary campaign-note">Persisted means saved to the Customer inbox, not read. Skipped Customers were no longer eligible at delivery time.</p>
    <dl className="campaign-facts">
      <div>
        <dt>Audience</dt>
        <dd>{campaign.audience_label}</dd>
      </div>
      <div>
        <dt>Confirmed</dt>
        <dd>{campaignDate(campaign.confirmed_at)}</dd>
      </div>
      <div>
        <dt>Completed</dt>
        <dd>{campaignDate(campaign.completed_at)}</dd>
      </div>
    </dl>
  </section>
}
