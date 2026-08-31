import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaChevronLeft, FaChevronRight, FaMagnifyingGlass, FaRotateRight, FaUsers, FaXmark } from 'react-icons/fa6'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { UserStatusBadge } from '../components/users/UserStatusBadge'
import { ApiError } from '../lib/api'
import { fetchManagedUsers, formatUserDate, roleLabel } from '../lib/users'
import type { ManagedUserListResponse, ManagedUserRole, ManagedUserStatus } from '../types/users'

const roles: ManagedUserRole[] = ['customer', 'seller', 'courier']
const statuses: ManagedUserStatus[] = ['pending', 'active', 'rejected', 'suspended', 'deactivated']

export function UsersPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const role = roles.includes(searchParams.get('role') as ManagedUserRole) ? (searchParams.get('role') as ManagedUserRole) : ''
  const status = statuses.includes(searchParams.get('status') as ManagedUserStatus) ? (searchParams.get('status') as ManagedUserStatus) : ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [draftSearch, setDraftSearch] = useState(search)
  const [response, setResponse] = useState<ManagedUserListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const queryString = searchParams.toString()
  const hasFilters = Boolean(search || role || status || from || to || sort === 'oldest')

  useEffect(() => {
    document.title = 'Manage user accounts | Aisley Admin'
  }, [])

  useEffect(() => setDraftSearch(search), [search])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page), per_page: '20', sort })
    if (search) query.set('search', search)
    if (role) query.set('role', role)
    if (status) query.set('status', status)
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    setIsLoading(true)
    setError(null)
    fetchManagedUsers(query, controller.signal)
      .then(setResponse)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load user accounts.',
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [from, logout, navigate, page, queryString, reloadKey, role, search, sort, status, to])

  function updateFilters(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    if (!Object.hasOwn(updates, 'page')) next.delete('page')
    setSearchParams(next)
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    updateFilters({ search: draftSearch.trim() })
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Manage user accounts</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Search non-Admin accounts and manage access after registration approval.</p>
        </div>
        {response && !isLoading && <p aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">{response.meta.total} {response.meta.total === 1 ? 'account' : 'accounts'}</p>}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
        <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
          <form className="flex gap-2" onSubmit={submitSearch} role="search">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search user accounts</span>
              <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10" onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search name, email, or account ID" type="search" value={draftSearch} />
            </label>
            <button className="rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#37104b]" type="submit">Search</button>
          </form>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Filter label="Role" onChange={(value) => updateFilters({ role: value })} value={role}>
              <option value="">All roles</option>
              {roles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
            </Filter>
            <Filter label="Status" onChange={(value) => updateFilters({ status: value })} value={status}>
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}
            </Filter>
            <DateField label="Joined from" onChange={(value) => updateFilters({ from: value })} value={from} />
            <DateField label="Joined to" min={from || undefined} onChange={(value) => updateFilters({ to: value })} value={to} />
            <Filter label="Sort" onChange={(value) => updateFilters({ sort: value })} value={sort}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Filter>
          </div>
          {hasFilters && <button className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => { setDraftSearch(''); setSearchParams(new URLSearchParams()) }} type="button"><FaXmark aria-hidden="true" />Clear filters</button>}
        </div>

        {isLoading ? (
          <ListSkeleton />
        ) : error ? (
          <div className="grid min-h-80 place-items-center p-8 text-center">
            <div><FaRotateRight aria-hidden="true" className="mx-auto text-xl text-rose-500" /><h3 className="mt-3 font-semibold">Unable to load accounts</h3><p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{error.status === 403 ? 'Your administrator account does not have permission to view user accounts.' : error.message}</p><button className="mt-4 rounded-lg bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setReloadKey((value) => value + 1)} type="button">Try again</button></div>
          </div>
        ) : response?.data.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-white/[0.025] dark:text-slate-400"><tr><th className="px-5 py-3.5 font-semibold">Account</th><th className="px-5 py-3.5 font-semibold">Role</th><th className="px-5 py-3.5 font-semibold">Status</th><th className="px-5 py-3.5 font-semibold">Joined</th><th className="px-5 py-3.5"><span className="sr-only">Open</span></th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                  {response.data.map((user) => <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.025]" key={user.id}><td className="px-5 py-4"><Link className="font-semibold hover:text-[#E6007A]" to={`/users/${user.id}`}>{user.display_name}</Link><p className="mt-1 text-xs text-slate-400">{user.email}</p></td><td className="px-5 py-4">{roleLabel(user.role)}</td><td className="px-5 py-4"><UserStatusBadge status={user.status} /></td><td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatUserDate(user.created_at)}</td><td className="px-5 py-4 text-right"><Link className="font-semibold text-[#b0005d] dark:text-pink-300" to={`/users/${user.id}`}>View</Link></td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.07] md:hidden">
              {response.data.map((user) => <article className="p-5" key={user.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="font-semibold hover:text-[#E6007A]" to={`/users/${user.id}`}>{user.display_name}</Link><p className="mt-1 truncate text-xs text-slate-400">{user.email}</p></div><UserStatusBadge status={user.status} /></div><div className="mt-4 flex justify-between text-sm"><span>{roleLabel(user.role)}</span><span className="text-slate-500 dark:text-slate-400">{formatUserDate(user.created_at)}</span></div></article>)}
            </div>
          </>
        ) : (
          <div className="grid min-h-80 place-items-center p-8 text-center"><div><FaUsers aria-hidden="true" className="mx-auto text-xl text-slate-400" /><h3 className="mt-3 font-semibold">No accounts found</h3><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try changing the search or filters.</p></div></div>
        )}

        {response && response.meta.last_page > 1 && !isLoading && !error && <nav aria-label="User account pages" className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/10"><p className="text-xs text-slate-400">Showing {response.meta.from}–{response.meta.to} of {response.meta.total}</p><div className="flex items-center gap-2"><button aria-label="Previous page" className="grid size-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page <= 1} onClick={() => updateFilters({ page: String(page - 1) })} type="button"><FaChevronLeft /></button><span className="text-sm font-medium">{page} / {response.meta.last_page}</span><button aria-label="Next page" className="grid size-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page >= response.meta.last_page} onClick={() => updateFilters({ page: String(page + 1) })} type="button"><FaChevronRight /></button></div></nav>}
      </div>
    </div>
  )
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}<select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-[#17111d] dark:text-slate-200" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label>
}

function DateField({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}<input className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-[#17111d]" min={min} onChange={(event) => onChange(event.target.value)} type="date" value={value} /></label>
}

function ListSkeleton() {
  return <div aria-label="Loading user accounts" className="divide-y divide-slate-100 p-5 dark:divide-white/[0.07]">{[1, 2, 3, 4, 5].map((item) => <div className="grid animate-pulse grid-cols-4 gap-6 py-5" key={item}><div className="h-4 rounded bg-slate-200 dark:bg-white/10" /><div className="h-4 rounded bg-slate-100 dark:bg-white/5" /><div className="h-4 rounded bg-slate-100 dark:bg-white/5" /><div className="h-4 rounded bg-slate-100 dark:bg-white/5" /></div>)}</div>
}
