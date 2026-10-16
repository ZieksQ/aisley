import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LuPlus } from 'react-icons/lu'
import { PortalModal, PortalState } from '@aisley/ui/portal'
import type { useShippingProviders } from './useShippingProviders'
import { ProviderLocation } from './ProviderLocation'

export function ShippingProviderPicker({
  state,
  onClose,
}: {
  state: ReturnType<typeof useShippingProviders>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const done = useRef<HTMLButtonElement>(null)
  const busy = Boolean(state.saving)
  const candidates = state.rows.filter(
    (item) =>
      !item.is_enabled &&
      `${item.business_name} ${item.hub.name}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  )
  return (
    <PortalModal
      title="Add shipping provider"
      description="When location data is available, providers in your pickup city and region appear first."
      busy={busy}
      onClose={onClose}
    >
      <div className="portal-form-stack">
        {state.pickup && (
          <p className="provider-pickup">
            <span className="portal-secondary">Default pickup area</span>
            <strong>
              {state.pickup.city_municipality}, {state.pickup.region}
            </strong>
          </p>
        )}
        {state.rankingNote && (
          <p className="portal-feedback">
            {state.rankingNote}{' '}
            <Link className="portal-link" to="/account">
              Manage pickup addresses
            </Link>
          </p>
        )}
        <div className="portal-field">
          <label htmlFor="provider-search">Search providers</label>
          <input
            className="portal-input"
            id="provider-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {state.notice && (
          <p className="portal-feedback" role="status">
            {state.notice}
          </p>
        )}
        {state.error && (
          <p className="portal-field-error" role="alert">
            {state.error}
          </p>
        )}
        {(state.error || state.rankingNote) && (
          <button
            className="portal-button"
            disabled={busy || state.loading}
            onClick={() => void state.load(true)}
          >
            {state.loading ? 'Refreshing…' : 'Refresh providers'}
          </button>
        )}
        {candidates.length ? (
          <ul className="provider-candidates">
            {candidates.map((provider) => (
              <li key={provider.organization_id}>
                <div className="provider-candidate-details">
                  <div className="portal-inline-actions">
                    <h3>{provider.business_name}</h3>
                    {provider.local && (
                      <span className="portal-tag portal-tag-brand">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="portal-secondary">{provider.hub.name}</p>
                  <ProviderLocation provider={provider} />
                </div>
                <button
                  aria-label={`Add ${provider.business_name}`}
                  className="portal-button"
                  disabled={busy || state.loading || Boolean(state.error)}
                  onClick={() =>
                    void state.save(provider, true).then((saved) => {
                      if (saved)
                        requestAnimationFrame(() => done.current?.focus())
                    })
                  }
                >
                  <LuPlus aria-hidden="true" />
                  {state.saving === provider.organization_id
                    ? 'Adding…'
                    : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <PortalState
            title={
              search
                ? 'No providers match your search'
                : 'No more providers available'
            }
            description={
              search
                ? 'Try a different provider or hub name.'
                : 'All currently available providers have been added, or no active organization has an operational hub.'
            }
          />
        )}
        {state.rows.some(
          (row) =>
            row.ranking?.distance_km !== null &&
            row.ranking?.distance_km !== undefined,
        ) && (
          <p className="provider-attribution">
            Distance data © Geoapify · OpenStreetMap contributors
          </p>
        )}
        <div className="portal-inline-actions">
          <button
            ref={done}
            className="portal-button"
            disabled={busy}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
