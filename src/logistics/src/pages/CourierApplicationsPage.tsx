import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowsRotate, FaMagnifyingGlass, FaUserCheck } from 'react-icons/fa6'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ActionButton, ErrorNotice, link, manilaDate, panel } from '../components/PickupUi'
import { ApiError, requestWithTimeout } from '../lib/api'
import type { CourierApplicationPage } from '../types/courierApplications'

function listError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Courier applications could not be loaded. Check your connection and try again.'
  if (error.status === 403 && error.code === 'POLICY_CONSENT_REQUIRED') return 'Accept the current Terms and Privacy Policy before reviewing Courier applications.'
  if (error.status === 429) return 'Too many requests. Wait a moment, then try again.'
  return error.message || 'Courier applications could not be loaded.'
}

function missingLabel(value: string): string {
  return value === 'courier_profile' ? 'profile' : value.replaceAll('_', ' ')
}

export function CourierApplicationsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [applications, setApplications] = useState<CourierApplicationPage | null>(null)
  const [query, setQuery] = useState(params.get('search') ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const page = Number(params.get('page') ?? '1')
  const search = params.get('search') ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const queryString = new URLSearchParams({ page: String(page), per_page: '20' })
    if (search) queryString.set('search', search)
    try {
      const result = await requestWithTimeout<CourierApplicationPage>(`/api/v1/logistics/courier-applications?${queryString.toString()}`)
      setApplications(result)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await logout()
        navigate('/login', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
        navigate('/policy-consent', { replace: true })
        return
      }
      setError(listError(caught))
    } finally {
      setLoading(false)
    }
  }, [logout, navigate, page, search])

  useEffect(() => {
    document.title = 'Courier applications | Aisley Logistics'
    void load()
  }, [load])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams(params)
    const trimmed = query.trim()
    if (trimmed) next.set('search', trimmed)
    else next.delete('search')
    next.set('page', '1')
    setParams(next)
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
  }

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-500"><FaUserCheck aria-hidden="true" /><span>Review queue</span></div>
        <h2 className="mt-2 text-xl font-semibold">Courier applications</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">Review applicants assigned to your organization before they can access Courier operations.</p>
      </div>
      <ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton>
    </div>

    <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch} role="search">
      <label className="sr-only" htmlFor="courier-application-search">Search Courier applications</label>
      <div className="relative min-w-0 flex-1"><FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/15 dark:border-white/15 dark:bg-[#111113] dark:focus:border-purple-400" id="courier-application-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" value={query} /></div>
      <button className="h-10 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]" type="submit">Search</button>
    </form>

    {error ? <div className="mt-5"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {loading && !applications ? <div className={`${panel} mt-5 p-6 text-sm`} role="status">Loading pending applications…</div> : null}
    {!loading && !error && applications && applications.data.length === 0 ? <section className={`${panel} mt-5 p-10 text-center`}><FaUserCheck aria-hidden="true" className="mx-auto text-2xl text-zinc-400" /><h3 className="mt-3 font-semibold">No pending applications</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">New Courier applications assigned to your organization will appear here.</p></section> : null}
    {applications && applications.data.length > 0 ? <section className={`${panel} mt-5 overflow-hidden`}>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Pending Courier applications</caption><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]"><tr><th className="px-5 py-3 font-medium" scope="col">Applicant</th><th className="px-5 py-3 font-medium" scope="col">Submitted</th><th className="px-5 py-3 font-medium" scope="col">Readiness</th><th className="px-5 py-3 text-right font-medium" scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-white/10">{applications.data.map((application) => <tr key={application.id}><td className="px-5 py-4"><p className="font-medium">{application.courier.name}</p><p className="mt-1 text-xs text-zinc-500">{application.courier.email}</p></td><td className="whitespace-nowrap px-5 py-4 text-zinc-600 dark:text-zinc-400">{manilaDate(application.application.submitted_at ?? application.created_at)}</td><td className="px-5 py-4">{application.completeness.complete ? <span className="text-emerald-700 dark:text-emerald-300">Complete</span> : <span className="text-amber-700 dark:text-amber-300">Missing {application.completeness.missing.map(missingLabel).join(', ')}</span>}</td><td className="px-5 py-4 text-right"><Link className={link} to={`/courier-applications/${application.id}`}>Review<span className="sr-only"> {application.courier.name}</span></Link></td></tr>)}</tbody></table></div>
      <ul className="divide-y divide-zinc-200 md:hidden dark:divide-white/10">{applications.data.map((application) => <li className="p-4" key={application.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{application.courier.name}</p><p className="mt-1 truncate text-xs text-zinc-500">{application.courier.email}</p></div><span className="shrink-0 text-xs text-zinc-500">Pending</span></div><p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">Submitted {manilaDate(application.application.submitted_at ?? application.created_at)}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{application.completeness.complete ? 'Registration details complete' : `Missing ${application.completeness.missing.map(missingLabel).join(', ')}`}</p><Link className={`${link} mt-3 inline-block text-sm`} to={`/courier-applications/${application.id}`}>Review application<span className="sr-only"> for {application.courier.name}</span></Link></li>)}</ul>
      {applications.meta.last_page > 1 ? <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3 text-sm dark:border-white/10"><button className="rounded-md border border-zinc-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15" disabled={applications.meta.current_page <= 1} onClick={() => goToPage(applications.meta.current_page - 1)} type="button">Previous</button><span className="text-xs text-zinc-500">Page {applications.meta.current_page} of {applications.meta.last_page}</span><button className="rounded-md border border-zinc-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15" disabled={applications.meta.current_page >= applications.meta.last_page} onClick={() => goToPage(applications.meta.current_page + 1)} type="button">Next</button></div> : null}
    </section> : null}
  </div>
}
