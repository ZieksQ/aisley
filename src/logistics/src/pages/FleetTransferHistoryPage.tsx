import { useCallback, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PortalPagination, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { loadPastTransfers, loadTruck } from '../features/fleetMonitoring/api'
import { MonitoringRefresh } from '../features/fleetMonitoring/MonitoringRefresh'
import { MonitoringHistoryTable } from '../features/fleetMonitoring/MonitoringTables'
import { pageNumber } from '../features/fleetMonitoring/types'
import { useFleetMonitoring } from '../features/fleetMonitoring/useFleetMonitoring'

export function FleetTransferHistoryPage() {
  const { truckId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const page = pageNumber(params.get('history_page'))
  const load = useCallback(async () => {
    const [truck, history] = await Promise.all([loadTruck(truckId), loadPastTransfers(truckId, page)])
    return { ...history, truck: truck.data }
  }, [truckId, page])
  const { data, loading, error, missing, refresh } = useFleetMonitoring(`past:${truckId}:${page}`, load)
  useEffect(() => {
    if (!data || page <= data.meta.last_page) return
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('history_page', String(Math.max(1, data.meta.last_page)))
      return next
    }, { replace: true })
  }, [data, page, setParams])
  const back = new URLSearchParams(params)
  back.delete('history_page')
  useEffect(() => { document.title = 'Past transfers | Aisley Logistics' }, [])

  return (
    <div className="portal-page space-y-6">
      <Link className="portal-link inline-flex min-h-11 items-center underline" to={`/fleet-monitoring/${truckId}?${back}`}>Back to truck monitoring</Link>
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">Past transfers</h2>
          <p className="portal-page-description">{data?.truck.plate_number ?? 'Truck'} · Completed, cancelled and rejected trips. All times are in Manila.</p>
        </div>
      </header>
      <MonitoringRefresh loading={loading} error={missing ? '' : error} updatedAt={data?.meta.server_time} refresh={refresh} />
      {missing ? <PortalState error title="Truck unavailable" description="This truck could not be found in your company fleet." /> : null}
      {loading && !data ? <PortalSkeleton label="Loading past transfers" /> : data ? (
        <section className="space-y-4" aria-label="Past truck transfers">
          <p className="portal-secondary text-sm">{data.meta.total} past transfer{data.meta.total === 1 ? '' : 's'}</p>
          <MonitoringHistoryTable trips={data.data} truckId={truckId} query={params.toString()} />
          <PortalPagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} disabled={loading} onPage={(next) => {
            const values = new URLSearchParams(params)
            values.set('history_page', String(next))
            setParams(values)
          }} />
        </section>
      ) : null}
    </div>
  )
}
