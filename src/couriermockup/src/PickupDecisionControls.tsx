import { Button, TextField } from '@aisley/ui'
import { useEffect, useRef, useState } from 'react'
import { request } from './lib/api'
import type { FirstMileTask } from './types'

interface DecisionResult {
  available_for_scheduling: boolean
  failed_pickup_count: number | null
}

export function PickupDecisionControls({ task, token, onSaved }: {
  task: FirstMileTask
  token: string
  onSaved: (message: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retry = useRef<{ signature: string; key: string } | null>(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  async function decide(action: 'reject' | 'failed-pickup') {
    if (busy || !reason.trim()) return
    if (action === 'reject' && !window.confirm('Reject this entire pickup schedule? Its uncollected parcels will return to Logistics scheduling.')) return
    const path = action === 'reject'
      ? `/api/v1/courier/pickup-schedules/${task.schedule.id}/reject`
      : `/api/v1/courier/first-mile-tasks/${task.id}/failed-pickup`
    const body = JSON.stringify({ reason: reason.trim() })
    const signature = path + body
    if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() }
    setBusy(true)
    setError(null)
    try {
      const response = await request<{ data: DecisionResult }>(path, {
        method: 'POST', headers: { 'Idempotency-Key': retry.current.key }, body,
      }, token)
      if (!active.current) return
      retry.current = null
      setReason('')
      await onSaved(response.data.available_for_scheduling
        ? 'Uncollected parcels are available for a new pickup schedule.'
        : `Failed pickup recorded (${response.data.failed_pickup_count}/3). You can try this parcel again before the retry deadline.`)
    } catch (caught) {
      if (active.current) setError(caught instanceof Error ? caught.message : 'Could not save. Retry with the same reason after checking your connection.')
    } finally {
      if (active.current) setBusy(false)
    }
  }

  if (!['assigned', 'accepted'].includes(task.status)) return null
  const expired = Date.parse(task.schedule.retry_deadline_at) <= Date.now()
  const notStarted = Date.parse(task.schedule.starts_at) > Date.now()

  return (
    <div className="verification-panel">
      <p>Failed pickups: {task.failed_pickup_count}/3. Retry until {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(task.schedule.retry_deadline_at))} PHT.</p>
      <TextField id={`pickup-decision-${task.id}`} label="Reason" maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {task.status === 'assigned' ? (
        <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={busy || expired || !reason.trim()} onClick={() => void decide('reject')} variant="outline">Reject pickup schedule</Button>
      ) : (
        <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={busy || expired || notStarted || !reason.trim()} onClick={() => void decide('failed-pickup')} variant="outline">Failed to pickup</Button>
      )}
      {expired ? <p role="status">The retry period has ended. Refresh after Logistics releases the uncollected parcels.</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
    </div>
  )
}
