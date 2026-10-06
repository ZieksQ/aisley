import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { sortingExceptions, sortingMutation } from '../../lib/sortingApi'
import { ErrorNotice, field, manilaDate, panel } from '../PickupUi'
import { SortingButton } from './SortingButton'

type Exception = {
  id: string; shipment_id: string; reference: string | null; revision: number
  exception_code: string; cause: string; reason: string | null; attempts: number
  last_attempt_at: string; next_action: string; can_recover: boolean; released_at: string | null
}
type Queue = { data: Exception[]; current_page: number; last_page: number; total: number }
type Attempt = { path: string; body: string; key: string }

export function ExceptionQueue({ hasSession, onChanged }: { hasSession: boolean; onChanged: () => Promise<void> }) {
  const [queue, setQueue] = useState<Queue | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [inspecting, setInspecting] = useState<Exception | null>(null)
  const [reason, setReason] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const attempt = useRef<Attempt | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setQueue(await sortingExceptions<Queue>(page)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Exceptions could not be loaded.') }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load, hasSession])

  async function mutate(path: string, body: Record<string, unknown>) {
    if (busy) return
    attempt.current ??= { path, body: JSON.stringify(body), key: crypto.randomUUID() }
    setBusy(true)
    setError('')
    try {
      await sortingMutation(attempt.current)
      attempt.current = null
      setUncertain(false)
      setSelected([])
      dialog.current?.close()
      setInspecting(null)
      await onChanged()
      await load()
    } catch (caught) {
      const unknown = !(caught instanceof ApiError) || caught.status === 408 || caught.status === 0 || caught.status >= 500
      setUncertain(unknown)
      if (!unknown) attempt.current = null
      setError(caught instanceof Error ? caught.message : 'The exception action could not be confirmed.')
    } finally { setBusy(false) }
  }

  return <section className={`${panel} mt-3`} aria-labelledby="exception-queue-title">


    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-3 dark:border-white/10">
      <h3 id="exception-queue-title" className="font-semibold">
        Outstanding exceptions ({queue?.total ?? '…'})
      </h3>
      <SortingButton disabled={loading || busy} onClick={() => void load()}>
        Refresh exceptions
      </SortingButton>
    </div>

    <div className="space-y-3 p-3">


      <p className="text-sm">
        Correct the cause before rescanning. Exceptions carry over between sessions and remain received at hub.
      </p>
      {error ? <ErrorNotice message={error} retry={uncertain ? () => { if (attempt.current) void mutate(attempt.current.path, {}) } : () => void load()} /> : null}
      {loading ? <p role="status">
        Loading exceptions…
      </p> : !error && !queue?.data.length ? <p className="text-sm text-zinc-500">
        No outstanding sorting exceptions.
      </p> : null}

      <ul className="divide-y divide-zinc-200 dark:divide-white/10">
        {queue?.data.map((row) => <li key={row.id} className="space-y-2 py-3">


          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={selected.includes(row.shipment_id)} disabled={hasSession || !row.can_recover || busy || uncertain || (selected.length >= 100 && !selected.includes(row.shipment_id))} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.shipment_id] : current.filter((id) => id !== row.shipment_id))} />
            <span className="min-w-0">
              <strong className="break-all font-mono">
                {row.reference ?? row.shipment_id}
              </strong>
              <span className="block">
                {row.exception_code.replaceAll('_', ' ')} · {row.reason ?? row.cause.replaceAll('_', ' ')}
              </span>
            </span>
          </label>

          <p className="text-sm">
            Next action: {row.next_action}
          </p>
          <p className="text-xs text-zinc-500">
            {row.attempts} attempt(s) · {manilaDate(row.last_attempt_at)}
          </p>
          {row.exception_code === 'damaged' && !row.released_at ? <SortingButton disabled={busy || uncertain} onClick={() => { setInspecting(row); setReason(''); dialog.current?.showModal() }}>
            Record inspection / release
          </SortingButton> : null}

        </li>)}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <SortingButton disabled={hasSession || !selected.length || busy || uncertain} onClick={() => void mutate('/api/v1/logistics/sorting/sessions', { recovery_shipment_ids: selected })}>
          Start recovery session ({selected.length})
        </SortingButton>
        <span className="text-xs text-zinc-500">
          One open session per hub; select up to 100 parcels.
        </span>
      </div>
      {queue && queue.last_page > 1 ? <div className="flex items-center gap-2">
        <SortingButton disabled={page <= 1 || busy || uncertain} onClick={() => setPage((value) => value - 1)}>
          Previous
        </SortingButton>
        <span className="text-sm">
          Page {queue.current_page} of {queue.last_page}
        </span>
        <SortingButton disabled={page >= queue.last_page || busy || uncertain} onClick={() => setPage((value) => value + 1)}>
          Next
        </SortingButton>
      </div> : null}

    </div>

    <dialog ref={dialog} aria-labelledby="inspection-title" className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-md border border-zinc-300 bg-white p-4 text-zinc-950 backdrop:bg-black/50 dark:border-white/20 dark:bg-zinc-900 dark:text-white" onCancel={(event) => { if (busy || uncertain) event.preventDefault() }}>


      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (inspecting) void mutate(`/api/v1/logistics/sorting/exceptions/${inspecting.id}/release`, { expected_revision: inspecting.revision, reason }) }}>


        <h3 id="inspection-title" className="font-semibold">
          Inspection and release
        </h3>
        <p className="text-sm">
          Document the inspection and why the parcel is safe to sort. Receiving condition holds must be released through Receiving first. Release still requires a new scan.
        </p>
        {error ? <ErrorNotice message={error} /> : null}

        <label className="block text-sm">
          Inspection / release reason
          <input className={`${field} mt-1`} value={reason} required minLength={3} maxLength={1000} disabled={busy || uncertain} onChange={(event) => setReason(event.target.value)} />
        </label>

        <div className="flex justify-end gap-2">
          <SortingButton disabled={busy || uncertain} onClick={() => dialog.current?.close()}>
            Cancel
          </SortingButton>
          <SortingButton disabled={busy} type="submit">
            {uncertain ? 'Verify previous release' : 'Record release'}
          </SortingButton>
        </div>

      </form>

    </dialog>

  </section>
}
