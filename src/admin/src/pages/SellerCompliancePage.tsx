import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaChevronLeft, FaChevronRight, FaMagnifyingGlass, FaPlus, FaRotateRight, FaShieldHalved, FaXmark } from 'react-icons/fa6'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CreateComplianceCaseDialog } from '../components/compliance/CreateComplianceCaseDialog'
import { ComplianceStatusBadge } from '../components/compliance/ComplianceStatusBadge'
import { ApiError } from '../lib/api'
import { fetchComplianceCases, formatComplianceDate } from '../lib/sellerCompliance'
import type { ComplianceCaseListResponse, ComplianceCaseStatus } from '../types/sellerCompliance'

const statuses: ComplianceCaseStatus[] = ['open', 'confirmed', 'dismissed', 'closed']

export function SellerCompliancePage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const status = statuses.includes(searchParams.get('status') as ComplianceCaseStatus) ? searchParams.get('status') as ComplianceCaseStatus : ''
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [draftSearch, setDraftSearch] = useState(search)
  const [response, setResponse] = useState<ComplianceCaseListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const queryString = searchParams.toString()

  useEffect(() => { document.title = 'Seller compliance | Aisley Admin' }, [])
  useEffect(() => setDraftSearch(search), [search])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page), per_page: '20', sort })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    setIsLoading(true); setError(null)
    fetchComplianceCases(query, controller.signal)
      .then(setResponse)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true })); return
        }
        setError(requestError instanceof ApiError && requestError.status === 403 ? 'Your administrator account does not have permission to manage Seller compliance.' : requestError instanceof Error ? requestError.message : 'Unable to load compliance cases.')
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [logout, navigate, page, queryString, reloadKey, search, sort, status])

  function updateFilters(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    if (!Object.hasOwn(updates, 'page')) next.delete('page')
    setSearchParams(next)
  }

  function submitSearch(event: FormEvent) { event.preventDefault(); updateFilters({ search: draftSearch.trim() }) }

  return <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Seller compliance</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Review Sellers and Products, preserve decisions, and apply explicit compliance actions.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#37104b]" onClick={() => setIsCreateOpen(true)} type="button"><FaPlus />Open case</button></div>

    <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
      <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
        <form className="flex gap-2" onSubmit={submitSearch} role="search"><label className="relative min-w-0 flex-1"><span className="sr-only">Search compliance cases</span><FaMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" /><input className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10" onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search case, Seller, Product, or reason" type="search" value={draftSearch} /></label><button className="rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white" type="submit">Search</button></form>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row"><label className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:w-52">Status<select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-[#17111d]" onChange={(event) => updateFilters({ status: event.target.value })} value={status}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}</select></label><label className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:w-52">Sort<select className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-[#17111d]" onChange={(event) => updateFilters({ sort: event.target.value })} value={sort}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
        {(search || status || sort === 'oldest') && <button className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => { setDraftSearch(''); setSearchParams(new URLSearchParams()) }} type="button"><FaXmark />Clear filters</button>}
      </div>

      {isLoading ? <ListSkeleton /> : error ? <div className="grid min-h-80 place-items-center p-8 text-center"><div><FaRotateRight className="mx-auto text-xl text-rose-500" /><h3 className="mt-3 font-semibold">Unable to load compliance cases</h3><p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{error}</p><button className="mt-4 rounded-lg bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setReloadKey((value) => value + 1)} type="button">Try again</button></div></div> : response?.data.length ? <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-white/[0.025] dark:text-slate-400"><tr><th className="px-5 py-3.5 font-semibold">Seller</th><th className="px-5 py-3.5 font-semibold">Product / scope</th><th className="px-5 py-3.5 font-semibold">Status</th><th className="px-5 py-3.5 font-semibold">Opened</th><th className="px-5 py-3.5"><span className="sr-only">Open</span></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">{response.data.map((item) => <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.025]" key={item.id}><td className="px-5 py-4"><Link className="font-semibold hover:text-[#E6007A]" to={`/seller-compliance/cases/${item.id}`}>{item.seller.name}</Link><p className="mt-1 text-xs text-slate-400">{item.seller.shop_name ?? item.seller.email}</p></td><td className="px-5 py-4"><p className="font-medium">{item.product?.name ?? 'Seller-level review'}</p><p className="mt-1 max-w-sm truncate text-xs text-slate-400">{item.reason}</p></td><td className="px-5 py-4"><ComplianceStatusBadge status={item.status} /></td><td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatComplianceDate(item.created_at)}</td><td className="px-5 py-4 text-right"><Link className="font-semibold text-[#b0005d] dark:text-pink-300" to={`/seller-compliance/cases/${item.id}`}>Review</Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 dark:divide-white/[0.07] md:hidden">{response.data.map((item) => <article className="p-5" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link className="font-semibold hover:text-[#E6007A]" to={`/seller-compliance/cases/${item.id}`}>{item.seller.name}</Link><p className="mt-1 truncate text-xs text-slate-400">{item.product?.name ?? 'Seller-level review'}</p></div><ComplianceStatusBadge status={item.status} /></div><p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.reason}</p><p className="mt-3 text-xs text-slate-400">Opened {formatComplianceDate(item.created_at)}</p></article>)}</div>
      </> : <div className="grid min-h-80 place-items-center p-8 text-center"><div><FaShieldHalved className="mx-auto text-xl text-slate-400" /><h3 className="mt-3 font-semibold">No compliance cases found</h3><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Open a manual case or change the current filters.</p></div></div>}

      {response && response.meta.last_page > 1 && !isLoading && !error && <nav aria-label="Compliance case pages" className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/10"><p className="text-xs text-slate-400">Showing {response.meta.from}–{response.meta.to} of {response.meta.total}</p><div className="flex items-center gap-2"><button aria-label="Previous page" className="grid size-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page <= 1} onClick={() => updateFilters({ page: String(page - 1) })} type="button"><FaChevronLeft /></button><span className="text-sm font-medium">{page} / {response.meta.last_page}</span><button aria-label="Next page" className="grid size-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page >= response.meta.last_page} onClick={() => updateFilters({ page: String(page + 1) })} type="button"><FaChevronRight /></button></div></nav>}
    </section>
    <CreateComplianceCaseDialog onClose={() => setIsCreateOpen(false)} onCreated={(id) => navigate(`/seller-compliance/cases/${id}`)} open={isCreateOpen} />
  </div>
}

function ListSkeleton() { return <div aria-label="Loading compliance cases" className="divide-y divide-slate-100 p-5 dark:divide-white/[0.07]">{[1, 2, 3, 4, 5].map((item) => <div className="grid animate-pulse grid-cols-4 gap-6 py-5" key={item}><div className="h-4 rounded bg-slate-200 dark:bg-white/10" /><div className="h-4 rounded bg-slate-100 dark:bg-white/5" /><div className="h-4 rounded bg-slate-100 dark:bg-white/5" /><div className="h-4 rounded bg-slate-100 dark:bg-white/5" /></div>)}</div> }
