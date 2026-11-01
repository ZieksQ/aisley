import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { LuArrowUpRight, LuRefreshCw, LuSearch } from 'react-icons/lu'
import { PortalButton, PortalField, PortalPagination, PortalSkeleton, PortalState, PortalTable } from '@aisley/ui/portal'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { manilaDate } from '../components/PickupUi'
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
  const { logistics, logout } = useAuth()
  const loadId = useRef(0)
  const [applications, setApplications] = useState<CourierApplicationPage | null>(null)
  const [query, setQuery] = useState(params.get('search') ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const search = params.get('search') ?? ''

  const load = useCallback(async () => {
    const id = ++loadId.current
    setApplications(null)
    setLoading(true)
    setError('')
    const queryString = new URLSearchParams({ page: String(page), per_page: '20' })
    if (search) queryString.set('search', search)
    try {
      const result = await requestWithTimeout<CourierApplicationPage>(`/api/v1/logistics/courier-applications?${queryString.toString()}`)
      if (id === loadId.current) setApplications(result)
    } catch (caught) {
      if (id !== loadId.current) return
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
      if (id === loadId.current) setLoading(false)
    }
  }, [logistics?.id, logout, navigate, page, search])

  useEffect(() => { setQuery(search) }, [search])

  useEffect(() => {
    document.title = 'Courier applications | Aisley Logistics'
    void load()
    return () => { loadId.current += 1 }
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

  return <div className="portal-page space-y-6">
    <header className="portal-page-header">
      <div>
        <h2 className="portal-page-heading">Courier applications</h2>
        <p className="portal-page-description">Review registration details and private evidence before approving Couriers for your organization.</p>
      </div>
      <PortalButton isLoading={loading} onClick={() => void load()}>
        <LuRefreshCw aria-hidden="true" />
        Refresh
      </PortalButton>
    </header>
    <section className="portal-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Pending review</h3>
          <p className="portal-secondary mt-1 text-sm">Oldest applications appear first. Uploaded evidence still needs your review.</p>
        </div>
        {applications && !loading && !error ? <span className="portal-tag portal-tag-brand">{applications.meta.total} pending{search ? ' matching search' : ''}</span> : null}
      </div>
      <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={submitSearch} role="search">
        <PortalField
          className="min-w-0 flex-1 basis-64"
          label="Find an applicant"
          id="courier-application-search"
          placeholder="Name or email address"
          maxLength={100}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search" />
        <PortalButton variant="primary" type="submit">
          <LuSearch aria-hidden="true" />
          Search
        </PortalButton>
        {search ? <PortalButton onClick={() => { setQuery(''); setParams({}) }}>
          Clear search
        </PortalButton> : null}
      </form>
    </section>
    {error ? <PortalState
      title="Applications could not be loaded"
      description={error}
      error
      action={<PortalButton onClick={() => void load()}>
        Try again
      </PortalButton>} /> : loading ? <PortalSkeleton label="Loading pending applications" /> : applications?.data.length ? <>
        <PortalTable label="Pending Courier applications">
          <thead>
            <tr>
              <th scope="col">
                Applicant
              </th>
              <th scope="col">
                Submitted
              </th>
              <th scope="col">
                Registration details
              </th>
              <th scope="col">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.data.map((application) => <tr key={application.id}>
              <td className="portal-table-name">
                <span className="font-medium">{application.courier.name}</span>
                <span className="portal-table-meta">{application.courier.email}</span>
              </td>
              <td className="whitespace-nowrap">
                {manilaDate(application.application.submitted_at ?? application.created_at)}
                <span className="portal-table-meta">Pending review</span>
              </td>
              <td>
                <span
                  className={`portal-tag ${application.completeness.complete ? 'portal-tag-success' : 'portal-tag-warning'}`}>{application.completeness.complete ? 'Details complete' : 'Details missing'}</span>
                {!application.completeness.complete ? <span className="portal-table-meta">Missing {application.completeness.missing.map(missingLabel).join(', ')}</span> : <span className="portal-table-meta">Private evidence review required</span>}
              </td>
              <td className="portal-row-action">
                <Link
                  className="portal-button portal-button-ghost whitespace-nowrap"
                  to={`/courier-applications/${application.id}?${params.toString()}`}>
                  Review
                  <LuArrowUpRight aria-hidden="true" />
                  <span className="sr-only"> {application.courier.name}</span>
                </Link>
              </td>
            </tr>)}
          </tbody>
        </PortalTable>
        <PortalPagination
          page={applications.meta.current_page}
          lastPage={applications.meta.last_page}
          total={applications.meta.total}
          onPage={goToPage} />
      </> : applications ? <PortalState
        title={search ? 'No matching applicants' : 'No pending applications'}
        description={search ? 'Try another name or email address, or clear your search.' : 'New Courier applications assigned to your organization will appear here.'} /> : null}
  </div>
}
