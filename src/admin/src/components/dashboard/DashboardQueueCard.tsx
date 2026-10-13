import { Button } from '@aisley/ui'
import { LuArrowUpRight, LuMessagesSquare, LuStore } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { DashboardQueueSummary } from '../../types/dashboard'

export const dashboardPanel = 'portal-panel'
export const dashboardButton = 'portal-button'

export function DashboardQueueCard({ title, summary, loading, destination, onRetry }: {
  title: string
  summary: DashboardQueueSummary | null
  loading: boolean
  destination: string
  onRetry: () => void
}) {
  const support = destination.startsWith('/support-tickets')
  const Icon = support ? LuMessagesSquare : LuStore
  return <section className="portal-panel" aria-label={title} aria-busy={loading}>
    <div className="dashboard-panel-header">
      <span className="dashboard-work-icon" aria-hidden="true"><Icon size={19} /></span>
      <h3 className="flex-1">{title}</h3>
      {summary?.state === 'ready' && <strong className="text-lg tabular-nums">{summary.count}</strong>}
    </div>
    {loading && !summary ? <div className="skeleton-block skeleton-label mt-4" role="status" aria-label="Loading count" />
      : summary?.state === 'ready' ? <p className="portal-secondary mt-4 text-sm">{summary.count === 0 ? 'The open queue is clear.' : support ? 'Review incoming tickets and route them to the right assignee.' : 'Review Seller cases and their supporting evidence.'}</p>
        : <div className="mt-4" role="status"><p className="portal-secondary text-sm">Count unavailable. Other sections may still be available.</p><Button className={`${dashboardButton} mt-3`} disabled={loading} onClick={onRetry} variant="outline">Retry count</Button></div>}
    <Link className="portal-link mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium" to={destination}>Open work queue <LuArrowUpRight aria-hidden="true" /></Link>
  </section>
}
