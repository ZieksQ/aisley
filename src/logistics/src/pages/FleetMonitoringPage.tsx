import { useCallback, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PortalButton, PortalPagination, PortalSkeleton } from '@aisley/ui/portal'
import { loadMonitoring } from '../features/fleetMonitoring/api'
import { MonitoringRefresh } from '../features/fleetMonitoring/MonitoringRefresh'
import { MonitoringTrucks } from '../features/fleetMonitoring/MonitoringTables'
import { availabilityLabels, pageNumber } from '../features/fleetMonitoring/types'
import type { Availability } from '../features/fleetMonitoring/types'
import { useFleetMonitoring } from '../features/fleetMonitoring/useFleetMonitoring'

export function FleetMonitoringPage() {
  const [params, setParams] = useSearchParams()
  const search = (params.get('search') ?? '').slice(0, 100)
  const availability = Object.hasOwn(availabilityLabels, params.get('availability') ?? '')
    ? params.get('availability') as Availability : ''
  const page = pageNumber(params.get('page'))
  const overdue = params.get('overdue') === '1'
  const query = new URLSearchParams({
    search, page: String(page), overdue: overdue ? '1' : '0',
    ...(availability ? { availability } : {}),
  }).toString()
  const load = useCallback(() => loadMonitoring(query), [query])
  const { data, loading, error, refresh } = useFleetMonitoring(query, load)

  useEffect(() => { document.title = 'Fleet monitoring | Aisley Logistics' }, [])

  return (
    <div className="portal-page space-y-6">
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">Fleet monitoring</h2>
          <p className="portal-page-description">Confirmed truck locations, assignments and departure schedules.</p>
        </div>
        <Link className="portal-button" to="/fleet">Manage company fleet</Link>
      </header>
      <MonitoringRefresh loading={loading} error={error} updatedAt={data?.meta.server_time} refresh={refresh} />
      {data ? (
        <section aria-label="Entire company fleet availability" className="portal-panel p-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {Object.entries(availabilityLabels).map(([value, label]) => (
              <div key={value}>
                <dt className="portal-secondary text-sm">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{data.meta.summary[value as Availability]}</dd>
              </div>
            ))}
          </dl>
          <p className="portal-secondary mt-3 text-sm">All company-owned trucks, across all filters.</p>
        </section>
      ) : null}
      <section className="space-y-4" aria-labelledby="monitoring-trucks-title">
        <h3 id="monitoring-trucks-title" className="text-lg font-semibold">Company trucks</h3>
        <form
          key={query}
          className="portal-filter-bar sm:!grid-cols-2 xl:!grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.5fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            const values = new FormData(event.currentTarget)
            const next = new URLSearchParams()
            const term = String(values.get('search') ?? '').trim()
            if (term) next.set('search', term)
            if (values.get('availability')) next.set('availability', String(values.get('availability')))
            if (values.get('overdue')) next.set('overdue', '1')
            setParams(next)
          }}
        >
          <label className="portal-field min-w-0 flex-1">
            <span className="portal-field-label">Search trucks, drivers or hubs</span>
            <input className="portal-input" name="search" maxLength={100} defaultValue={search} type="search" />
          </label>
          <label className="portal-field">
            <span className="portal-field-label">Availability</span>
            <select className="portal-input" name="availability" defaultValue={availability}>
              <option value="">All statuses</option>
              {Object.entries(availabilityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="!inline-flex min-h-11 items-center gap-2 text-sm !mb-0">
            <input
              className="size-5 accent-[var(--brand-primary)]"
              name="overdue" type="checkbox" defaultChecked={overdue}
            />
            Departure overdue
          </label>
          <div className="portal-inline-actions">
            <PortalButton type="submit">Apply filters</PortalButton>
            {search || availability || overdue ? (
              <PortalButton type="button" variant="ghost" onClick={() => setParams({})}>Clear filters</PortalButton>
            ) : null}
          </div>
        </form>
        {loading && !data ? <PortalSkeleton label="Loading fleet monitoring" /> : data ? (
          <>
            <p className="portal-secondary text-sm">
              {data.meta.total} matching truck{data.meta.total === 1 ? '' : 's'}.
              {' '}Locations come from confirmed hub events; trucks are not tracked by GPS.
            </p>
            <MonitoringTrucks trucks={data.data} query={params.toString()} />
            <PortalPagination
              page={data.meta.current_page} lastPage={data.meta.last_page}
              total={data.meta.total} disabled={loading}
              onPage={(next) => {
                const values = new URLSearchParams(params)
                values.set('page', String(next))
                setParams(values)
              }}
            />
          </>
        ) : null}
      </section>
    </div>
  )
}
