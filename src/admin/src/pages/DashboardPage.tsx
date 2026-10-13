import { DashboardSkeleton } from '@aisley/ui/portal'
import { DashboardSummary } from '../components/dashboard/DashboardSummary'
import { useEffect } from 'react'
import { Button } from '@aisley/ui'
import { useAuth } from '../auth/useAuth'
import { DashboardQueueCard, dashboardButton, dashboardPanel } from '../components/dashboard/DashboardQueueCard'
import { RegistrationOverview } from '../components/dashboard/RegistrationOverview'
import { useDashboard } from '../components/dashboard/useDashboard'
import { formatDate } from '../lib/registrations'

export function DashboardPage() {
  const { admin } = useAuth()
  useEffect(() => { document.title = 'Dashboard | Aisley Admin' }, [])
  if (!admin) return null
  // Account/permission changes immediately discard the previous private snapshot.
  return <DashboardOverview key={`${admin.id}:${[...admin.permissions].sort().join(',')}`} permissions={admin.permissions} />
}

function DashboardOverview({ permissions }: { permissions: string[] }) {
  const { data, loading, error, denied, refresh } = useDashboard()
  const empty = data && !data.registrations && !data.support_tickets && !data.seller_compliance
  const queues = [
    { key: 'support_tickets' as const, permission: 'support-tickets.view', title: 'Open support tickets', destination: '/support-tickets?status=open' },
    { key: 'seller_compliance' as const, permission: 'seller_compliance.manage', title: 'Open compliance cases', destination: '/seller-compliance?status=open' },
  ]
  const visibleQueues = queues.filter((queue) => data ? Boolean(data[queue.key]) : !denied && !error && permissions.includes(queue.permission))

  return <div className="portal-page dashboard-page">
    <div className="dashboard-heading">
      <div>
        <h2 className="portal-page-heading">Administration overview</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Current work available to your Admin account.</p>
        {data && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {error || loading ? 'Last successful update (stale)' : 'Updated'} {formatDate(data.generated_at)}
        </p>}
      </div>
      <Button className={dashboardButton} disabled={loading} onClick={refresh} variant="outline">
        {loading ? 'Refreshing…' : 'Refresh dashboard'}
      </Button>
    </div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-200" role="alert">
      <p>{error}</p>
      {data && <p className="mt-2 text-sm">Previous results are stale. Refresh before relying on these counts.</p>}
      <Button className={`${dashboardButton} mt-3`} disabled={loading} onClick={refresh} variant="outline">Try again</Button>
    </div>}
    {loading && !data && <DashboardSkeleton />}
    {loading && data && <span className="sr-only" role="status">Refreshing dashboard…</span>}
    {data && !empty && <DashboardSummary data={data} />}
    {data && visibleQueues.length > 0 && <div className="grid gap-4 md:grid-cols-2">
      {visibleQueues.map((queue) => <DashboardQueueCard key={queue.key} title={queue.title}
        summary={data?.[queue.key] ?? null} loading={loading} destination={queue.destination} onRetry={refresh} />)}
    </div>}
    {data?.registrations && <RegistrationOverview overview={data.registrations} />}
    {empty && <p className={dashboardPanel}>No dashboard queues are available with your current permissions.</p>}
  </div>
}
