import { useEffect, useRef, useState } from 'react'
import { LuPlus, LuRefreshCw, LuTrash2, LuTruck } from 'react-icons/lu'
import {
  ConfirmationDialog,
  IconButton,
  PortalState,
  PortalSkeleton,
  PortalTable,
} from '@aisley/ui/portal'
import {
  useShippingProviders,
  type ProviderRow,
} from '../features/shipping-providers/useShippingProviders'
import { ShippingProviderPicker } from '../features/shipping-providers/ShippingProviderPicker'
import { ProviderLocation } from '../features/shipping-providers/ProviderLocation'
import '../features/shipping-providers/shipping.css'

export function ShippingProvidersPage() {
  const state = useShippingProviders()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<ProviderRow | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    document.title = 'Shipping providers | Aisley Seller'
  }, [])
  const enabled = state.rows.filter((item) => item.is_enabled)
  const busy = Boolean(state.saving)
  const removal = removing
    ? (state.rows.find(
        (row) => row.organization_id === removing.organization_id,
      ) ?? removing)
    : null
  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">Shipping providers</h2>
          <p className="portal-page-description">
            Choose who delivers your Shop’s Orders. Customers can select these
            providers at checkout.
          </p>
        </div>
        <div className="portal-inline-actions">
          <IconButton
            label="Refresh providers"
            disabled={state.loading || busy}
            onClick={() => void state.load(true)}
          >
            <LuRefreshCw aria-hidden="true" />
          </IconButton>
          <button
            ref={addButton}
            className="portal-button portal-button-primary"
            disabled={state.loading || busy || Boolean(state.error)}
            onClick={() => {
              setAdding(true)
            }}
          >
            <LuPlus aria-hidden="true" />
            Add shipping provider
          </button>
        </div>
      </header>
      {state.notice && (
        <p className="portal-feedback" role="status">
          {state.notice}
        </p>
      )}
      {state.error && (
        <PortalState
          error
          title={state.error}
          action={
            <button
              className="portal-button"
              disabled={busy || state.loading}
              onClick={() => void state.load(true)}
            >
              Refresh providers
            </button>
          }
        />
      )}
      {state.loading ? (
        <PortalSkeleton label="Loading shipping providers…" rows={3} />
      ) : !state.error && enabled.length === 0 ? (
        <PortalState
          title="No shipping providers added"
          description="Add an available provider so Customers can select delivery for new Orders."
          action={
            <button
              className="portal-button portal-button-primary"
              onClick={() => setAdding(true)}
            >
              <LuPlus aria-hidden="true" />
              Add shipping provider
            </button>
          }
        />
      ) : (
        enabled.length > 0 && (
          <PortalTable label="Enabled shipping providers">
            <caption>
              {enabled.length} {enabled.length === 1 ? 'provider' : 'providers'}{' '}
              available at checkout
            </caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Operational hub</th>
                <th scope="col">Location</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {enabled.map((provider) => (
                <tr key={provider.organization_id}>
                  <td className="portal-table-name">
                    <div className="provider-name">
                      <LuTruck aria-hidden="true" />
                      <strong>{provider.business_name}</strong>
                    </div>
                    {provider.local && (
                      <span className="portal-tag portal-tag-brand provider-local">
                        Recommended
                      </span>
                    )}
                  </td>
                  <td>{provider.hub.name}</td>
                  <td>
                    <ProviderLocation provider={provider} />
                  </td>
                  <td className="portal-row-action">
                    <IconButton
                      className="portal-icon-danger"
                      label={`Remove ${provider.business_name}`}
                      disabled={busy || state.loading || Boolean(state.error)}
                      onClick={() => setRemoving(provider)}
                    >
                      <LuTrash2 aria-hidden="true" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </PortalTable>
        )
      )}
      <p className="portal-page-description">
        Removing a provider affects new checkout choices. Existing Orders keep
        the provider selected when placed.
      </p>
      {state.rows.some(
        (row) =>
          row.ranking?.distance_km !== null &&
          row.ranking?.distance_km !== undefined,
      ) && (
        <p className="provider-attribution">
          Distance data © Geoapify · OpenStreetMap contributors
        </p>
      )}
      {adding && (
        <ShippingProviderPicker
          state={state}
          onClose={() => {
            setAdding(false)
            requestAnimationFrame(() => {
              if (document.activeElement === document.body)
                addButton.current?.focus()
            })
          }}
        />
      )}
      {removal && (
        <ConfirmationDialog
          title="Remove shipping provider?"
          confirmLabel="Remove provider"
          destructive
          busy={busy}
          confirmDisabled={
            state.loading || Boolean(state.error) || !removal.is_enabled
          }
          onClose={() => setRemoving(null)}
          onConfirm={() =>
            void state.save(removal, false).then((saved) => {
              if (saved) {
                setRemoving(null)
                requestAnimationFrame(() => addButton.current?.focus())
              }
            })
          }
        >
          <p>
            Remove <strong>{removal.business_name}</strong> from your Shop’s new
            checkout choices? Existing Orders keep their selected provider.
          </p>
          {state.error && (
            <>
              <p className="portal-field-error" role="alert">
                {state.error}
              </p>
              <button
                className="portal-button mt-3"
                disabled={busy || state.loading}
                onClick={() => void state.load(true)}
              >
                Refresh providers
              </button>
            </>
          )}
          {!removal.is_enabled && (
            <p className="portal-feedback">
              This provider is already removed. Close this dialog to review the
              latest list.
            </p>
          )}
        </ConfirmationDialog>
      )}
    </main>
  )
}
