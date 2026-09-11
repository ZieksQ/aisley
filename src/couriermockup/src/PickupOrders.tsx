import type { IScannerControls } from '@zxing/browser'
import { Button, TextField } from '@aisley/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, request } from './lib/api'
import { PickupRouteMap } from './PickupRouteMap'
import type { FirstMileTask, FirstMileTaskListResponse, PickupConfirmationResponse } from './types'

type IdentifierType = 'qr' | 'order_id'

function formatManila(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function pickupAddress(task: FirstMileTask): string {
  if (!task.pickup) return 'Pickup address unavailable'
  return [
    task.pickup.address_line_1,
    task.pickup.address_line_2,
    task.pickup.barangay,
    task.pickup.city_municipality,
    task.pickup.province,
    task.pickup.region,
    task.pickup.postal_code,
  ].filter(Boolean).join(', ')
}

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again.'
    if (error.status === 403) return 'Your Courier account or Logistics approval no longer permits this action.'
    if (error.status === 404) return 'This task or parcel identifier is unavailable.'
    if (error.status === 409) return 'This task changed. Refresh the list before trying again.'
    if (error.status === 429) return 'Too many requests. Wait briefly before retrying.'
    return `${error.message}${error.code ? ` (${error.code})` : ''}`
  }
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

export function PickupOrders({ token }: { token: string }) {
  const [tasks, setTasks] = useState<FirstMileTask[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [identifierType, setIdentifierType] = useState<IdentifierType>('qr')
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<PickupConfirmationResponse['data'] | null>(null)
  const retryRef = useRef<{ signature: string; key: string } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const selected = tasks.find((task) => task.id === selectedId) ?? null
  const schedules = Array.from(tasks.reduce((groups, task) => {
    const group = groups.get(task.schedule.id) ?? []
    group.push(task)
    groups.set(task.schedule.id, group)
    return groups
  }, new Map<string, FirstMileTask[]>()).entries())

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await request<FirstMileTaskListResponse>('/api/v1/courier/first-mile-tasks?per_page=50', {}, token)
      setTasks(response.data)
      setSelectedId((current) => response.data.some((task) => task.id === current) ? current : response.data[0]?.id ?? null)
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void loadTasks() }, [loadTasks])

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return
    const video = videoRef.current
    let disposed = false
    void import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      const reader = new BrowserQRCodeReader()
      return reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (disposed || !result) return
        setIdentifierType('qr')
        setIdentifier(result.getText())
        setNotice('QR candidate captured. Review the parcel and use Confirm pickup to record custody.')
        setScannerOpen(false)
      })
    }).then((controls) => {
      scannerControlsRef.current = controls
      if (disposed) controls.stop()
    }).catch((caught: unknown) => {
      setError(caught instanceof DOMException && caught.name === 'NotAllowedError'
        ? 'Camera permission was denied. Use manual Order reference entry instead.'
        : 'The camera could not start. Use manual Order reference entry instead.')
      setScannerOpen(false)
    })
    return () => {
      disposed = true
      scannerControlsRef.current?.stop()
      scannerControlsRef.current = null
    }
  }, [scannerOpen])

  function chooseTask(task: FirstMileTask) {
    scannerControlsRef.current?.stop()
    setScannerOpen(false)
    setSelectedId(task.id)
    setIdentifier('')
    setIdentifierType('qr')
    setConfirmation(null)
    setError(null)
    setNotice(null)
    retryRef.current = null
  }

  async function acceptTask() {
    if (!selected) return
    setBusy('accept')
    setError(null)
    try {
      const response = await request<{ data: FirstMileTask }>(`/api/v1/courier/first-mile-tasks/${selected.id}/accept`, { method: 'POST' }, token)
      setTasks((current) => current.map((task) => task.id === response.data.id ? response.data : task))
      setNotice('Task accepted. Scan the waybill QR or enter the printed Order reference at the Seller handoff.')
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(null)
    }
  }

  async function confirmPickup() {
    if (!selected || !identifier.trim()) return
    const payload = { identifier_type: identifierType, identifier: identifier.trim() }
    const signature = JSON.stringify({ task: selected.id, ...payload })
    if (retryRef.current?.signature !== signature) {
      retryRef.current = { signature, key: crypto.randomUUID() }
    }
    setBusy('pickup')
    setError(null)
    try {
      const response = await request<PickupConfirmationResponse>(
        `/api/v1/courier/first-mile-tasks/${selected.id}/pickup`,
        { method: 'POST', headers: { 'Idempotency-Key': retryRef.current.key }, body: JSON.stringify(payload) },
        token,
      )
      setConfirmation(response.data)
      setTasks((current) => current.map((task) => task.id === selected.id
        ? { ...task, status: 'picked_up_from_seller', picked_up_at: response.data.picked_up_at }
        : task))
      setNotice('Pickup recorded by the server. The next step is Logistics parcel receipt (not implemented here).')
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="pickup-workspace" aria-labelledby="pickup-heading">
      <div className="pickup-toolbar">
        <div>
          <h2 id="pickup-heading">Seller pickup tasks</h2>
          <p className="panel-description">Assigned parcels from the authenticated Courier API.</p>
        </div>
        <Button className="min-h-10 rounded-md px-4 shadow-none" isLoading={loading} loadingLabel="Loading" onClick={() => void loadTasks()} variant="outline">Refresh tasks</Button>
      </div>

      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}

      {loading && tasks.length === 0 ? <p className="empty-state">Loading assigned pickup tasks…</p> : null}
      {!loading && tasks.length === 0 ? <p className="empty-state">No assigned or accepted pickup tasks are available.</p> : null}

      {tasks.length > 0 ? (
        <div className="pickup-layout">
          <ul className="task-list" aria-label="Pickup schedules and parcels">
            {schedules.map(([scheduleId, scheduleTasks]) => (
              <li className="schedule-group" key={scheduleId}>
                <div className="schedule-group-header">
                  <strong>{scheduleTasks[0].schedule.reference}</strong>
                  <span>{scheduleTasks.length} parcel{scheduleTasks.length === 1 ? '' : 's'} · {formatManila(scheduleTasks[0].schedule.starts_at)} PHT</span>
                </div>
                <ul>
                  {scheduleTasks.map((task) => (
                    <li key={task.id}>
                      <button aria-current={selectedId === task.id ? 'true' : undefined} className="task-row" onClick={() => chooseTask(task)} type="button">
                        <span><strong>{task.order.reference}</strong><span>{task.pickup?.shop_name ?? 'Seller pickup'}</span></span>
                        <span>{task.status.replaceAll('_', ' ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {selected ? (
            <div className="task-detail">
              <dl className="task-facts">
                <div><dt>Schedule</dt><dd>{selected.schedule.reference}</dd></div>
                <div><dt>Window</dt><dd>{formatManila(selected.schedule.starts_at)}–{formatManila(selected.schedule.ends_at)} PHT</dd></div>
                <div><dt>Seller</dt><dd>{selected.pickup?.shop_name ?? '—'}</dd></div>
                <div><dt>Pickup address</dt><dd>{pickupAddress(selected)}</dd></div>
                <div><dt>Order reference</dt><dd>{selected.order.reference}</dd></div>
                <div><dt>Waybill</dt><dd>{selected.waybill.reference}</dd></div>
                <div><dt>Destination area</dt><dd>{selected.destination_area ? `${selected.destination_area.city_municipality}, ${selected.destination_area.province}` : '—'}</dd></div>
                <div><dt>Status</dt><dd>{selected.status.replaceAll('_', ' ')}</dd></div>
              </dl>

              <PickupRouteMap key={selected.schedule.id} scheduleId={selected.schedule.id} token={token} />

              {selected.status === 'assigned' ? (
                <Button className="min-h-11 rounded-md px-4 shadow-none" isLoading={busy === 'accept'} loadingLabel="Accepting" onClick={() => void acceptTask()} variant="secondary">Accept task</Button>
              ) : null}

              {selected.status === 'accepted' ? (
                <div className="verification-panel">
                  <div className="input-methods" role="group" aria-label="Parcel identifier method">
                    <button aria-pressed={identifierType === 'qr'} onClick={() => { setIdentifierType('qr'); setIdentifier(''); retryRef.current = null }} type="button">Waybill QR</button>
                    <button aria-pressed={identifierType === 'order_id'} onClick={() => { setIdentifierType('order_id'); setIdentifier(''); setScannerOpen(false); retryRef.current = null }} type="button">Order reference</button>
                  </div>

                  {identifierType === 'qr' ? (
                    <>
                      <Button className="min-h-11 rounded-md px-4 shadow-none" onClick={() => { setError(null); setScannerOpen((open) => !open) }} variant="outline">{scannerOpen ? 'Close camera' : 'Scan QR'}</Button>
                      {scannerOpen ? <video className="scanner-video" muted playsInline ref={videoRef} /> : null}
                      <TextField id="qr-payload" label="Scanned QR candidate" onChange={(event) => { setIdentifier(event.target.value); retryRef.current = null }} value={identifier} />
                    </>
                  ) : (
                    <TextField id="order-reference" label="Printed Order reference" onChange={(event) => { setIdentifier(event.target.value); retryRef.current = null }} placeholder={selected.order.reference} value={identifier} />
                  )}

                  <p className="confirmation-note">Scanning or typing does not change custody. Confirm only after you physically receive this parcel from the Seller.</p>
                  <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!identifier.trim()} isLoading={busy === 'pickup'} loadingLabel="Confirming" onClick={() => void confirmPickup()} variant="secondary">Confirm pickup</Button>
                </div>
              ) : null}

              {confirmation ? (
                <div className="pickup-success" role="status">
                  <strong>Pickup confirmed</strong>
                  <span>{formatManila(confirmation.picked_up_at)} PHT · Order remains {confirmation.order_status.replaceAll('_', ' ')}</span>
                  <span>Next: Logistics receipt — N/A in this feature.</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
