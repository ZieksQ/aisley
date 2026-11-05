import { useEffect, useRef, useState } from 'react'
import { LuRefreshCw } from 'react-icons/lu'
import {
  IconButton,
  PortalButton,
  PortalSkeleton,
  PortalState,
} from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { ErrorNotice } from '../components/PickupUi'
import { ParcelLookup } from '../features/parcelSearch/ParcelLookup'
import { ParcelResults } from '../features/parcelSearch/ParcelResults'
import { RecordDetail } from '../features/parcelSearch/RecordDetail'
import { useParcelSearch } from '../features/parcelSearch/useParcelSearch'
import '../features/hubOperations/workspaces.css'
import '../features/parcelSearch/parcelSearch.css'

export function FulfillmentOperationsPage() {
  const { logistics } = useAuth()
  const hub = logistics?.organization?.hub
  const context = hub ? `${logistics.organization!.id}:${hub.id}` : ''
  if (!context)
    return (
      <PortalState
        title="Parcel search unavailable"
        description="An authenticated Logistics organization and hub are required."
      />
    )
  return (
    <ParcelSearchWorkspace
      key={`${logistics?.id}:${context}`}
      context={context}
    />
  )
}

function ParcelSearchWorkspace({ context }: { context: string }) {
  const model = useParcelSearch(context)
  const detail = useRef<HTMLElement>(null)
  const [wide, setWide] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!wide && (model.record || model.detailError)) {
      detail.current?.focus()
      detail.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }, [wide, model.record?.shipment_id, model.detailError])
  const summary = model.queue?.summary
  const focusResults = () => {
    const results = document.getElementById('parcel-results')
    results?.focus()
    results?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
  const detailPanel = (
    <section
      key="details"
      tabIndex={-1}
      ref={detail}
      className="portal-section parcel-detail"
      aria-label="Fulfillment record detail"
      aria-busy={model.detailLoading}
    >
      <header className="parcel-section-heading flex flex-wrap items-center justify-between gap-2">
        <h3>Parcel details</h3>
        <div className="flex flex-wrap gap-2">
          <PortalButton className="parcel-back" onClick={focusResults}>
            Back to results
          </PortalButton>
          {model.record ? (
            <PortalButton
              disabled={model.lookupBlocked || model.detailLoading}
              onClick={() => void model.retryLookup()}
            >
              Refresh details
            </PortalButton>
          ) : null}
        </div>
      </header>
      {model.notice ? (
        <p
          className={`${model.recordSource === 'offline-cache' ? 'parcel-warning' : 'parcel-success'} m-4`}
          role="status"
        >
          {model.notice}
        </p>
      ) : null}
      {model.detailError ? (
        <div className="m-4">
          <ErrorNotice
            message={model.detailError}
            retry={
              !model.uncertain && !model.transitionBusy
                ? () => void model.retryLookup()
                : undefined
            }
          />
        </div>
      ) : null}
      {model.uncertain ? (
        <div className="parcel-warning m-4">
          <p>
            The previous custody update is unconfirmed. Verify it before
            selecting another parcel.
          </p>
          <PortalButton
            disabled={!model.online}
            isLoading={model.transitionBusy}
            onClick={() => void model.submitTransition()}
          >
            Verify previous update
          </PortalButton>
        </div>
      ) : null}
      {model.detailLoading ? (
        <PortalSkeleton
          label={
            model.online
              ? 'Loading parcel details'
              : 'Loading cached parcel details'
          }
        />
      ) : model.record ? (
        <RecordDetail
          key={`${model.record.shipment_id}:${model.record.revision}:${model.recordSource}`}
          actionsEnabled={model.actionsEnabled}
          record={model.record}
          reason={model.reason}
          setReason={model.setReason}
          evidenceChoice={model.evidenceChoice}
          setEvidenceChoice={model.setEvidenceChoice}
          transitionBusy={model.transitionBusy}
          onTransition={(target, evidenceId) =>
            void model.transition(target, evidenceId)
          }
          onProofRejected={() => {
            model.setEvidenceChoice({})
            void model.retryLookup()
          }}
          finalTask={model.finalTask}
        />
      ) : !model.detailError ? (
        <PortalState
          title="Choose a parcel to view details"
          description="Look up a reference, scan a barcode, or choose a parcel from the results."
        />
      ) : null}
    </section>
  )
  return (
    <div className="portal-page hub-workspace parcel-search">
      <header className="hub-page-header">
        <div>
          <h2 className="portal-page-heading">Parcel search</h2>
          <p className="portal-secondary mt-2 text-sm">
            Find a parcel and review its current custody, tasks, and delivery
            evidence.
          </p>
        </div>
        <div className="hub-header-actions">
          <ConnectionStatus
            online={model.online}
            syncing={model.queueLoading || model.detailLoading}
            offlineLabel="Offline — cached parcels only"
          />
          <IconButton
            label="Refresh parcel queue"
            disabled={model.queueLoading}
            onClick={() => void model.loadQueue()}
          >
            <LuRefreshCw
              className={model.queueLoading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
          </IconButton>
        </div>
      </header>
      <ParcelLookup model={model} />
      {summary ? (
        <dl
          className="parcel-summary"
          aria-label={
            model.queue?.freshness.state === 'offline-cache'
              ? 'Cached queue summary'
              : 'Queue summary'
          }
        >
          <div>
            <dt>Matching parcels</dt>
            <dd>{summary.total}</dd>
          </div>
          <div>
            <dt>Evidence awaiting validation</dt>
            <dd>{summary.pending_evidence}</dd>
          </div>
          <div>
            <dt>Completion intents</dt>
            <dd>{summary.pending_completion}</dd>
          </div>
          <div>
            <dt>Out for delivery</dt>
            <dd>{summary.by_status.out_for_delivery ?? 0}</dd>
          </div>
        </dl>
      ) : null}
      <div className="parcel-workspace">
        {!wide && (model.record || model.detailLoading || model.detailError)
          ? [detailPanel, <ParcelResults key="results" model={model} />]
          : [<ParcelResults key="results" model={model} />, detailPanel]}
      </div>
    </div>
  )
}
