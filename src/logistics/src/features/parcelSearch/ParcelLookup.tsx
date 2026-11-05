import { useRef } from 'react'
import { LuCamera, LuSearch, LuSquare } from 'react-icons/lu'
import { PortalButton } from '@aisley/ui/portal'
import { useWaybillCamera } from '../../lib/useWaybillCamera'
import { DecodedParcelSummary } from './DecodedParcelSummary'
import type { useParcelSearch } from './useParcelSearch'

export function ParcelLookup({
  model,
}: {
  model: ReturnType<typeof useParcelSearch>
}) {
  const video = useRef<HTMLVideoElement>(null)
  useWaybillCamera(model.scannerOpen, video, model.handleScan, (message) => {
    model.setDetailError(message)
    model.setScannerOpen(false)
  })
  return (
    <section
      className="portal-section parcel-lookup"
      aria-labelledby="parcel-lookup-title"
    >
      <div className="parcel-section-heading">
        <h3 id="parcel-lookup-title">Find a parcel</h3>
        <p className="portal-secondary text-sm">
          Enter a reference or scan the tracking barcode or Aisley waybill QR.
        </p>
      </div>
      <form
        className="parcel-lookup-form"
        onSubmit={(event) => {
          event.preventDefault()
          void model.loadRecord(model.reference)
        }}
      >
        <label className="min-w-0 flex-1" htmlFor="parcel-reference">
          <span className="portal-label">Tracking ID or parcel reference</span>
          <input
            id="parcel-reference"
            className="portal-input"
            autoComplete="off"
            placeholder="Tracking ID, waybill, Order, Parcel, or shipment"
            value={model.reference}
            disabled={model.lookupBlocked}
            onChange={(event) => model.setReference(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <PortalButton
            variant="primary"
            type="submit"
            disabled={model.lookupBlocked}
            isLoading={model.detailLoading}
            loadingLabel="Looking up…"
          >
            <LuSearch aria-hidden="true" />
            Look up
          </PortalButton>
          <PortalButton
            aria-label={
              model.scannerOpen
                ? 'Stop barcode scanner'
                : 'Start barcode scanner'
            }
            aria-pressed={model.scannerOpen}
            disabled={model.lookupBlocked}
            onClick={() => model.setScannerOpen((open) => !open)}
          >
            {model.scannerOpen ? (
              <LuSquare aria-hidden="true" />
            ) : (
              <LuCamera aria-hidden="true" />
            )}
            {model.scannerOpen ? 'Stop camera' : 'Scan barcode'}
          </PortalButton>
        </div>
      </form>
      {model.scannerOpen ? (
        <div className="parcel-camera">
          <video
            ref={video}
            className="max-h-72 w-full bg-black object-contain"
            autoPlay
            muted
            playsInline
          />
          <p className="bg-slate-950 p-3 text-sm text-slate-200">
            Keep both ends of the barcode and its white margins visible. The
            waybill QR also works.
          </p>
        </div>
      ) : null}
      {model.decodedParcel ? (
        <div className="px-4 pb-4">
          <DecodedParcelSummary decoded={model.decodedParcel} />
        </div>
      ) : null}
    </section>
  )
}
