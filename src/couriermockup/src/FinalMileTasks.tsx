import { Button, TextField } from '@aisley/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, request } from './lib/api'
import { newDeliverySubmission, submitDelivery, type DeliverySubmission } from './deliverySubmission'
import { DeliveryHistory } from './DeliveryHistory'
import { DeliveryPhotoCapture } from './DeliveryPhotoCapture'
import { FinalMileBatches } from './FinalMileBatches'
import type { Address, Area, Completion, DeliveryContext, EvidenceReceipt, FinalMileTask } from './finalMileTypes'

type PendingRequest = { signature: string; key: string }

function parcelPrice(task: FinalMileTask): string {
  const price = task.parcel?.price
  if (price == null || !Number.isFinite(Number(price))) return 'Unavailable'
  const amount = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(price))
  return `${task.parcel?.currency === 'PHP' ? '₱' : `${task.parcel?.currency ?? 'PHP'} `}${amount}`
}

function address(value: Address | Area | null): string {
  if (!value) return 'Unavailable'
  return [
    'address_line_1' in value ? value.address_line_1 : null,
    'address_line_2' in value ? value.address_line_2 : null,
    'barangay' in value ? value.barangay : null,
    value.city_municipality, value.province, value.region,
    'postal_code' in value ? value.postal_code : null,
  ].filter(Boolean).join(', ') || 'Unavailable'
}

function message(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'POLICY_CONSENT_REQUIRED') return 'Current policies must be accepted before this action. Refresh the workspace.'
    if (error.status === 401) return 'Session expired. Sign in again.'
    if (error.status === 403) return 'Courier approval or access no longer permits this action.'
    if (error.status === 404) return 'This task or parcel is unavailable to your account.'
    if (error.status === 409) return `${error.message} Refresh the task before starting a new action.`
    if (error.status === 429) return 'Too many requests. Wait briefly and retry.'
    return error.message
  }
  return error instanceof Error ? error.message : 'The request failed. Check connectivity and refresh.'
}

