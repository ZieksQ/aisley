import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { PortalButton, PortalModal, PortalSkeleton } from '@aisley/ui/portal'
import { ReceivingWorkspace } from '../features/linehaulReceiving/ReceivingWorkspace'
import { receivingAction } from '../features/linehaulReceiving/api'
import {
  InboundTripTable,
  type InboundView
} from '../features/inboundLinehaul/InboundTripTable'
import { FlatpickrInput } from '../components/FlatpickrInput'
import { ErrorNotice } from '../components/PickupUi'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import { defaultLinehaulTime } from '../types/linehaulTrips'
import type { LinehaulOverview, LinehaulTrip } from '../types/linehaulTrips'
import '../features/transport.css'

export function InboundLinehaulPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const selectedTrip = params.get('trip')
  const requestedView = params.get('view')
  const view: InboundView = selectedTrip
    ? 'receiving'
    : requestedView === 'arriving' ||
        requestedView === 'receiving' ||
        requestedView === 'visitors'
      ? requestedView
      : 'requests'
  const [overview, setOverview] = useState<LinehaulOverview | null>(null)
  const [scheduledFor, setScheduledFor] = useState(defaultLinehaulTime)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rejecting, setRejecting] = useState<LinehaulTrip | null>(null)
  const [reason, setReason] = useState('')
  const load = useCallback(async () => {
    setError('')
    try {
      const response = await requestWithTimeout<{ data: LinehaulOverview }>(
        '/api/v1/logistics/linehaul/trips'
      )
      setOverview(response.data)
    } catch (caught) {
      if (caught instanceof ApiError && [401, 403].includes(caught.status))
        setOverview(null)
      setError(
        caught instanceof Error
          ? caught.message
          : 'Linehaul inbound could not be loaded.'
      )
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    document.title = 'Linehaul inbound | Aisley Logistics'
    void load()
    const timer = window.setInterval(() => {
      if (navigator.onLine) void load()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [load])

  async function post(trip: LinehaulTrip, action: string, body: object) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await csrf()
      await requestWithTimeout(
        `/api/v1/logistics/linehaul/trips/${trip.id}/${action}`,
        {
          method: 'POST',
          headers:
            action === 'return'
              ? { 'Idempotency-Key': crypto.randomUUID() }
              : undefined,
          body: JSON.stringify(body)
        }
      )
      setNotice('Linehaul trip updated.')
      setRejecting(null)
      setReason('')
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The linehaul action could not be completed.'
      )
    } finally {
      setBusy(false)
    }
  }
  async function startReceiving(trip: LinehaulTrip) {
    setBusy(true)
    setError('')
    try {
      await receivingAction(trip.id, 'start', {
        client_id: crypto.randomUUID()
      })
      if (trip.empty_return) await load()
      else navigate(`/receive-at-hub?trip=${trip.id}`)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not start receiving.'
      )
    } finally {
      setBusy(false)
    }
  }
  function scheduleReturn(trip: LinehaulTrip, empty: boolean) {
    const time = new Date(scheduledFor.replace(' ', 'T'))
    if (!Number.isFinite(time.getTime())) {
      setError('Choose a valid return schedule.')
      return
    }
    void post(trip, 'return', {
      scheduled_for: time.toISOString(),
      empty_return: empty
    })
  }
  const trips = {
    requests: overview?.inbound.filter((trip) => trip.can_decide) ?? [],
    arriving: overview?.inbound.filter((trip) => trip.can_receive) ?? [],
    receiving:
      overview?.inbound.filter(
        (trip) => trip.status === 'receiving' || trip.status === 'received'
      ) ?? [],
    visitors: overview?.visitors ?? []
  }
  const labels = {
    requests: 'Approval requests',
    arriving: 'Arriving trips',
    receiving: 'Receiving',
    visitors: 'Visiting trucks'
  }
  return (
    <div className="transport-workspace">
      <header className="transport-heading">
        <div>
          <h1>Linehaul inbound</h1>
          <p>
            Approve transfers, receive arriving loads, and schedule visiting
            trucks home.
          </p>
        </div>
        <PortalButton disabled={busy || loading} onClick={() => void load()}>
          Refresh
        </PortalButton>
      </header>
      <nav
        className="transport-tabs flex-wrap"
        aria-label="Linehaul inbound views"
      >
        {(Object.keys(labels) as InboundView[]).map((item) => (
          <Link
            key={item}
            to={`?view=${item}`}
            aria-current={view === item ? 'page' : undefined}
          >
            {labels[item]}
            {overview ? ` · ${trips[item].length}` : ''}
          </Link>
        ))}
      </nav>
      {error && !rejecting && (
        <ErrorNotice message={error} retry={() => void load()} />
      )}
      {notice && (
        <p
          className="mb-4 text-sm text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          {notice}
        </p>
      )}
      <section className="transport-panel" aria-label={labels[view]}>
        <div className="transport-toolbar">
          <div>
            <h2 className="font-semibold">{labels[view]}</h2>
            <p className="portal-secondary mt-1 text-sm">
              {view === 'visitors'
                ? 'Returns commit immediately and notify the truck owner and driver.'
                : view === 'receiving'
                  ? 'Review unloading progress, receipts, and parcel discrepancies.'
                  : view === 'arriving'
                    ? 'Start receiving only when the truck physically arrives at your hub.'
                    : 'Approve the load before the origin hub can release it for departure.'}
            </p>
          </div>
        </div>
        {view === 'visitors' && (
          <div className="border-b border-[var(--portal-border)] p-4">
            <label className="portal-label block max-w-sm">
              Return schedule
              <FlatpickrInput
                className="portal-input mt-2 w-full"
                value={scheduledFor}
                onChange={setScheduledFor}
                options={{
                  enableTime: true,
                  time_24hr: true,
                  dateFormat: 'Y-m-d H:i',
                  minDate: 'today',
                  minuteIncrement: 15
                }}
              />
            </label>
          </div>
        )}
        {loading ? (
          <PortalSkeleton label="Loading inbound trips" />
        ) : (
          overview && (
            <InboundTripTable
              trips={trips[view]}
              view={view}
              busy={busy}
              onApprove={(trip) =>
                void post(trip, 'decision', {
                  accept: true,
                  expected_revision: trip.revision
                })
              }
              onReject={(trip) => {
                setReason('')
                setError('')
                setRejecting(trip)
              }}
              onReceive={(trip) => void startReceiving(trip)}
              onReturn={scheduleReturn}
            />
          )
        )}
      </section>
      {selectedTrip && (
        <div className="mt-6">
          <ReceivingWorkspace key={selectedTrip} trip={selectedTrip} />
        </div>
      )}
      {rejecting && (
        <PortalModal
          title="Reject transfer request"
          description={`Explain why the load from ${rejecting.from_hub.name} cannot be accepted.`}
          busy={busy}
          onClose={() => setRejecting(null)}
        >
          {error && <ErrorNotice message={error} />}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (reason.trim())
                void post(rejecting, 'decision', {
                  accept: false,
                  reason: reason.trim(),
                  expected_revision: rejecting.revision
                })
            }}
          >
            <label className="portal-label">
              Rejection reason
              <textarea
                required
                maxLength={1000}
                className="portal-input mt-2 min-h-28 w-full py-3"
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="portal-inline-actions mt-4">
              <PortalButton
                variant="danger"
                type="submit"
                disabled={busy || !reason.trim()}
              >
                Reject transfer
              </PortalButton>
              <PortalButton disabled={busy} onClick={() => setRejecting(null)}>
                Cancel
              </PortalButton>
            </div>
          </form>
        </PortalModal>
      )}
    </div>
  )
}
