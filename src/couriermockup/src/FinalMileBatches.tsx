import { Button } from '@aisley/ui'
import { useCallback, useEffect, useState } from 'react'
import { FinalMileRouteMap } from './FinalMileRouteMap'
import { request } from './lib/api'
import type { FinalMileBatch } from './finalMileTypes'

export function FinalMileBatches({ token, onAccepted }: { token: string; onAccepted: () => void }) {
  const [batches, setBatches] = useState<FinalMileBatch[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const result = await request<{ data: FinalMileBatch[] }>('/api/v1/courier/final-mile-batches', {}, token)
      setBatches(result.data)
      setSelected((current) => result.data.some((batch) => batch.id === current) ? current : result.data[0]?.id ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dispatches could not be loaded.')
    }
  }, [token])

  useEffect(() => { void load() }, [load])
  const batch = batches.find((item) => item.id === selected)
  async function accept() {
    if (!batch || busy || !window.confirm(`Accept all ${batch.parcel_count} parcels in ${batch.reference}?`)) return
    setBusy(true)
    setError(null)
    try {
      await request(`/api/v1/courier/final-mile-batches/${batch.id}/accept`, { method: 'POST', body: JSON.stringify({}) }, token)
      await load()
      onAccepted()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Batch acceptance failed. Refresh and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="route-manifest" aria-labelledby="final-mile-batches-heading">
      <div className="route-manifest-header">
        <div>
          <h3 id="final-mile-batches-heading">Assigned delivery batches</h3>
          <p>Accept the full dispatch before hub pickup.</p>
        </div>
        <Button className="min-h-10 rounded-md px-4 shadow-none" onClick={() => void load()} variant="outline">Refresh batches</Button>
      </div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {batches.length === 0 ? <p className="empty-state">No delivery batches assigned.</p> : (
        <>
          <label htmlFor="final-mile-batch-select">Dispatch</label>
          <select id="final-mile-batch-select" onChange={(event) => setSelected(event.target.value)} value={selected ?? ''}>
            {batches.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.parcel_count} parcels</option>)}
          </select>
          {batch ? (
            <>
              <p className="status-line">Scheduled {new Date(batch.scheduled_for).toLocaleString('en-PH')} · {batch.status.replaceAll('_', ' ')}</p>
              {batch.status === 'offered' ? (
                <>
                  <ol className="route-stop-list" aria-label="Destination areas in this offer">
                    {batch.tasks.map((task, index) => <li key={task.task_id}>
                      <span className="stop-sequence">{index + 1}</span>
                      <span><strong>{[task.destination_area?.city_municipality, task.destination_area?.province].filter(Boolean).join(', ') || 'Destination area unavailable'}</strong></span>
                    </li>)}
                  </ol>
                  <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={busy} onClick={() => void accept()} variant="secondary">Accept all {batch.parcel_count} deliveries</Button>
                </>
              ) : <FinalMileRouteMap scheduleId={batch.id} token={token} />}
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
