import { Link } from 'react-router-dom'
import { LuArrowUpRight, LuClipboardList } from 'react-icons/lu'
import { formatDate, roleLabel } from '../../lib/registrations'
import type { DashboardRegistrationOverview } from '../../types/dashboard'

export function RegistrationOverview({ overview }: { overview: DashboardRegistrationOverview }) {
  return <section className="portal-panel" aria-labelledby="registration-overview-heading">
    <div className="dashboard-panel-header">
      <div><h3 id="registration-overview-heading">Applications to review</h3><p>Oldest first · {overview.action_items.length} of {overview.pending.total} shown</p></div>
      <Link className="portal-link inline-flex min-h-11 items-center gap-2 text-sm" to="/registrations?status=pending">All applications <LuArrowUpRight aria-hidden="true" /></Link>
    </div>
    {overview.action_items.length === 0 ? <p className="portal-secondary py-8 text-sm">No applications awaiting review.</p> : <ol className="dashboard-work-list">
      {overview.action_items.map((application) => <li key={application.id}>
        <Link to={`/registrations/${application.id}`}>
          <span className="dashboard-work-icon" aria-hidden="true"><LuClipboardList size={19} /></span>
          <div><strong className="font-medium">{roleLabel(application.role)} application</strong><p>Submitted {formatDate(application.submitted_at)}</p></div>
          <span className="dashboard-work-count portal-link">Review</span><LuArrowUpRight aria-hidden="true" />
        </Link>
      </li>)}
    </ol>}
  </section>
}
