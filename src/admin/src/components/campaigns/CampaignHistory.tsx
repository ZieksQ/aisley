import { Link } from 'react-router-dom'
import { LuChevronRight } from 'react-icons/lu'
import { CampaignStatusBadge } from './presentation'
import { campaignDate, campaignNumber } from './format'
import type { Campaign } from '../../lib/notificationCampaigns'

export function CampaignHistory({ campaigns }: { campaigns: Campaign[] }) {
  return <div className="campaign-history">
    <div className="campaign-history-head" aria-hidden="true">
      <span>Campaign / audience</span>
      <span>Status</span>
      <span>Created</span>
      <span>Persisted / audience</span>
      <span />
    </div>
    <ul aria-label="Campaign history">
      {campaigns.map(campaign => <li key={campaign.id}>
        <Link className="campaign-row" to={`/notification-campaigns/${campaign.id}`}>
          <div className="campaign-row-identity">
            <span className="campaign-row-title">{campaign.title}</span>
            <span className="portal-secondary">{campaign.audience_label}</span>
          </div>
          <div className="campaign-row-status">
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <time className="campaign-row-date portal-secondary" dateTime={campaign.created_at}>{campaignDate(campaign.created_at)}</time>
          <div className="campaign-row-count">{['draft', 'preparing'].includes(campaign.status)
            ? <span className="portal-secondary">{campaign.status === 'draft' ? 'Not sent' : 'Selecting audience'}</span>
            : <>
              <span className="sr-only">Persisted / frozen audience: </span>
              <span>{campaignNumber(campaign.delivered_count)}</span>
              <span className="portal-secondary"> / {campaignNumber(campaign.snapshot_count)}</span>
              <span className="campaign-mobile-label portal-secondary"> persisted</span>
            </>}
          </div>
          <LuChevronRight className="campaign-row-chevron" aria-hidden="true" />
        </Link>
      </li>)}
    </ul>
  </div>
}
