import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  FaChevronLeft,
  FaChevronRight,
  FaClockRotateLeft,
  FaMagnifyingGlass,
  FaRotateRight,
  FaSliders,
} from 'react-icons/fa6'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from '../lib/api'
import { formatAuditDate, targetDescription } from '../lib/auditLogs'
import type {
  AuditLogListResponse,
  AuditLogOptionsResponse,
} from '../types/auditLogs'

const emptyOptions: AuditLogOptionsResponse = {
  actors: [],
  source_features: [],
  actions: [],
  target_types: [],
}

export function AuditLogsPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const actorId = searchParams.get('actor_id') ?? ''
  const sourceFeature = searchParams.get('source_feature') ?? ''
  const action = searchParams.get('action') ?? ''
  const targetType = searchParams.get('target_type') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [draftSearch, setDraftSearch] = useState(search)
  const [response, setResponse] = useState<AuditLogListResponse | null>(null)
  const [options, setOptions] = useState<AuditLogOptionsResponse>(emptyOptions)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const queryString = searchParams.toString()
  const hasFilters = Boolean(search || actorId || sourceFeature || action || targetType || from || to || sort === 'oldest')

  useEffect(() => {
    document.title = 'System audit logs | Aisley Admin'
  }, [])

  useEffect(() => {
    setDraftSearch(search)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({
      sort,
      page: String(page),
      per_page: '20',
    })
    if (search) query.set('search', search)
    if (actorId) query.set('actor_id', actorId)
    if (sourceFeature) query.set('source_feature', sourceFeature)
    if (action) query.set('action', action)
    if (targetType) query.set('target_type', targetType)
    if (from) query.set('from', from)
    if (to) query.set('to', to)

    setIsLoading(true)
    setError(null)

    Promise.all([
      apiRequest<AuditLogListResponse>(`/api/v1/admin/audit-logs?${query}`, {
        signal: controller.signal,
      }),
      apiRequest<AuditLogOptionsResponse>('/api/v1/admin/audit-logs/options', {
        signal: controller.signal,
      }),
    ])
      .then(([logs, filterOptions]) => {
        setResponse(logs)
        setOptions(filterOptions)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load system audit logs.',
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [action, actorId, from, logout, navigate, page, queryString, reloadKey, search, sort, sourceFeature, targetType, to])

  function updateFilters(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    if (!Object.hasOwn(updates, 'page')) next.delete('page')
    setSearchParams(next)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateFilters({ search: draftSearch.trim() })
  }

  function clearFilters() {
    setDraftSearch('')
    setSearchParams(new URLSearchParams())
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E6007A]">Administrative history</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">System audit logs</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Review the immutable history of sensitive administrator actions and their recorded changes.
          </p>
        </div>
        {response && !isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {response.meta.total} {response.meta.total === 1 ? 'event' : 'events'}
          </p>
        )}
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
        <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FaSliders aria-hidden="true" className="text-[#E6007A]" />
            Find an audit event
          </div>

          <form className="mt-4 flex gap-2" onSubmit={submitSearch} role="search">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search audit logs</span>
              <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10"
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Search event, actor, action, or target ID"
                type="search"
                value={draftSearch}
              />
            </label>
            <button className="rounded-xl bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#c8006b]" type="submit">
              Search
            </button>
          </form>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect label="Actor" onChange={(value) => updateFilters({ actor_id: value })} value={actorId}>
              <option value="">All administrators</option>
              {options.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Feature" onChange={(value) => updateFilters({ source_feature: value })} value={sourceFeature}>
              <option value="">All features</option>
              {options.source_features.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </FilterSelect>
            <FilterSelect label="Action" onChange={(value) => updateFilters({ action: value })} value={action}>
              <option value="">All actions</option>
              {options.actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </FilterSelect>
            <FilterSelect label="Target type" onChange={(value) => updateFilters({ target_type: value })} value={targetType}>
              <option value="">All target types</option>
              {options.target_types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </FilterSelect>
            <DateFilter label="From date" onChange={(value) => updateFilters({ from: value })} value={from} />
            <DateFilter label="To date" min={from || undefined} onChange={(value) => updateFilters({ to: value })} value={to} />
            <FilterSelect label="Sort order" onChange={(value) => updateFilters({ sort: value })} value={sort}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </FilterSelect>
            <button
              className="h-11 self-end rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-default disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
              disabled={!hasFilters}
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        </div>

        {isLoading ? (
          <AuditListSkeleton />
        ) : error ? (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
                <FaRotateRight aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">Unable to load audit logs</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {error.status === 403 ? 'Your administrator account does not have permission to view system audit logs.' : error.message}
              </p>
              <button className="mt-5 rounded-xl bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setReloadKey((value) => value + 1)} type="button">
                Try again
              </button>
            </div>
          </div>
        ) : response?.data.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400 dark:bg-white/[0.025]">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold" scope="col">Occurred</th>
                    <th className="px-5 py-3.5 font-semibold" scope="col">Administrator</th>
                    <th className="px-5 py-3.5 font-semibold" scope="col">Event</th>
                    <th className="px-5 py-3.5 font-semibold" scope="col">Target</th>
                    <th className="px-5 py-3.5 text-right font-semibold" scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                  {response.data.map((audit) => (
                    <tr className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025]" key={audit.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">{formatAuditDate(audit.occurred_at)}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{audit.actor.name}</p>
                        {audit.actor.email && <p className="mt-1 text-xs text-slate-400">{audit.actor.email}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{audit.action_label}</p>
                        <p className="mt-1 text-xs text-slate-400">{audit.source_feature_label}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-600 dark:text-slate-300">{audit.target.type_label}</p>
                        <p className="mt-1 font-mono text-xs text-slate-400">{targetDescription(audit)}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link className="font-semibold text-[#b0005d] hover:text-[#E6007A] dark:text-pink-300" to={`/audit-logs/${audit.id}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/[0.07] md:hidden">
              {response.data.map((audit) => (
                <article className="p-5" key={audit.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{audit.action_label}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatAuditDate(audit.occurred_at)}</p>
                    </div>
                    <Link className="text-sm font-semibold text-[#b0005d] dark:text-pink-300" to={`/audit-logs/${audit.id}`}>View</Link>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-xs text-slate-400">Administrator</dt><dd className="mt-1 font-medium">{audit.actor.name}</dd></div>
                    <div><dt className="text-xs text-slate-400">Target</dt><dd className="mt-1 font-medium">{audit.target.type_label}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                <FaClockRotateLeft aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">No audit events found</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {hasFilters ? 'No events match the selected filters.' : 'Sensitive administrator actions will appear here when they occur.'}
              </p>
              {hasFilters && <button className="mt-5 text-sm font-semibold text-[#b0005d] dark:text-pink-300" onClick={clearFilters} type="button">Clear filters</button>}
            </div>
          </div>
        )}

        {response && response.meta.last_page > 1 && !isLoading && !error && (
          <nav aria-label="Audit log pagination" className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/10">
            <p className="text-xs text-slate-400">Showing {response.meta.from}–{response.meta.to} of {response.meta.total}</p>
            <div className="flex items-center gap-3">
              <button
                aria-label="Previous page"
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5"
                disabled={response.meta.current_page <= 1}
                onClick={() => updateFilters({ page: String(response.meta.current_page - 1) })}
                type="button"
              >
                <FaChevronLeft aria-hidden="true" />
              </button>
              <span className="text-sm font-medium">{response.meta.current_page} / {response.meta.last_page}</span>
              <button
                aria-label="Next page"
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5"
                disabled={response.meta.current_page >= response.meta.last_page}
                onClick={() => updateFilters({ page: String(response.meta.current_page + 1) })}
                type="button"
              >
                <FaChevronRight aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}

function FilterSelect({ children, label, onChange, value }: {
  children: React.ReactNode
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      <select
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-[#171921] dark:text-white dark:focus:ring-pink-500/10"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  )
}

function DateFilter({ label, min, onChange, value }: {
  label: string
  min?: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      <input
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-[#171921] dark:text-white dark:focus:ring-pink-500/10"
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  )
}

function AuditListSkeleton() {
  return (
    <div className="divide-y divide-slate-100 p-5 dark:divide-white/[0.07]" aria-label="Loading audit logs" aria-live="polite">
      {[1, 2, 3, 4, 5].map((item) => (
        <div className="grid animate-pulse grid-cols-[1fr_1fr_1.2fr_1fr] gap-5 py-5" key={item}>
          <div className="h-4 w-32 rounded bg-slate-100 dark:bg-white/5" />
          <div className="space-y-2"><div className="h-4 w-28 rounded bg-slate-200 dark:bg-white/10" /><div className="h-3 w-36 rounded bg-slate-100 dark:bg-white/5" /></div>
          <div className="space-y-2"><div className="h-4 w-36 rounded bg-slate-200 dark:bg-white/10" /><div className="h-3 w-24 rounded bg-slate-100 dark:bg-white/5" /></div>
          <div className="h-4 w-28 rounded bg-slate-100 dark:bg-white/5" />
        </div>
      ))}
    </div>
  )
}
