import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardPeriod, ReviewSection, UnavailableSection } from '../../types/dashboard'
import type { DashboardPeriodFilter } from '../../lib/dashboard'

type Props = {
  section: ReviewSection | UnavailableSection
  period: DashboardPeriod
  refreshing: boolean
  onRefresh: () => void
  onPeriodChange: (filters: DashboardPeriodFilter) => void
}

const linkClass = 'text-sm font-medium text-[#4C1268] underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:text-fuchsia-300'
const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:border-white/20 dark:bg-[#18181b] dark:text-zinc-100'

export function DashboardReviews({ section, period, refreshing, onRefresh, onPeriodChange }: Props) {
  const [from, setFrom] = useState(period.from ?? '')
  const [to, setTo] = useState(period.to ?? '')
  const [timezone, setTimezone] = useState(period.timezone)
  const [validationError, setValidationError] = useState('')
  const hasPeriod = period.from !== null && period.to !== null

  useEffect(() => {
    setFrom(period.from ?? '')
    setTo(period.to ?? '')
    setTimezone(period.timezone)
    setValidationError('')
  }, [period.from, period.to, period.timezone])

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!from || !to) {
      setValidationError('Choose both a start and end date.')
      return
    }
    if (from > to) {
      setValidationError('The end date must be on or after the start date.')
      return
    }
    setValidationError('')
    onPeriodChange({ from, to, timezone })
  }

  return (
    <section aria-labelledby="dashboard-reviews-heading" className="mt-6 rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <div>
          <h3 className="font-semibold" id="dashboard-reviews-heading">Product reviews</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {hasPeriod ? `Published ${period.from} to ${period.to} (${period.timezone})` : 'All published reviews'}
          </p>
        </div>
        <Link className={linkClass} to="/reviews">Open reviews</Link>
      </div>

      <form className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end" onSubmit={applyPeriod}>
        <label className="text-sm font-medium">
          From
          <input className={inputClass} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        <label className="text-sm font-medium">
          To
          <input className={inputClass} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </label>
        <label className="text-sm font-medium">
          Time zone
          <select className={inputClass} onChange={(event) => setTimezone(event.target.value)} value={timezone}>
            {[...new Set(['UTC', 'Asia/Manila', timezone])].map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="h-10 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:border-white/20 dark:hover:bg-white/[0.06]" type="submit">Apply</button>
          {hasPeriod ? <button className="h-10 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-300" onClick={() => onPeriodChange({ from: '', to: '', timezone })} type="button">Clear</button> : null}
        </div>
      </form>
      {validationError ? <p className="px-5 pb-4 text-sm text-red-700 dark:text-red-300" role="alert">{validationError}</p> : null}

      {section.state === 'available' || section.state === 'empty' ? (
        <div className="border-t border-zinc-200 px-5 py-4 dark:border-white/10">
          {section.state === 'empty' ? <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">No published reviews in this period.</p> : null}
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Published reviews</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{section.metrics.total}</dd></div>
            <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Answered</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{section.metrics.answered}</dd></div>
            <div><dt className="text-sm text-zinc-600 dark:text-zinc-400">Awaiting a response</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{section.metrics.unanswered}</dd></div>
          </dl>
        </div>
      ) : (
        <div className="border-t border-zinc-200 px-5 py-4 text-sm dark:border-white/10" role="alert">
          <p>{section.state === 'error' ? 'Review totals are temporarily unavailable. Other dashboard sections are still current.' : 'Set up your Shop to see its reviews.'}</p>
          {section.state === 'error' ? <button className={`${linkClass} mt-2`} disabled={refreshing} onClick={onRefresh} type="button">Try again</button> : null}
        </div>
      )}

      <div className="border-t border-zinc-200 px-5 py-4 dark:border-white/10">
        <Link className={linkClass} to="/reviews?status=unanswered">See reviews awaiting a response</Link>
        {hasPeriod ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">The review queue shows current response status across all dates; it does not use this date filter.</p> : null}
      </div>
    </section>
  )
}
