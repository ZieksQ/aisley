import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  FaChevronLeft,
  FaChevronRight,
  FaClipboardCheck,
  FaMagnifyingGlass,
  FaRotateRight,
} from 'react-icons/fa6'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from '../components/registrations/StatusBadge'
import { ApiError, apiRequest } from '../lib/api'
import { formatDate, roleLabel } from '../lib/registrations'
import type {
  RegistrationListResponse,
  RegistrationRole,
  RegistrationStatus,
} from '../types/registrations'

const statuses: RegistrationStatus[] = ['pending', 'approved', 'rejected']
const roles: RegistrationRole[] = ['customer', 'seller', 'logistics']

function validStatus(value: string | null): RegistrationStatus {
  return statuses.includes(value as RegistrationStatus) ? (value as RegistrationStatus) : 'pending'
}

function validRole(value: string | null): RegistrationRole | '' {
  return roles.includes(value as RegistrationRole) ? (value as RegistrationRole) : ''
}

export function RegistrationsPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = validStatus(searchParams.get('status'))
  const role = validRole(searchParams.get('role'))
  const search = searchParams.get('search') ?? ''
  const sort = searchParams.get('sort') === 'newest' ? 'newest' : 'oldest'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [draftSearch, setDraftSearch] = useState(search)
  const [response, setResponse] = useState<RegistrationListResponse | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const queryString = searchParams.toString()

  useEffect(() => {
    document.title = 'Account registrations | Aisley Admin'
  }, [])

  useEffect(() => {
    setDraftSearch(search)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({
      status,
      sort,
      page: String(page),
      per_page: '15',
    })
    if (role) query.set('role', role)
    if (search) query.set('search', search)

    setIsLoading(true)
    setError(null)

    apiRequest<RegistrationListResponse>(`/api/v1/admin/registrations?${query}`, {
      signal: controller.signal,
    })
      .then(setResponse)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load registrations.',
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [logout, navigate, page, queryString, reloadKey, role, search, sort, status])

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

  function retry() {
    setReloadKey((value) => value + 1)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E6007A]">Review queue</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Manage account registrations</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Review Customer, Seller, and Logistics applications. Courier approvals remain outside the platform Admin workflow.
          </p>
        </div>
        {response && !isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {response.meta.total} {response.meta.total === 1 ? 'application' : 'applications'}
          </p>
        )}
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
        <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
          <div className="flex gap-2 overflow-x-auto" aria-label="Registration status" role="tablist">
            {statuses.map((item) => (
              <button
                aria-selected={status === item}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${status === item ? 'bg-[#4C1268] text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'}`}
                key={item}
                onClick={() => updateFilters({ status: item })}
                role="tab"
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
            <form className="flex gap-2" onSubmit={submitSearch} role="search">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search registrations</span>
                <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10"
                  onChange={(event) => setDraftSearch(event.target.value)}
                  placeholder="Search name or email"
                  type="search"
                  value={draftSearch}
                />
              </label>
              <button className="rounded-xl bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#c8006b]" type="submit">
                Search
              </button>
            </form>

            <label>
              <span className="sr-only">Filter by role</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-[#171921] dark:focus:ring-pink-500/10"
                onChange={(event) => updateFilters({ role: event.target.value })}
                value={role}
              >
                <option value="">All roles</option>
                <option value="customer">Customer</option>
                <option value="seller">Seller</option>
                <option value="logistics">Logistics</option>
              </select>
            </label>

            <label>
              <span className="sr-only">Sort registrations</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-[#171921] dark:focus:ring-pink-500/10"
                onChange={(event) => updateFilters({ sort: event.target.value })}
                value={sort}
              >
                <option value="oldest">Oldest submitted</option>
                <option value="newest">Newest submitted</option>
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <QueueSkeleton />
        ) : error ? (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
                <FaRotateRight aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">Unable to load registrations</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {error.status === 403 ? 'Your administrator account does not have permission to view this queue.' : error.message}
              </p>
              <button className="mt-5 rounded-xl bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3e0e56]" onClick={retry} type="button">
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
                    <th className="px-5 py-3.5 font-semibold" scope="col">Applicant</th>
                    <th className="px-5 py-3.5 font-semibold" scope="col">Role</th>
                    <th className="px-5 py-3.5 font-semibold" scope="col">Submitted</th>
                    <th className="px-5 py-3.5 font-semibold" scope="col">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold" scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                  {response.data.map((registration) => (
                    <tr className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025]" key={registration.id}>
                      <td className="px-5 py-4">
                        <Link className="font-semibold hover:text-[#E6007A]" to={`/registrations/${registration.id}`}>
                          {registration.applicant.name}
                        </Link>
                        <p className="mt-1 text-xs text-slate-400">{registration.applicant.email}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{roleLabel(registration.role)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(registration.submitted_at)}</td>
                      <td className="px-5 py-4"><StatusBadge status={registration.status} /></td>
                      <td className="px-5 py-4 text-right">
                        <Link className="text-sm font-semibold text-[#b0005d] hover:text-[#E6007A] dark:text-pink-300" to={`/registrations/${registration.id}`}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/[0.07] md:hidden">
              {response.data.map((registration) => (
                <article className="p-5" key={registration.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link className="font-semibold hover:text-[#E6007A]" to={`/registrations/${registration.id}`}>
                        {registration.applicant.name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-slate-400">{registration.applicant.email}</p>
                    </div>
                    <StatusBadge status={registration.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-xs text-slate-400">Role</dt><dd className="mt-1 font-medium">{roleLabel(registration.role)}</dd></div>
                    <div><dt className="text-xs text-slate-400">Submitted</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">{formatDate(registration.submitted_at)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                <FaClipboardCheck aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">No {status} registrations</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {search || role ? 'Try changing the search or role filter.' : `There are no ${status} applications in this queue.`}
              </p>
            </div>
          </div>
        )}

        {response && response.meta.last_page > 1 && !isLoading && !error && (
          <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5" aria-label="Registration pagination">
            <p className="text-xs text-slate-400">
              Showing {response.meta.from}–{response.meta.to} of {response.meta.total}
            </p>
            <div className="flex items-center gap-2">
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

function QueueSkeleton() {
  return (
    <div className="divide-y divide-slate-100 p-5 dark:divide-white/[0.07]" aria-label="Loading registrations" aria-live="polite">
      {[1, 2, 3, 4, 5].map((item) => (
        <div className="grid animate-pulse grid-cols-[1.5fr_0.7fr_1fr_0.6fr] gap-5 py-5" key={item}>
          <div className="space-y-2"><div className="h-4 w-36 rounded bg-slate-200 dark:bg-white/10" /><div className="h-3 w-48 rounded bg-slate-100 dark:bg-white/5" /></div>
          <div className="h-4 w-16 rounded bg-slate-100 dark:bg-white/5" />
          <div className="h-4 w-28 rounded bg-slate-100 dark:bg-white/5" />
          <div className="h-6 w-20 rounded-full bg-slate-100 dark:bg-white/5" />
        </div>
      ))}
    </div>
  )
}
