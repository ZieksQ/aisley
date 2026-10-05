import { useRef, useState } from 'react'
import { Button } from '@aisley/ui'
import { ErrorNotice, field, panel } from '../../components/PickupUi'
import { date, money, workflowButton } from '../logisticsFinance/presentation'
import type { useDeliveryReview } from './useDeliveryReview'

type ReviewState = ReturnType<typeof useDeliveryReview>

export function ReviewWorkspace({ state, history }: { state: ReviewState; history: boolean }) {
  const [reason, setReason] = useState('')
  const [codConfirmed, setCodConfirmed] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const row = state.selected
  if (!row) return <section className={`${panel} p-5`}>
    <h3 className="font-semibold">No review selected</h3>
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Select an Order to view its delivery proof.</p>
  </section>
  function approve() {
    if (!row || !state.photoUrl || (row.cod && !codConfirmed)) return
    void state.run({
      kind: 'approve',
      proofId: row.proof.id,
      reference: row.order.reference,
      key: crypto.randomUUID(),
      body: {
        reference: row.shipment_reference,
        target_state: 'delivered',
        expected_revision: row.shipment_revision,
        evidence_id: row.proof.id,
      }
    })
  }
  function correct() {
    if (!row || reason.trim().length < 3 || !window.confirm(`Request a new photo for ${row.order.reference}? Delivery remains pending.`)) return
    void state.run({
      kind: 'correct',
      proofId: row.proof.id,
      reference: row.order.reference,
      key: crypto.randomUUID(),
      body: {
        reason: reason.trim(), expected_revision: row.task_revision,
      }
    })
  }
  return <section className={`${panel} min-w-0 p-4 sm:p-5`} aria-label="POD review">
    <h3 className="break-words font-semibold">
      {row.order.reference}
    </h3>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Courier</dt>
        <dd>
          {row.courier.name || 'Courier'}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Photo submitted</dt>
        <dd>
          {date(row.proof.submitted_at)}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Recipient</dt>
        <dd>
          {row.destination?.recipient_name ?? 'Unavailable'}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Delivery address</dt>
        <dd className="break-words">
          {row.destination?.address ?? 'Unavailable'}
        </dd>
      </div>
    </dl>
    <div className="mt-5">
      {state.photoLoading && <p role="status" className="py-6 text-sm">Loading private photo…</p>}
      {state.photoError && <ErrorNotice message={state.photoError} retry={state.reloadPhoto} />}
      {state.photoUrl && <>
        <button
          type="button"
          className="block w-full border border-zinc-200 bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/10 dark:bg-zinc-900"
          onClick={() => dialog.current?.showModal()}
          aria-label="Enlarge proof photo"
        >
          <img
            className="max-h-80 w-full object-contain"
            src={state.photoUrl}
            alt={`Delivery proof for ${row.order.reference}`}
          />
        </button>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Select the photo to enlarge.</p>
        <dialog
          ref={dialog}
          className="m-auto max-h-[90dvh] w-[min(95vw,70rem)] overflow-auto border border-zinc-300 bg-white p-4 text-zinc-900 backdrop:bg-black/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Enlarged delivery proof"
        >
          <div className="mb-3 flex justify-end">
            <Button variant="outline" className={workflowButton} onClick={() => dialog.current?.close()}>Close photo</Button>
          </div>
          <img
            className="max-h-[75dvh] w-full object-contain"
            src={state.photoUrl}
            alt={`Enlarged delivery proof for ${row.order.reference}`}
          />
        </dialog>
      </>}
    </div>
    {history ? <dl className="mt-5 space-y-3 border-t border-zinc-200 pt-4 text-sm dark:border-white/10">
      <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Decision</dt>
        <dd>
          {row.proof.status === 'validated' ? 'Approved' : 'Correction requested'}
          {row.review.method === 'automatic' ? ' automatically' : ''}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Reviewed by</dt>
        <dd>{row.review.reviewer ?? 'Logistics'} · {date(row.review.reviewed_at)}</dd>
      </div>
      {row.review.reason && <div>
        <dt className="text-zinc-500 dark:text-zinc-400">Correction reason</dt>
        <dd className="whitespace-pre-wrap break-words">
          {row.review.reason}
        </dd>
      </div>}
    </dl> : <div className="mt-5 space-y-4 border-t border-zinc-200 pt-4 dark:border-white/10">
      {row.intent?.automatic_review_error && <p className="text-sm text-amber-800 dark:text-amber-300">Automatic completion needs manual review. Refresh the delivery context before approving.</p>}
      {row.intent?.approval_mode === 'automatic' && !row.intent.automatic_review_error && <p role="status" className="text-sm">Automatic approval is queued. You can also review this delivery manually.</p>}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Check that the parcel and handoff or delivery destination are visible and match this Order.</p>
      {row.cod && <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[#4C1268]"
          disabled={state.locked}
          checked={codConfirmed}
          onChange={(event) => setCodConfirmed(event.target.checked)}
        />
        <span>I confirm the Courier collected {money(Number(row.cod.declared_amount) * 100, row.cod.currency)} from the Customer.<span className="mt-1 block text-zinc-600 dark:text-zinc-400">Cash handover from the Courier is recorded separately in Courier cash remittance.</span></span>
      </label>}
      <Button
        variant="secondary"
        className={workflowButton}
        disabled={state.locked || !state.photoUrl || Boolean(row.cod && (!codConfirmed || !row.cod.collected))}
        onClick={approve}
      >Approve delivery</Button>
      <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-white/10">
        <label htmlFor="correction-reason" className="block text-sm font-medium">Correction reason</label>
        <textarea
          id="correction-reason"
          className={`${field} h-auto! min-h-24 py-2`}
          minLength={3}
          maxLength={1000}
          value={reason}
          disabled={state.locked}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain what the Courier needs to correct."
        />
        <Button
          variant="outline"
          className={workflowButton}
          disabled={state.locked || reason.trim().length < 3}
          onClick={correct}
        >Request correction</Button>
      </div>
    </div>}
  </section>
}
