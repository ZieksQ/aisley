import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { LuArrowUpRight, LuRefreshCw, LuSearch } from 'react-icons/lu'
import { PortalButton, PortalField, PortalPagination, PortalSkeleton, PortalState, PortalTable } from '@aisley/ui/portal'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, requestWithTimeout } from '../lib/api'
import type { CourierVehiclePageResponse } from '../types/vehicles'

function listError(caught: unknown): string {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  if (caught instanceof ApiError) {
    if (caught.status === 403) return 'You do not have access to this vehicle list.'
    if (caught.status === 408) return 'The request timed out. Check your connection and try again.'
    return caught.message
  }
  return 'We could not load vehicles. Check your connection and try again.'
}

export function CourierVehiclesPage() {
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [query, setQuery] = useState(search)
  const [result, setResult] = useState<{ scope: string; page: CourierVehiclePageResponse } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const scope = JSON.stringify([logistics?.id, page, search, refresh])
  const current = result && result.scope === scope ? result.page : null

  useEffect(() => { setQuery(search) }, [search])

  useEffect(() => {
    document.title = 'Vehicles | Aisley Logistics'
    let active = true
    setResult(null)
    setLoading(true)
    setError('')
    const queryString = new URLSearchParams({ page: String(page), per_page: '20' })
    if (search) queryString.set('search', search)
    requestWithTimeout<CourierVehiclePageResponse>(`/api/v1/logistics/vehicles?${queryString.toString()}`)
      .then((response) => { if (active) setResult({ scope, page: response }) })
      .catch(async (caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) {
          await logout().catch(() => undefined)
          if (active) navigate('/login', { replace: true })
          return
        }
        if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
          navigate('/policy-consent', { replace: true })
          return
        }
        setError(listError(caught))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [logout, navigate, page, scope, search])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams(params)
    const term = query.trim()
    if (term) next.set('search', term)
    else next.delete('search')
    next.delete('page')
    setParams(next)
  }

  function movePage(nextPage: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
  }

  return <div className="portal-page space-y-6">
    <header className="portal-page-header">
      <div>
        <h2 className="portal-page-heading">Vehicles</h2>
        <p className="portal-page-description">View the personal vehicles and document availability of approved Couriers in your organization.</p>
      </div>
      <PortalButton isLoading={loading} onClick={() => setRefresh((value) => value + 1)}>
        <LuRefreshCw aria-hidden="true" />
        Refresh
      </PortalButton>
    </header>
    <section className="portal-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Courier vehicle registry</h3>
          <p className="portal-secondary mt-1 text-sm">One personal vehicle per Courier. Open a record to preview private OR and CR images.</p>
        </div>
        {current ? <span className="portal-tag portal-tag-brand">{current.meta.total} vehicle{current.meta.total === 1 ? '' : 's'}</span> : null}
      </div>
      <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={submitSearch} role="search">
        <PortalField
          className="min-w-0 flex-1 basis-64"
          label="Find a vehicle"
          id="vehicle-search"
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Courier name, email, or plate"
          type="search"
          value={query} />
        <PortalButton variant="primary" type="submit">
          <LuSearch aria-hidden="true" />
          Search
        </PortalButton>
        {search ? <PortalButton onClick={() => { setQuery(''); setParams({}) }}>
          Clear search
        </PortalButton> : null}
      </form>
    </section>
    {loading ? <PortalSkeleton label="Loading vehicles" /> : error ? <PortalState
      error
      title="Vehicles could not be loaded"
      description={error}
      action={<PortalButton onClick={() => setRefresh((value) => value + 1)}>
        Try again
      </PortalButton>} /> : current?.data.length ? <>
        <PortalTable label="Approved Courier vehicles">
          <thead>
            <tr>
              <th scope="col">
                Courier
              </th>
              <th scope="col">
                Vehicle
              </th>
              <th scope="col">
                Official Receipt
              </th>
              <th scope="col">
                Certificate of Registration
              </th>
              <th scope="col">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {current.data.map((item) => <tr key={item.vehicle.id}>
              <td className="portal-table-name">
                <span className="font-medium">{item.courier.name}</span>
                <span className="portal-table-meta">{item.courier.email}</span>
              </td>
              <td>
                <span className="font-medium whitespace-nowrap">{item.vehicle.plate_number}</span>
                <span className="portal-table-meta capitalize">{item.vehicle.vehicle_type} · {[item.vehicle.make, item.vehicle.model].filter(Boolean).join(' ') || 'Make/model not provided'}</span>
              </td>
              <td>
                <span
                  className={`portal-tag ${item.vehicle.official_receipt_uploaded ? 'portal-tag-success' : 'portal-tag-warning'}`}>{item.vehicle.official_receipt_uploaded ? 'Uploaded' : 'Missing'}</span>
              </td>
              <td>
                <span
                  className={`portal-tag ${item.vehicle.certificate_of_registration_uploaded ? 'portal-tag-success' : 'portal-tag-warning'}`}>{item.vehicle.certificate_of_registration_uploaded ? 'Uploaded' : 'Missing'}</span>
              </td>
              <td className="portal-row-action">
                <Link
                  className="portal-button portal-button-ghost whitespace-nowrap"
                  to={`/couriers/${item.courier.id}/vehicle?${params.toString()}`}>
                  View vehicle
                  <LuArrowUpRight aria-hidden="true" />
                  <span className="sr-only"> for {item.courier.name}</span>
                </Link>
              </td>
            </tr>)}
          </tbody>
        </PortalTable>
        <PortalPagination
          page={current.meta.current_page}
          lastPage={current.meta.last_page}
          total={current.meta.total}
          onPage={movePage} />
        <p className="portal-secondary text-xs">Uploaded indicates availability, not document verification. Company-owned trucks are managed in <Link className="portal-link underline" to="/fleet">
          Company fleet
        </Link>.</p>
      </> : current ? <PortalState
        title={search ? 'No matching vehicles' : 'No approved Courier vehicles yet'}
        description={search ? 'Try another Courier name, email, or plate.' : 'Vehicles appear here after Courier approval.'} /> : null}
  </div>
}
