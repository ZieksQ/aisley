import { Link } from 'react-router-dom'
import { formatDate, roleLabel } from '../../lib/registrations'
import type { DashboardRegistrationOverview } from '../../types/dashboard'
import { dashboardLink, dashboardPanel } from './DashboardQueueCard'

export function RegistrationOverview({ overview }: { overview: DashboardRegistrationOverview }) {
  return <section aria-labelledby="registration-overview-heading" className="space-y-4">
    <h2 className="text-lg font-semibold" id="registration-overview-heading">Registration overview</h2>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <article className={dashboardPanel}>
        <h3 className="font-semibold">Pending registrations</h3>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{overview.pending.total}</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {overview.pending.total === 0 ? 'No pending registrations.' : 'Customer, Seller, and Logistics applications awaiting review.'}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
          {(['customer', 'seller', 'logistics'] as const).map((role) => <div key={role}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{roleLabel(role)}{role === 'logistics' ? '' : 's'}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{overview.pending.by_role[role]}</dd>
          </div>)}
        </dl>
        <Link className={`${dashboardLink} mt-3`} to="/registrations?status=pending">View pending registrations</Link>
      </article>
      <article className={dashboardPanel}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Registration Action Center</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{overview.action_items.length} shown</p>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Oldest pending applications first.</p>
        {overview.action_items.length === 0 ? <p className="mt-4 text-sm">No applications awaiting review.</p>
          : <ol className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {overview.action_items.map((application) => <li key={application.id}>
              <Link className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 focus-visible:outline-2 focus-visible:outline-[#E6007A]" to={`/registrations/${application.id}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{roleLabel(application.role)} application</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Submitted {formatDate(application.submitted_at)}</p>
                </div>
                <span className="text-sm font-semibold text-[#4C1268] dark:text-purple-200">Review<span className="sr-only"> {roleLabel(application.role)} application</span></span>
              </Link>
            </li>)}
          </ol>}
      </article>
    </div>
  </section>
}
