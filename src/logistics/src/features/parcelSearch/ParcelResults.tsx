import {
  PortalButton,
  PortalPagination,
  PortalSkeleton,
  PortalState,
} from '@aisley/ui/portal'
import { ErrorNotice } from '../../components/PickupUi'
import {
  evidenceOptions,
  formatDate,
  human,
  referenceFor,
  StateLabel,
  statusOptions,
} from './presentation'
import type { useParcelSearch } from './useParcelSearch'

export function ParcelResults({
  model,
}: {
  model: ReturnType<typeof useParcelSearch>
}) {
  const { queue } = model
  const currentReference = model.record ? referenceFor(model.record) : ''
  return (
    <section
      id="parcel-results"
      tabIndex={-1}
      className="portal-section parcel-results"
      aria-labelledby="parcel-results-title"
      aria-busy={model.queueLoading}
    >
      <header className="parcel-section-heading">
        <h3 id="parcel-results-title">Parcel results</h3>
        <p className="portal-secondary text-sm">
          {queue
            ? `${queue.meta.total} ${queue.freshness.state === 'offline-cache' ? 'cached' : 'matching'} parcels`
            : 'Parcels available to this hub'}
        </p>
      </header>
      <form className="parcel-filters" onSubmit={model.applyFilters}>
        <label>
          <span className="portal-label">Search results</span>
          <input
            type="search"
            className="portal-input"
            placeholder="Tracking ID, Order, or Parcel"
            value={model.search}
            onChange={(event) => model.setSearch(event.target.value)}
          />
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label>
            <span className="portal-label">Custody state</span>
            <select
              className="portal-input"
              value={model.status}
              onChange={(event) => model.setStatus(event.target.value)}
            >
              <option value="">All custody states</option>
              {statusOptions.map((value) => (
                <option key={value} value={value}>
                  {human(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="portal-label">Evidence state</span>
            <select
              className="portal-input"
              value={model.evidenceStatus}
              onChange={(event) => model.setEvidenceStatus(event.target.value)}
            >
              <option value="">All evidence states</option>
              {evidenceOptions.map((value) => (
                <option key={value} value={value}>
                  {human(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <PortalButton type="submit">Apply filters</PortalButton>
          <PortalButton variant="ghost" onClick={model.resetFilters}>
            Reset filters
          </PortalButton>
        </div>
      </form>
      {model.queueNotice ? (
        <p className="parcel-warning mx-4 mb-4" role="status">
          {model.queueNotice}
        </p>
      ) : null}
      {model.queueLoading ? (
        <PortalSkeleton label="Loading parcel results" rows={3} />
      ) : model.queueError ? (
        <div className="p-4">
          <ErrorNotice
            message={model.queueError}
            retry={() => void model.loadQueue()}
          />
        </div>
      ) : queue?.data.length ? (
        <ul className="parcel-result-list">
          {queue.data.map((item) => {
            const reference = referenceFor(item) || item.shipment_id
            const final = item.tasks.find((task) => task.leg === 'final_mile')
            return (
              <li key={item.shipment_id}>
                <button
                  type="button"
                  className="parcel-result"
                  aria-current={
                    reference === currentReference ? 'true' : undefined
                  }
                  disabled={model.lookupBlocked}
                  onClick={() => model.openRecord(item)}
                >
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <strong className="min-w-0 break-words font-mono text-sm">
                      {reference}
                    </strong>
                    <StateLabel value={item.status} />
                  </span>
                  <span className="portal-secondary mt-2 block text-sm">
                    {item.parcel?.order_reference ??
                      item.parcel?.reference ??
                      'Shipment'}
                  </span>
                  <span className="portal-secondary mt-2 flex flex-wrap justify-between gap-1 text-xs">
                    <span>
                      {final
                        ? `Final mile: ${human(final.status)}`
                        : 'Hub processing'}
                    </span>
                    <span>{formatDate(item.last_activity_at)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <PortalState
          title={
            queue?.freshness.state === 'offline-cache'
              ? 'No cached parcels match'
              : 'No parcels match'
          }
          description="Try another reference or reset your filters."
        />
      )}
      {queue && !model.queueLoading && !model.queueError ? (
        <PortalPagination
          page={model.page}
          lastPage={queue.meta.last_page}
          total={queue.meta.total}
          onPage={model.setPage}
          disabled={model.queueLoading}
        />
      ) : null}
    </section>
  )
}
