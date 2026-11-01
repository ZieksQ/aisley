import {
  PortalButton,
  PortalModal,
  PortalPagination,
  PortalSkeleton,
  PortalState
} from '@aisley/ui/portal'
import { ErrorNotice } from '../../components/PickupUi'
import type { useNetwork } from './useNetwork'

export function NetworkConnectionDialog({
  state,
  modal,
  online,
  onClose
}: {
  state: ReturnType<typeof useNetwork>
  modal: 'directory' | 'incoming'
  online: boolean
  onClose: () => void
}) {
  const {
    overview,
    busy,
    error,
    notice,
    load,
    search,
    setSearch,
    setPage,
    page,
    loading,
    connected,
    write,
    incoming
  } = state
  return (
    <PortalModal
      title={
        modal === 'directory'
          ? 'Request a connection'
          : 'Incoming connection requests'
      }
      description={
        modal === 'directory'
          ? 'Find a Logistics partner. The receiving hub must accept before the connection can be used.'
          : 'Review the hubs requesting to connect to your organization.'
      }
      busy={busy}
      onClose={onClose}
    >
      {error && <ErrorNotice message={error} retry={() => void load()} />}
      {notice && (
        <p role="status" className="mb-3 text-sm">
          {notice}
        </p>
      )}
      {modal === 'directory' ? (
        <>
          <label className="portal-label">
            Search Logistics or location
            <input
              type="search"
              className="portal-input mt-2 w-full"
              maxLength={100}
              value={search}
              disabled={busy}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
          {loading ? (
            <PortalSkeleton label="Loading Logistics directory" rows={3} />
          ) : (
            <ul className="mt-4 divide-y divide-[var(--portal-border)]">
              {overview?.hubs.map((hub) => {
                const outgoing = overview.connections.find(
                  (item) => item.to_hub_id === hub.id
                )
                const isConnected = connected.has(hub.id)
                return (
                  <li
                    key={hub.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium break-words">
                        {hub.business_name}
                      </p>
                      <p className="portal-secondary text-sm">{hub.name}</p>
                      <p className="portal-secondary text-xs">
                        {[hub.city_municipality, hub.province]
                          .filter(Boolean)
                          .join(', ') || 'Location unavailable'}
                      </p>
                    </div>
                    {isConnected ? (
                      <span className="transport-status" data-state="connected">
                        Connected
                      </span>
                    ) : outgoing?.sender_requested ? (
                      <div>
                        <p className="portal-secondary mb-1 text-xs">
                          Request pending
                        </p>
                        <PortalButton
                          disabled={busy || !online}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Withdraw this connection request?'
                              )
                            )
                              void write(
                                '/api/v1/logistics/linehaul/connections',
                                {
                                  to_hub_id: hub.id,
                                  is_active: false,
                                  expected_revision: outgoing.revision
                                }
                              )
                          }}
                        >
                          Withdraw request
                        </PortalButton>
                      </div>
                    ) : (
                      <PortalButton
                        disabled={busy || !online}
                        onClick={() =>
                          void write('/api/v1/logistics/linehaul/connections', {
                            to_hub_id: hub.id,
                            is_active: true,
                            expected_revision: outgoing?.revision
                          })
                        }
                      >
                        Request
                      </PortalButton>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {!loading && !error && overview?.hubs.length === 0 && (
            <PortalState
              title="No Logistics partners found"
              description="Try another business name, hub, or location."
            />
          )}
          {overview && (
            <PortalPagination
              page={page}
              lastPage={overview.hub_directory.last_page}
              total={overview.hub_directory.total}
              disabled={loading || busy || !online}
              onPage={setPage}
            />
          )}
        </>
      ) : incoming.length ? (
        <ul className="divide-y divide-[var(--portal-border)]">
          {incoming.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <p className="font-medium">
                {row.from_hub?.name ?? 'Partner hub'}
              </p>
              <div className="portal-inline-actions">
                <PortalButton
                  variant="primary"
                  disabled={busy || !online}
                  onClick={() =>
                    void write(
                      `/api/v1/logistics/linehaul/connections/${row.id}/consent`,
                      { accept: true, expected_revision: row.revision }
                    )
                  }
                >
                  Accept
                </PortalButton>
                <PortalButton
                  disabled={busy || !online}
                  onClick={() => {
                    if (window.confirm('Decline this connection request?'))
                      void write(
                        `/api/v1/logistics/linehaul/connections/${row.id}/consent`,
                        { accept: false, expected_revision: row.revision }
                      )
                  }}
                >
                  Decline
                </PortalButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <PortalState
            title="No incoming requests"
            description="New connection requests will appear here."
          />
        )
      )}
    </PortalModal>
  )
}
