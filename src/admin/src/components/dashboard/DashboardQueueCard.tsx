import { Button } from '@aisley/ui'
import { Link } from 'react-router-dom'
import type { DashboardQueueSummary } from '../../types/dashboard'

export const dashboardPanel = 'rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#17141b]'
export const dashboardLink = 'inline-flex min-h-11 items-center text-sm font-semibold text-[#4C1268] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:text-purple-200'
export const dashboardButton = 'min-h-11! rounded-lg! border border-slate-300 px-4 py-2 text-sm shadow-none! focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-[#E6007A]! dark:border-white/20 dark:bg-[#17141b]! dark:text-white! dark:hover:bg-white/10!'

export function DashboardQueueCard({ title, summary, loading, destination, onRetry }: {
  title: string
  summary: DashboardQueueSummary | null
  loading: boolean
  destination: string
  onRetry: () => void
}) {
  return <section className={dashboardPanel} aria-label={title} aria-busy={loading}>
    <h3 className="font-semibold">{title}</h3>
    {loading && !summary ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400" role="status">Loading count…</p>
      : summary?.state === 'ready' ? <>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{summary.count}</p>
        {summary.count === 0 && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No open records.</p>}
      </> : <>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" role="status">Count unavailable. Other sections may still be available.</p>
        <Button className={`${dashboardButton} mt-3`} disabled={loading} onClick={onRetry} variant="outline">Retry count</Button>
      </>}
    <Link className={`${dashboardLink} mt-3`} to={destination}>View open queue</Link>
  </section>
}
