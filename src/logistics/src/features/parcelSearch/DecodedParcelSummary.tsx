import { FaBarcode } from 'react-icons/fa6'
import type { DecodedParcelBarcode } from '../../lib/parcelBarcode'
import { human } from './presentation'

export function DecodedParcelSummary({
  decoded,
}: {
  decoded: DecodedParcelBarcode
}) {
  const format =
    decoded.format === 'aisley-waybill-qr'
      ? 'Aisley waybill QR'
      : decoded.format === 'aisley-parcel-qr'
        ? 'Aisley parcel QR'
        : decoded.format === 'structured'
          ? 'Structured barcode data'
          : 'Reference barcode'
  return (
    <div
      className="mt-3 border-l-2 border-blue-600 bg-blue-50/70 px-3 py-2 text-sm dark:border-blue-400 dark:bg-blue-400/10"
      role="status"
    >
      <div className="flex items-start gap-2">
        <FaBarcode
          className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="font-medium">Barcode decoded locally</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {format}. Encoded fields are informational; the online record is
            authoritative for current custody and status.
          </p>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-600 dark:text-slate-400">
                Lookup reference
              </dt>
              <dd className="truncate font-mono">
                {decoded.reference ?? 'Not present'}
              </dd>
            </div>
            {decoded.waybillReference ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Waybill</dt>
                <dd className="truncate font-mono">
                  {decoded.waybillReference}
                </dd>
              </div>
            ) : null}
            {decoded.orderReference ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Order</dt>
                <dd className="truncate font-mono">{decoded.orderReference}</dd>
              </div>
            ) : null}
            {decoded.parcelReference ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">Parcel</dt>
                <dd className="truncate font-mono">
                  {decoded.parcelReference}
                </dd>
              </div>
            ) : null}
            {decoded.parcelId ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Parcel ID
                </dt>
                <dd className="truncate font-mono">{decoded.parcelId}</dd>
              </div>
            ) : null}
            {decoded.shipmentId ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Shipment ID
                </dt>
                <dd className="truncate font-mono">{decoded.shipmentId}</dd>
              </div>
            ) : null}
            {decoded.status ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Encoded status (unverified)
                </dt>
                <dd className="capitalize">{human(decoded.status)}</dd>
              </div>
            ) : null}
            {decoded.itemCount !== null ? (
              <div>
                <dt className="text-slate-600 dark:text-slate-400">
                  Encoded item count
                </dt>
                <dd>{decoded.itemCount}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  )
}
