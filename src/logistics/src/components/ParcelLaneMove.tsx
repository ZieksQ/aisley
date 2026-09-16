import { useRef, useState } from 'react'
import { ActionButton, ErrorNotice, PrimaryButton, field } from './PickupUi'
import { ApiError, csrf, request } from '../lib/api'
import type { SortingLane } from '../types/sorting'

export function ParcelLaneMove({ shipmentId, revision, laneId, lanes, onMoved, disabled = false }: {
  shipmentId: string; revision: number; laneId: string | null; lanes: SortingLane[]; onMoved: () => Promise<void>; disabled?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pending = useRef<{ body: string; key: string } | null>(null)
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const targets = lanes.filter((lane) => lane.is_active && lane.type === 'standard' && lane.id !== laneId)

  async function move() {
    const lane = targets.find((candidate) => candidate.id === target)
    if (!lane) return
    setBusy(true)
    setError('')
    try {
      const body = JSON.stringify({ lane_id: lane.id, expected_revision: revision, expected_lane_revision: lane.revision, reason: reason.trim() })
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() }
      await csrf()
      await request(`/api/v1/logistics/sorting/shipments/${shipmentId}/move`, { method: 'POST', headers: { 'Idempotency-Key': pending.current.key }, body })
      pending.current = null
      dialog.current?.close()
      await onMoved()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The lane move could not be saved. Refresh before retrying if the parcel changed.')
    } finally { setBusy(false) }
  }

  return <>
    <button className="min-h-10 text-sm font-medium text-[#4C1268] dark:text-purple-300 disabled:opacity-50" disabled={disabled || !navigator.onLine || !targets.length} onClick={() => { setTarget(''); setReason(''); setError(''); dialog.current?.showModal() }} type="button">Move lane</button>
    <dialog ref={dialog} aria-label="Move parcel to another lane" className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto border border-zinc-200 bg-white p-4 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" onCancel={(event) => { if (busy) event.preventDefault() }}>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void move() }}>
        <h3 className="font-semibold">Move parcel lane</h3>
        <p className="text-sm text-zinc-500">Place the parcel in the selected physical lane, then save the move. It stays sorted and ready for dispatch.</p>
        {error ? <ErrorNotice message={error} /> : null}
        <label className="block text-sm font-medium">Destination lane<select className={`${field} mt-1`} required value={target} disabled={busy} onChange={(event) => setTarget(event.target.value)}><option value="">Choose a standard lane</option>{targets.map((lane) => <option value={lane.id} key={lane.id}>{lane.code} · {lane.name}</option>)}</select></label>
        <label className="block text-sm font-medium">Reason<input className={`${field} mt-1`} required minLength={2} maxLength={500} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="flex justify-end gap-2"><ActionButton disabled={busy} onClick={() => dialog.current?.close()} type="button">Cancel</ActionButton><PrimaryButton busy={busy} disabled={!target || reason.trim().length < 2} type="submit">Save move</PrimaryButton></div>
      </form>
    </dialog>
  </>
}
