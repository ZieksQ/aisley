import { Button, TextField } from '@aisley/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, request } from './lib/api'
import { DeliveryHistory } from './DeliveryHistory'
import { QrScanner } from './QrScanner'
import type { Address, Area, Completion, DeliveryContext, EvidenceReceipt, FinalMileTask } from './finalMileTypes'

type IdentifierType = 'qr' | 'tracking_id' | 'order_id'
type PendingRequest = { signature: string; key: string }

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
  const [tasks, setTasks] = useState<FinalMileTask[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<FinalMileTask | null>(null)
  const [delivery, setDelivery] = useState<DeliveryContext | null>(null)
  const [completion, setCompletion] = useState<Completion | null>(null)
  const [identifierType, setIdentifierType] = useState<IdentifierType>('tracking_id')
  const [identifier, setIdentifier] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingHubPickup, setPendingHubPickup] = useState<string[]>([])
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
  }, [selectedId, loadDetail])

  function select(id: string) {
    detailRequest.current++
    setSelectedId(id)
    setDetail(null)
    setDelivery(null)
    setCompletion(null)
    setIdentifier('')
    setReason('')
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
        : name === 'proof' ? 'Delivery proof submitted. Submit completion intent for Logistics validation.'
          : name === 'complete' ? 'Completion intent submitted. Awaiting Logistics validation.'
            : name === 'reject' ? 'Offer rejected. Logistics may offer the task again.'
              : 'Action recorded by the API.')
      retry.current = null
      if (name === 'pickup') setPendingHubPickup((current) => [...new Set([...current, detail.task_id])])
      if (name !== 'reject') await loadDetail(detail.task_id)
      if (name === 'complete') await loadTasks()
    } catch (caught) {
      setError(message(caught))
    } finally { setBusy(null) }
  }

  const task = detail?.task_id === selectedId ? detail : null
  const active = task && !busy
  const evidenceBody = task ? { identifier_type: identifierType, identifier: identifier.trim(), expected_revision: task.revision } : null
  const proofId = completion?.evidence_id ?? task?.evidence_id
  const canComplete = task?.status === 'out_for_delivery' && proofId && completion?.completion_status == null

  return (
    <section className="pickup-workspace" aria-labelledby="final-mile-heading">
      <div className="pickup-toolbar">
        <div><h2 id="final-mile-heading">Final-mile deliveries</h2><p className="panel-description">Offers, hub pickup, movement, and delivery evidence.</p></div>
        <Button className="min-h-10 rounded-md px-4 shadow-none" isLoading={loading} onClick={() => void loadTasks()} variant="outline">Refresh tasks</Button>
      </div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {loading && tasks.length === 0 ? <p className="empty-state">Loading final-mile tasks…</p> : null}
      {!loading && tasks.length === 0 ? <p className="empty-state">No active final-mile tasks are assigned.</p> : null}
      {tasks.length > 0 ? <div className="pickup-layout">
        <ul className="task-list" aria-label="Final-mile tasks">
          {tasks.map((item) => <li key={item.task_id}>
            <button aria-current={selectedId === item.task_id ? 'true' : undefined} className="task-row" onClick={() => select(item.task_id)} type="button">
              <span><strong>{item.order?.reference ?? item.parcel?.reference ?? 'Task'}</strong><span>{address(item.destination_area)}</span></span>
              <span>{item.status.replaceAll('_', ' ')}</span>
            </button>
          </li>)}
        </ul>
        <div className="task-detail">
          {busy === 'detail' && !task ? <p>Loading task…</p> : null}
          {task ? <>
            <dl className="task-facts">
              <div><dt>Order</dt><dd>{task.order?.reference ?? '—'}</dd></div>
              <div><dt>Waybill / tracking ID</dt><dd>{task.waybill?.reference ?? '—'}</dd></div>
              <div><dt>Parcel</dt><dd>{task.parcel?.reference ?? '—'} · {task.parcel?.item_count ?? 0} items</dd></div>
              <div><dt>Pickup area</dt><dd>{address(task.pickup_area)}</dd></div>
              <div><dt>Destination area</dt><dd>{address(task.destination_area)}</dd></div>
              <div><dt>Task status</dt><dd>{task.status.replaceAll('_', ' ')} · revision {task.revision}</dd></div>
              <div><dt>Proof</dt><dd>{task.evidence_status.replaceAll('_', ' ')}</dd></div>
              {task.offer?.rejection_reason ? <div><dt>Rejection reason</dt><dd>{task.offer.rejection_reason}</dd></div> : null}
            </dl>
            {task.status === 'delivery_assigned' ? <div className="verification-panel">
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active} onClick={() => void act('accept', `/api/v1/courier/final-mile-tasks/${task.task_id}/accept`)} variant="secondary">Accept delivery</Button>
              <TextField id="final-rejection" label="Reason for rejection" onChange={(event) => setReason(event.target.value)} value={reason} />
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active || reason.trim().length < 3} onClick={() => void act('reject', `/api/v1/courier/final-mile-tasks/${task.task_id}/reject`, { reason: reason.trim() }, true)} variant="outline">Reject offer</Button>
            </div> : null}
            {delivery ? <dl className="task-facts">
              <div><dt>Pickup hub</dt><dd>{delivery.pickup_hub?.name ?? 'Unavailable'} · {address(delivery.pickup_hub?.address ?? null)}</dd></div>
              <div><dt>Delivery address</dt><dd>{address(delivery.destination)}</dd></div>
              {delivery.delivery_instructions ? <div><dt>Instructions</dt><dd>{delivery.delivery_instructions}</dd></div> : null}
            </dl> : null}
            {task.status === 'delivery_accepted' ? <p className="confirmation-note">Confirm hub pickup only after physically receiving the parcel. Submission awaits Logistics validation.</p> : null}
            {pendingHubPickup.includes(task.task_id) && task.status === 'delivery_accepted' ? <p className="status-line">Hub pickup evidence is awaiting Logistics validation.</p> : null}
            {['delivery_accepted', 'out_for_delivery'].includes(task.status) && !pendingHubPickup.includes(task.task_id) && task.evidence_status !== 'awaiting_validation' && !completion?.intent_id ? <div className="verification-panel">
              <label htmlFor="final-identifier-type">Parcel identifier</label>
              <select id="final-identifier-type" onChange={(event) => { setIdentifierType(event.target.value as IdentifierType); setIdentifier(''); retry.current = null }} value={identifierType}>
                <option value="tracking_id">Tracking ID</option><option value="order_id">Order reference</option><option value="qr">Waybill QR payload</option>
              </select>
              {identifierType === 'qr' ? <QrScanner onRead={(value) => { setIdentifier(value); retry.current = null; setNotice('QR candidate captured. Confirm only after the physical handoff.') }} /> : null}
              <TextField id="final-identifier" label="Identifier on parcel" onChange={(event) => { setIdentifier(event.target.value); retry.current = null }} value={identifier} />
              <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active || !identifier.trim()} onClick={() => void act(task.status === 'delivery_accepted' ? 'pickup' : 'proof', task.status === 'delivery_accepted' ? `/api/v1/courier/final-mile-tasks/${task.task_id}/pickup` : `/api/v1/courier/tasks/${task.task_id}/proof-of-delivery`, evidenceBody ?? {}, true)} variant="secondary">{task.status === 'delivery_accepted' ? 'Submit hub pickup evidence' : 'Submit delivery proof'}</Button>
            </div> : null}
            {task.status === 'delivery_accepted' ? <p className="confirmation-note">Hub custody changes only after Logistics validates pickup evidence. Refresh to check its status.</p> : null}
            {task.status === 'picked_up_from_hub' || task.status === 'in_transit' ? <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active} onClick={() => void act('move', `/api/v1/courier/final-mile-tasks/${task.task_id}/status`, { target_state: task.status === 'picked_up_from_hub' ? 'in_transit' : 'out_for_delivery', expected_revision: task.revision }, true)} variant="secondary">{task.status === 'picked_up_from_hub' ? 'Start transit' : 'Out for delivery'}</Button> : null}
            {completion ? <p className="status-line">Completion: {completion.completion_status?.replaceAll('_', ' ') ?? 'No intent'} · Proof: {completion.evidence_status.replaceAll('_', ' ')}{completion.delivered_at ? ` · Delivered ${new Date(completion.delivered_at).toLocaleString('en-PH')}` : ''}</p> : null}
            {canComplete ? <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!active} onClick={() => void act('complete', `/api/v1/courier/tasks/${task.task_id}/completion`, { evidence_id: proofId, expected_revision: task.revision, confirmed: true }, true)} variant="secondary">Submit completion intent</Button> : null}
            <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={!!busy} onClick={() => void loadDetail(task.task_id)} variant="outline">Refresh task state</Button>
          </> : null}
        </div>
      </div> : null}
      <DeliveryHistory token={token} />
    </section>
  )
}
