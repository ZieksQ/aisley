import { useState } from 'react'
import { PrimaryButton, field } from '../../components/PickupUi'
import type { useReceiving } from './useReceiving'

export function ReceivingReconciliation({ receiving }: { receiving: ReturnType<typeof useReceiving> }) {
  const { detail, busy, online, pending, action } = receiving
  const [acknowledged, setAcknowledged] = useState(false)
  const [shortageReason, setShortageReason] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  if (!detail) return null

  return <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-white/10">
    <h4 className="font-semibold">Reconciliation</h4>
    {detail.discrepancies.length ? <ul className="mt-3 space-y-4">
      {detail.discrepancies.map((item) => <li key={item.id}>
        <p className="text-sm">
          <span className="break-all font-mono">{item.reference}</span> · {item.kind} · {item.resolved_at ? 'Resolved' : 'Open'}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {item.reason}{item.resolution_reason ? ` · ${item.resolution_reason}` : ''}
        </p>
        {!item.resolved_at && item.kind !== 'missing' ? <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void action(`discrepancies/${item.id}/resolve`, { reason: reasons[item.id] })
          }}>
          <label className="min-w-48 flex-1 text-sm">
            {item.kind === 'damaged' ? 'Inspection and release reason' : 'Investigation disposition'}
            <input required maxLength={1000} className={`${field} mt-1`} value={reasons[item.id] ?? ''}
              onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} />
          </label>
          <PrimaryButton type="submit" disabled={!online || busy || !reasons[item.id]?.trim()}>
            {item.kind === 'damaged' ? 'Release hold' : 'Close exception'}
          </PrimaryButton>
        </form> : null}
        {!item.resolved_at && item.kind === 'missing' ? <p className="mt-1 text-xs text-zinc-500">
          Scan this parcel when it arrives to resolve the shortage.
        </p> : null}
      </li>)}
    </ul> : <p className="mt-2 text-sm text-zinc-500">No recorded discrepancies.</p>}
    {detail.closed_at ? <p className="mt-4 text-sm">
      Unloading closed: {detail.outcome}. Expected late parcels can still be received without reopening the truck visit.
    </p> : null}
    {detail.status === 'receiving' ? <form className="mt-4 space-y-3" onSubmit={(event) => {
      event.preventDefault()
      if (window.confirm(`Finish unloading with ${detail.counts.outstanding} outstanding parcels? This releases the truck for return.`)) {
        void action('finish', { acknowledge_shortages: acknowledged, reason: shortageReason.trim() || null })
      }
    }}>
      {detail.counts.outstanding > 0 ? <>
        <label className="flex items-start gap-2 text-sm">
          <input className="mt-1" type="checkbox" checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)} />
          I acknowledge {detail.counts.outstanding} missing parcels. They remain unreceived.
        </label>
        <label className="block text-sm">
          Shortage reason
          <textarea required maxLength={1000} className={`${field} mt-1`} value={shortageReason}
            onChange={(event) => setShortageReason(event.target.value)} />
        </label>
      </> : null}
      <p className="text-xs text-zinc-500">
        Synchronize this device first. The server rechecks outstanding parcels at closure.
        Delayed scans from other devices remain retryable.
      </p>
      <PrimaryButton type="submit" disabled={!online || busy || pending.length > 0
        || (detail.counts.outstanding > 0 && (!acknowledged || !shortageReason.trim()))}>
        Finish unloading
      </PrimaryButton>
    </form> : null}
  </div>
}
