import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ActionButton, ErrorNotice, PrimaryButton, panel } from '../../components/PickupUi'
import { ConnectionStatus } from '../../components/ConnectionStatus'
import { useReceiving } from './useReceiving'
import { ReceivingReconciliation } from './ReceivingReconciliation'
import { ReceiptCapture } from './ReceiptCapture'

export function ReceivingWorkspace({ trip, scanning = false }: { trip: string; scanning?: boolean }) {
  const { logistics } = useAuth()
  if (!logistics?.organization?.hub) return null
  const scope = [logistics.id, logistics.organization.id, logistics.organization.hub.id, trip].join(':')
  return <Workspace key={scope} trip={trip} scope={scope} scanning={scanning} />
}

function Workspace({ trip, scope, scanning }: { trip: string; scope: string; scanning: boolean }) {
  const receiving = useReceiving(trip, scope)
  const { detail, pending, busy, online, error, notice, capture, sync, action, refresh } = receiving
  const canScan = !!detail?.arrived_at && !detail.historical_receipt

  return <section className={`${panel} mt-4 p-4`} aria-label="Trip receiving">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold">{detail ? `${detail.from_hub} → ${detail.to_hub}` : 'Trip receiving'}</h3>
        <p className="mt-1 break-all text-xs text-zinc-500">Manifest {detail?.manifest_id ?? '—'}</p>
      </div>
      <div className="flex items-center gap-3">
        <ConnectionStatus online={online} syncing={busy} />
        <ActionButton onClick={() => void refresh()}>Refresh</ActionButton>
      </div>
    </div>
    {error ? <div className="mt-3"><ErrorNotice message={error} /></div> : null}
    {notice ? <p className="mt-3 text-sm" role="status">{notice}</p> : null}
    {detail ? <>
      <p className="mt-3 text-sm">
        Expected: {detail.counts.expected} · Server received: {detail.counts.received} · Outstanding: {detail.counts.outstanding}
        {' '}· Damaged: {detail.counts.damaged} · Awaiting sync on this device: {pending.length}
      </p>
      {!online ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
        Cached manifest. Counts may have changed on another device.
      </p> : null}
      {detail.historical_receipt ? <p className="mt-3 text-sm">
        Historical completed receipt. Individual scan evidence was not recorded.
      </p> : null}
      {detail.status === 'in_transfer' ? <PrimaryButton className="mt-3"
        disabled={!online || busy} onClick={() => void action('start')}>
        Start receiving
      </PrimaryButton> : null}
      {canScan && !scanning ? <Link className="mt-3 inline-block text-sm underline" to={`/receive-at-hub?trip=${trip}`}>
        Open receiving scanner
      </Link> : null}
      {scanning && canScan ? <ReceiptCapture capture={capture} /> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrimaryButton disabled={!online || busy || !pending.length} onClick={() => void sync()}>
          Sync scans ({pending.length})
        </PrimaryButton>
        {scanning ? <Link className="text-sm underline" to={`/inbound-linehaul?trip=${trip}`}>
          Review discrepancies and finish unloading
        </Link> : null}
        <Link className="text-sm underline" to="/sorting">Open Sorting</Link>
      </div>
      {pending.length ? <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-zinc-200 dark:divide-white/10">
        {pending.map((item) => <li key={item.client_id} className="py-2 text-sm">
          <span className="break-all font-mono">{item.reference}</span> · {item.condition} · locally captured
          {item.error ? <p className="text-red-700 dark:text-red-300">{item.error}</p> : null}
        </li>)}
      </ul> : null}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">Manifest parcels ({detail.items.length})</summary>
        <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-zinc-200 dark:divide-white/10">
          {detail.items.map((item) => <li key={item.shipment_id} className="py-2 text-sm">
            <span className="break-all font-mono">{item.reference}</span>
            {' '}· {item.receipt ? `Received (${item.receipt.condition})` : detail.historical_receipt ? 'Historical receipt' : 'Outstanding'}
          </li>)}
        </ul>
      </details>
      {!scanning ? <ReceivingReconciliation receiving={receiving} /> : null}
    </> : <p className="mt-3 text-sm">Connect to load this trip's manifest before offline capture.</p>}
  </section>
}
