import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaPlus, FaXmark } from 'react-icons/fa6'
import { PortalField, PortalPagination, PortalSkeleton, PortalState, PortalTable } from '@aisley/ui/portal'
import { SellerIdentity } from '../components/compliance/SellerIdentity'
import '../components/compliance/compliance.css'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CreateComplianceCaseDialog } from '../components/compliance/CreateComplianceCaseDialog'
import { ComplianceStatusBadge } from '../components/compliance/ComplianceStatusBadge'
import { ApiError } from '../lib/api'
import { fetchComplianceCases, formatComplianceDate } from '../lib/sellerCompliance'
import type { ComplianceCaseListResponse, ComplianceCaseStatus } from '../types/sellerCompliance'

const statuses: ComplianceCaseStatus[] = ['open', 'confirmed', 'dismissed', 'closed']

export function SellerCompliancePage() {
  const { admin, logout } = useAuth()
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
      .then((result) => { if (!controller.signal.aborted) setResponse(result) })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true })); return
        }
        setError(requestError instanceof ApiError && requestError.status === 403 ? 'Your administrator account does not have permission to manage Seller compliance.' : requestError instanceof Error ? requestError.message : 'Unable to load compliance cases.')
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [admin?.id, logout, navigate, page, queryString, reloadKey, search, sort, status])

  function updateFilters(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    if (!Object.hasOwn(updates, 'page')) next.delete('page')
    setSearchParams(next)
  }

  function submitSearch(event: FormEvent) { event.preventDefault(); updateFilters({ search: draftSearch.trim() }) }

  return (
    <div className="portal-page compliance-page">
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">Seller compliance</h2>
          <p className="portal-page-description">Review Sellers and Products, document the review basis, and track compliance decisions.</p>
        </div>
        <button className="portal-button portal-button-primary" onClick={() => setIsCreateOpen(true)} type="button"><FaPlus aria-hidden="true" />Open case</button>
      </header>

      <form className="portal-filter-bar compliance-filters" onSubmit={submitSearch} role="search">
        <PortalField label="Search cases" type="search" placeholder="Case, Seller, Product, or reason" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} />
        <div className="portal-field">
          <label htmlFor="compliance-status">Status</label>
          <select className="portal-input" id="compliance-status" onChange={(event) => updateFilters({ status: event.target.value })} value={status}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}
          </select>
        </div>
        <div className="portal-field">
          <label htmlFor="compliance-sort">Sort</label>
          <select className="portal-input" id="compliance-sort" onChange={(event) => updateFilters({ sort: event.target.value })} value={sort}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          </select>
        </div>
        <button className="portal-button" type="submit">Search</button>
        {(search || status || sort === 'oldest') && <button className="portal-button" onClick={() => { setDraftSearch(''); setSearchParams(new URLSearchParams()) }} type="button"><FaXmark aria-hidden="true" />Clear filters</button>}
      </form>

      <section aria-labelledby="compliance-results-heading">
        <div className="compliance-results-heading">
          <h3 id="compliance-results-heading" className="font-semibold">Compliance cases</h3>
          {!isLoading && !error && response && <p className="portal-secondary text-sm" role="status">{response.meta.total} {response.meta.total === 1 ? 'case' : 'cases'}</p>}
        </div>
        {isLoading ? <PortalSkeleton label="Loading compliance cases" /> : error ? (
          <PortalState error title="Unable to load compliance cases" description={error} action={<button className="portal-button" onClick={() => setReloadKey((value) => value + 1)} type="button">Try again</button>} />
        ) : response?.data.length ? (
          <>
            <div className="hidden md:block">
              <PortalTable label="Seller compliance cases">
                <thead><tr>{['Seller / Shop', 'Product / review scope', 'Status', 'Opened', 'Action'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
                <tbody>
                  {response.data.map((item) => (
                    <tr key={item.id}>
                      <td className="portal-table-name"><SellerIdentity seller={item.seller} /></td>
                      <td className="portal-table-name"><p className="font-medium">{item.product?.name ?? 'Seller-level review'}</p><p className="portal-table-meta compliance-reason-preview">{item.reason}</p></td>
                      <td><ComplianceStatusBadge status={item.status} /></td>
                      <td className="portal-secondary whitespace-nowrap">{formatComplianceDate(item.created_at)}</td>
                      <td className="portal-row-action"><Link className="portal-button portal-button-ghost" aria-label={`Review case for ${item.seller.shop_name || item.seller.name}`} to={`/seller-compliance/cases/${item.id}`}>Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </PortalTable>
            </div>
            <div className="compliance-mobile-cases md:hidden">
              {response.data.map((item) => (
                <article className="portal-panel" key={item.id}>
                  <SellerIdentity seller={item.seller} />
                  <div className="mt-4"><ComplianceStatusBadge status={item.status} /></div>
                  <p className="mt-4 text-sm font-medium">{item.product?.name ?? 'Seller-level review'}</p>
                  <p className="portal-secondary mt-1 text-sm compliance-reason-preview">{item.reason}</p>
                  <p className="portal-secondary mt-3 text-xs">Opened {formatComplianceDate(item.created_at)}</p>
                  <Link className="portal-button mt-4" aria-label={`Review case for ${item.seller.shop_name || item.seller.name}`} to={`/seller-compliance/cases/${item.id}`}>Review case</Link>
                </article>
              ))}
            </div>
          </>
        ) : <PortalState title="No compliance cases found" description={search || status ? 'Try another search or clear your filters.' : 'Open a case to start a manual Seller or Product review.'} />}
        {response && !isLoading && !error && <PortalPagination page={response.meta.current_page} lastPage={response.meta.last_page} total={response.meta.total} onPage={(value) => updateFilters({ page: String(value) })} />}
      </section>
      <CreateComplianceCaseDialog key={admin?.id} onClose={() => setIsCreateOpen(false)} onCreated={(id) => navigate(`/seller-compliance/cases/${id}`)} open={isCreateOpen} />
    </div>
  )
}
