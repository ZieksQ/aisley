import { useState } from 'react'
import { useNetwork } from './useNetwork'
import { NetworkConnectionDialog } from './NetworkConnectionDialog'
import { Link } from 'react-router-dom'
import { LuPlus, LuRefreshCw } from 'react-icons/lu'
import {
  PortalButton,
  PortalSkeleton,
  PortalState,
  PortalTable
} from '@aisley/ui/portal'
import { ErrorNotice } from '../../components/PickupUi'
import '../transport.css'

export function NetworkWorkspace({ online }: { online: boolean }) {
  const [modal, setModal] = useState<'directory' | 'incoming' | null>(null)
  const state = useNetwork(online)
  const {
    overview,
    incoming,
    connected,
    busy,
    loading,
    error,
    notice,
    load,
    write
  } = state
  return (
    <div className="transport-workspace">
      <header className="transport-heading">
        <div>
          <h1>Network</h1>
          <p>Manage the Logistics partners connected to your hub.</p>
        </div>
        <div className="portal-inline-actions">
          <PortalButton
            disabled={!online || busy}
            onClick={() => setModal('incoming')}
          >
            Incoming requests ({incoming.length})
          </PortalButton>
          <PortalButton
            variant="primary"
            disabled={!online || busy}
            onClick={() => setModal('directory')}
          >
            <LuPlus aria-hidden="true" />
            Request
          </PortalButton>
        </div>
      </header>
      {!modal && error && (
        <ErrorNotice message={error} retry={() => void load()} />
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}
      {!online && (
        <PortalState
          title="You’re offline"
          description="Reconnect to manage your network. Previously loaded connections may be out of date."
        />
      )}
      {overview && !overview.enabled && (
        <p className="mb-4 text-sm text-amber-800 dark:text-amber-300">
          New routes and departures are paused. Existing connections are shown
          below.
        </p>
      )}
      <section className="transport-panel" aria-label="Connected partners">
        <div className="transport-toolbar">
          <div className="flex-1">
            <h2 className="font-semibold">Connected partners</h2>
            <p className="portal-secondary text-sm">
              {overview
                ? `${connected.size} connected hubs`
                : 'Your approved Logistics connections'}
            </p>
          </div>
          <PortalButton
            disabled={!online || busy || loading}
            onClick={() => void load()}
          >
            <LuRefreshCw aria-hidden="true" />
            Refresh
          </PortalButton>
        </div>
        {loading && !overview ? (
          <PortalSkeleton label="Loading connected partners" />
        ) : connected.size ? (
          <PortalTable label="Connected Logistics partners">
            <thead>
              <tr>
                <th scope="col">Partner hub</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...connected].map(([id, partner]) => (
                <tr key={id}>
                  <td className="font-medium">{partner.name}</td>
                  <td>
                    <span className="transport-status" data-state="connected">
                      Connected
                    </span>
                  </td>
                  <td>
                    <PortalButton
                      disabled={busy || !online}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Disconnect ${partner.name}? New departures will be held.`
                          )
                        )
                          return
                        if (partner.outgoing?.sender_requested)
                          void write('/api/v1/logistics/linehaul/connections', {
                            to_hub_id: id,
                            is_active: false,
                            expected_revision: partner.outgoing.revision
                          })
                        else if (partner.incoming)
                          void write(
                            `/api/v1/logistics/linehaul/connections/${partner.incoming.id}/consent`,
                            {
                              accept: false,
                              expected_revision: partner.incoming.revision
                            }
                          )
                      }}
                    >
                      Disconnect
                    </PortalButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </PortalTable>
        ) : (
          !error && (
            <PortalState
              title="No connected partners"
              description="Request a connection to another Logistics hub to build your network."
              action={
                <PortalButton
                  disabled={!online}
                  onClick={() => setModal('directory')}
                >
                  Find a partner
                </PortalButton>
              }
            />
          )
        )}
      </section>
      <Link className="transport-back mt-4" to="/sort-plan">
        Manage routes in Sort plan →
      </Link>
      {modal && (
        <NetworkConnectionDialog
          state={state}
          modal={modal}
          online={online}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