export function FinalMileTasks({ token }: { token: string }) {
  const [dispatchRevision, setDispatchRevision] = useState(0)
  const [tasks, setTasks] = useState<FinalMileTask[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<FinalMileTask | null>(null)
  const [delivery, setDelivery] = useState<DeliveryContext | null>(null)
  const [completion, setCompletion] = useState<Completion | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingHubPickup, setPendingHubPickup] = useState<string[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [codCollected, setCodCollected] = useState(false)
  const [failedReason, setFailedReason] = useState('recipient_unavailable')
  const [failedNote, setFailedNote] = useState('')
  const deliverySubmission = useRef<DeliverySubmission | null>(null)
  const [deliveryStage, setDeliveryStage] = useState('')
  const retry = useRef<PendingRequest | null>(null)
  const detailRequest = useRef(0)


  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await request<{ data: FinalMileTask[] }>('/api/v1/courier/final-mile-tasks', {}, token)
      setTasks(result.data)
      setSelectedId((current) => result.data.some((task) => task.task_id === current) ? current : result.data[0]?.task_id ?? null)
    } catch (caught) { setError(message(caught)) }
    finally { setLoading(false) }
  }, [token])

  const loadDetail = useCallback(async (taskId: string) => {
    const requestNumber = ++detailRequest.current
    setBusy('detail')
    setError(null)
    setDelivery(null)
    setCompletion(null)
    try {
      const task = (await request<{ data: FinalMileTask }>(`/api/v1/courier/final-mile-tasks/${taskId}`, {}, token)).data
      if (requestNumber !== detailRequest.current) return
      setDetail(task)
      if (task.status !== 'delivery_accepted') setPendingHubPickup((current) => current.filter((id) => id !== taskId))
      setTasks((current) => current.map((item) => item.task_id === taskId ? task : item))
      if (task.status !== 'delivery_assigned' && task.status !== 'rejected') {
        const [context, status] = await Promise.all([
          request<{ data: DeliveryContext }>(`/api/v1/courier/tasks/${taskId}/delivery`, {}, token),
          request<{ data: Completion }>(`/api/v1/courier/tasks/${taskId}/completion`, {}, token),
        ])
        if (requestNumber !== detailRequest.current) return
        setDelivery(context.data)
        setCompletion(status.data)
      } else { setDelivery(null); setCompletion(null) }
    } catch (caught) { if (requestNumber === detailRequest.current) setError(message(caught)) }
    finally { if (requestNumber === detailRequest.current) setBusy(null) }
  }, [token])

  useEffect(() => { void loadTasks() }, [loadTasks])
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else { setDetail(null); setDelivery(null); setCompletion(null) }
    setPhoto(null)
    setCodCollected(false)
    setReason('')
    retry.current = null
    deliverySubmission.current = null
    setDeliveryStage('')
  }, [selectedId, loadDetail])

  function select(id: string) {
    if (id === selectedId || busy) return
    detailRequest.current++
    setSelectedId(id)
    setDetail(null)
    setDelivery(null)
    setCompletion(null)
    setReason('')
    setPhoto(null)
    setCodCollected(false)
    setFailedNote('')
    setNotice(null)
    retry.current = null
  }


  async function act(name: string, path: string, body?: object, idempotent = false) {
    if (!detail) return
    const signature = JSON.stringify({ path, body })
    if (idempotent && retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() }
    const key = retry.current?.key
    setBusy(name)
    setError(null)
    setNotice(null)
    try {
      const result = await request<{ data: FinalMileTask | EvidenceReceipt | Completion }>(path, {
        method: 'POST',
        headers: idempotent && key ? { 'Idempotency-Key': key } : undefined,
        body: JSON.stringify(body ?? {}),
      }, token)
      if (name === 'accept' || name === 'move' || name === 'reject') {
        const task = result.data as FinalMileTask
        setDetail(task)
        setTasks((current) => current.map((item) => item.task_id === task.task_id ? task : item))
      }
      setNotice(name === 'pickup' ? 'Hub pickup evidence submitted. Awaiting Logistics validation.'
        : name === 'failed' ? 'Attempt recorded. This delivery remains assigned for a later retry.'
          : name === 'reject' ? 'Parcel rejected. It is available for Logistics to schedule again.'
            : 'Action recorded by the API.')
      retry.current = null
      if (name === 'pickup') setPendingHubPickup((current) => [...new Set([...current, detail.task_id])])
      if (name !== 'reject') await loadDetail(detail.task_id)
      if (name === 'accept' || name === 'reject') {
        setDispatchRevision((current) => current + 1)
        await loadTasks()
      }
    } catch (caught) {
      setError(message(caught))
    } finally { setBusy(null) }
  }

  async function deliver() {
    if (!task || busy || !canSubmitDelivery) return
    if (!deliverySubmission.current || deliverySubmission.current.taskId !== task.task_id
      || deliverySubmission.current.revision !== task.revision || deliverySubmission.current.photo !== photo) {
      deliverySubmission.current = newDeliverySubmission(task, photo, hasReusableProof ? proofId ?? null : null, isCod)
    }
    setBusy('delivery')
    setError(null)
    setNotice(null)
    try {
      const result = await submitDelivery(deliverySubmission.current, token, setDeliveryStage)
      setPhoto(null)
      deliverySubmission.current = null
      await loadDetail(task.task_id)
      setNotice(result.task_status === 'delivered'
        ? 'Delivery confirmed.' : 'Delivery submitted to Logistics.')
      setDispatchRevision((current) => current + 1)
    } catch (caught) {
      setError(message(caught))
      if (deliverySubmission.current?.proofId) setNotice('Photo saved. Tap Delivery again to finish submitting to Logistics.')
    } finally { setBusy(null); setDeliveryStage('') }
  }


  const task = detail?.task_id === selectedId ? detail : null
  const active = task && !busy
  const proofId = completion?.evidence_id ?? task?.evidence_id
  const hasReusableProof = task?.status === 'out_for_delivery' && proofId && ['awaiting_validation', 'validated'].includes(completion?.evidence_status ?? '')
    && completion?.proof_failed_attempt_count === task.failed_attempt_count
    && (!completion.intent_id || completion.intent_evidence_id !== proofId)
  const payment = delivery?.order
  const isCod = payment?.payment_method === 'cod'
  const paymentKnown = payment && ['cod', 'prepaid'].includes(payment.payment_method ?? '')
    && !!payment.currency && payment.payable_total != null && payment.payable_total !== '' && Number.isFinite(Number(payment.payable_total)) && Number(payment.payable_total) >= 0
  const canSubmitDelivery = task?.status === 'out_for_delivery' && completion?.completion_status !== 'awaiting_validation'
    && paymentKnown && (!isCod || codCollected)
    && (photo ? photo.size > 0 && photo.size < 10 * 1024 * 1024 : hasReusableProof)


  return (
    <section className="pickup-workspace" aria-labelledby="final-mile-heading">
      <div className="pickup-toolbar">
        <div><h2 id="final-mile-heading">Active deliveries</h2><p className="panel-description">Accepted tasks stay here while delivery confirmation is pending.</p></div>
        <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={!!busy} isLoading={loading} onClick={() => void loadTasks()} variant="outline">Refresh tasks</Button>
      </div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <FinalMileBatches disabled={!!busy} onSelect={select} revision={dispatchRevision} token={token} />
      {loading && tasks.length === 0 ? <p className="empty-state">Loading final-mile tasks…</p> : null}
      {!loading && tasks.length === 0 ? <p className="empty-state">No active final-mile tasks are assigned.</p> : null}
      {tasks.length > 0 ? <div className="pickup-layout">
        <ul className="task-list" aria-label="Final-mile tasks">
          {tasks.map((item) => <li key={item.task_id}>
            <button aria-current={selectedId === item.task_id ? 'true' : undefined} className="task-row" disabled={!!busy} onClick={() => select(item.task_id)} type="button">
              <span><strong>{item.parcel?.reference ?? item.order?.reference ?? 'Parcel'}</strong><span>{address(item.destination_area)}</span><span>{item.parcel?.item_count ?? 0} items · {parcelPrice(item)}</span></span>
              <span>{item.status.replaceAll('_', ' ')}</span>
            </button>
          </li>)}
        </ul>
        <div className="task-detail">
          {busy === 'detail' && !task ? <p>Loading task…</p> : null}
          {task ? <>
            <dl className="task-facts">
              <div><dt>Parcel</dt><dd>{task.parcel?.reference ?? task.order?.reference ?? 'Parcel'} · {task.parcel?.item_count ?? 0} items</dd></div>
              <div><dt>Parcel price</dt><dd>{parcelPrice(task)}</dd></div>
              <div><dt>Pickup area</dt><dd>{address(task.pickup_area)}</dd></div>
              <div><dt>Destination area</dt><dd>{address(task.destination_area)}</dd></div>
              <div><dt>Task status</dt><dd>{task.status.replaceAll('_', ' ')} · revision {task.revision}</dd></div>
              <div><dt>Proof</dt><dd>{task.evidence_status.replaceAll('_', ' ')}</dd></div>
              {task.offer?.rejection_reason ? <div><dt>Rejection reason</dt><dd>{task.offer.rejection_reason}</dd></div> : null}
            </dl>
            {task.status === 'delivery_assigned' ? <div className="verification-panel">
              <p>Accept or reject this parcel only.</p>
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active} onClick={() => { if (window.confirm('Accept this parcel for delivery?')) void act('accept', `/api/v1/courier/final-mile-tasks/${task.task_id}/accept`) }} variant="secondary">Accept parcel</Button>
              <TextField id="final-rejection" label="Reason for rejection" onChange={(event) => setReason(event.target.value)} value={reason} />
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active || reason.trim().length < 3} onClick={() => void act('reject', `/api/v1/courier/final-mile-tasks/${task.task_id}/reject`, { reason: reason.trim() }, true)} variant="outline">Reject parcel</Button>
            </div> : null}
            {delivery ? <dl className="task-facts">
              <div><dt>Pickup hub</dt><dd>{delivery.pickup_hub?.name ?? 'Unavailable'} · {address(delivery.pickup_hub?.address ?? null)}</dd></div>
              <div><dt>Delivery address</dt><dd>{address(delivery.destination)}</dd></div>
              {delivery.delivery_instructions ? <div><dt>Instructions</dt><dd>{delivery.delivery_instructions}</dd></div> : null}
            </dl> : null}
            {task.status === 'delivery_accepted' ? <p className="confirmation-note">Confirm hub pickup only after physically receiving the parcel. Submission awaits Logistics validation.</p> : null}
            {pendingHubPickup.includes(task.task_id) && task.status === 'delivery_accepted' ? <p className="status-line">Hub pickup evidence is awaiting Logistics validation.</p> : null}
            {task.status === 'delivery_accepted' && !pendingHubPickup.includes(task.task_id) ? <div className="verification-panel">
              <p>Confirm the selected delivery was physically received from the Logistics hub.</p>
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active} onClick={() => void act('pickup', `/api/v1/courier/final-mile-tasks/${task.task_id}/pickup`, { expected_revision: task.revision }, true)} variant="secondary">Request hub pickup confirmation</Button>
            </div> : null}
            {task.status === 'delivery_accepted' ? <p className="confirmation-note">Hub custody changes only after Logistics validates pickup evidence. Refresh to check its status.</p> : null}
            {task.status === 'picked_up_from_hub' || task.status === 'in_transit' ? <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active} onClick={() => void act('move', `/api/v1/courier/final-mile-tasks/${task.task_id}/status`, { target_state: task.status === 'picked_up_from_hub' ? 'in_transit' : 'out_for_delivery', expected_revision: task.revision }, true)} variant="secondary">{task.status === 'picked_up_from_hub' ? 'Start transit' : 'Out for delivery'}</Button> : null}
            {task.status === 'out_for_delivery' && completion?.completion_status !== 'awaiting_validation' ? <div className="verification-panel">
              <DeliveryPhotoCapture busy={!!busy} key={task.task_id} onPhoto={(value) => { setPhoto(value); deliverySubmission.current = null }} photo={photo} retrying={task.failed_attempt_count > 0} />
              {isCod ? <label className="flex items-start gap-2 text-sm"><input checked={codCollected} disabled={!!busy} className="mt-1 accent-[#E6007A]" onChange={(event) => setCodCollected(event.target.checked)} type="checkbox" /><span>Confirm I collected the full COD amount {payment?.payable_total ? `${payment?.currency === 'PHP' ? '₱' : `${payment?.currency ?? ''} `}${Number(payment?.payable_total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''} in cash.</span></label> : null}
              {!paymentKnown ? <p className="error-message" role="alert">Payment details are unavailable. Refresh the task before submitting Delivery.</p> : null}
              <label htmlFor="failed-delivery-reason">If delivery could not be completed</label>
              <select id="failed-delivery-reason" onChange={(event) => setFailedReason(event.target.value)} value={failedReason}><option value="recipient_unavailable">Customer not home</option><option value="address_unreachable">Address unreachable</option><option value="recipient_refused">Customer refused</option><option value="other">Other</option></select>
              {failedReason === 'other' ? <TextField id="failed-delivery-note" label="Reason" onChange={(event) => setFailedNote(event.target.value)} value={failedNote} /> : null}
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active || (failedReason === 'other' && !failedNote.trim())} onClick={() => void act('failed', `/api/v1/courier/final-mile-tasks/${task.task_id}/failed-attempts`, { reason: failedReason, note: failedNote.trim() || null, expected_revision: task.revision }, true)} variant="outline">Record unsuccessful attempt</Button>
            </div> : null}
            {task.failed_attempts?.length ? <p className="status-line">Delivery attempt unsuccessful: {task.failed_attempts[0].reason.replaceAll('_', ' ')} · {new Date(task.failed_attempts[0].attempted_at).toLocaleString('en-PH')}. Retry delivery remains available on this task; submit fresh POD after another attempt.</p> : null}
            {completion ? <p className="status-line">Completion: {completion.completion_status?.replaceAll('_', ' ') ?? 'No intent'} · Proof: {completion.evidence_status.replaceAll('_', ' ')}{completion.delivered_at ? ` · Delivered ${new Date(completion.delivered_at).toLocaleString('en-PH')}` : ''}</p> : null}
            {task.status === 'out_for_delivery' && completion?.completion_status !== 'awaiting_validation' ? <div className="space-y-2">
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active || !canSubmitDelivery} onClick={() => void deliver()} variant="secondary">{busy === 'delivery' ? 'Submitting delivery…' : 'Delivery'}</Button>
              {deliveryStage ? <p className="status-line" role="status">{deliveryStage}</p> : <p className="status-line">Submit the parcel photo and delivery together to Logistics delivery confirmations.</p>}
            </div> : null}
            {completion?.completion_status === 'awaiting_validation' ? <p className="notice" role="status">Delivery submitted · awaiting Logistics confirmation.</p> : null}
            <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={!!busy} onClick={() => void loadDetail(task.task_id)} variant="outline">Refresh task state</Button>
          </> : null}
        </div>
      </div> : null}
      <DeliveryHistory token={token} />
    </section>
  )
}
