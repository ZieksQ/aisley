import { useRef, useState } from 'react'
import type { SortingLane } from '../../types/sorting'
import { ApiError } from '../../lib/api'
import { sortingMutation } from '../../lib/sortingApi'
import { ErrorNotice, field } from '../PickupUi'
import { SortingButton } from './SortingButton'

export function LaneControl({ lane, onChanged }: { lane: SortingLane; onChanged: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const attempt = useRef<{ key: string; body: string } | null>(null)
  const [state, setState] = useState<SortingLane['operational_state']>(lane.operational_state)
  const [reason, setReason] = useState(lane.blocking_reason ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)

  async function save() {
    if (busy) return
    attempt.current ??= { key: crypto.randomUUID(), body: JSON.stringify({ expected_revision: lane.revision, operational_state: state, blocking_reason: reason || null }) }
    setBusy(true)
    setError('')
    try {
      await sortingMutation({ path: `/api/v1/logistics/sorting/lanes/${lane.id}`, ...attempt.current }, 'PATCH')
      attempt.current = null
      setUncertain(false)
      dialog.current?.close()
      await onChanged()
    } catch (caught) {
      const unknown = !(caught instanceof ApiError) || caught.status === 408 || caught.status === 0 || caught.status >= 500
      setUncertain(unknown)
      if (!unknown) attempt.current = null
      setError(caught instanceof Error ? caught.message : 'Lane control could not be confirmed.')
    } finally { setBusy(false) }
  }

  return <>
    <SortingButton onClick={() => { setState(lane.operational_state); setReason(lane.blocking_reason ?? ''); dialog.current?.showModal() }}>
      Lane {lane.code}: {lane.operational_state}
    </SortingButton>
    <dialog ref={dialog} aria-labelledby={`lane-state-${lane.id}`} className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-md border border-zinc-300 bg-white p-4 text-zinc-950 backdrop:bg-black/50 dark:border-white/20 dark:bg-zinc-900 dark:text-white" onCancel={(event) => { if (busy || uncertain) event.preventDefault() }}>


      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void save() }}>


        <h3 id={`lane-state-${lane.id}`} className="font-semibold">
          Operate lane {lane.code}
        </h3>

        <p className="text-sm">
          Pause and Hold retain staged parcels and reservations. New scans go to the exception lane; dispatch and hub pickup wait until this lane resumes.
        </p>
        {error ? <ErrorNotice message={error} /> : null}

        <label className="block text-sm">
          State
          <select className={`${field} mt-1`} disabled={busy || uncertain} value={state} onChange={(event) => setState(event.target.value as SortingLane['operational_state'])}>
            <option value="open">
              Open / Resume
            </option>
            <option value="paused">
              Paused
            </option>
            <option value="held">
              Held
            </option>
          </select>
        </label>

        <label className="block text-sm">
          Reason
          <input className={`${field} mt-1`} value={reason} required={state !== 'open'} minLength={3} maxLength={1000} disabled={busy || uncertain} onChange={(event) => setReason(event.target.value)} />
        </label>

        <div className="flex justify-end gap-2">
          <SortingButton disabled={busy || uncertain} onClick={() => dialog.current?.close()}>
            Cancel
          </SortingButton>
          <SortingButton disabled={busy} type="submit">
            {uncertain ? 'Verify previous change' : 'Save lane state'}
          </SortingButton>
        </div>

      </form>

    </dialog>
  </>
}
