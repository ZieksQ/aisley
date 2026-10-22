import { Button } from '@aisley/ui'
import { useCallback, useEffect, useState } from 'react'
import { FinalMileRouteMap } from './FinalMileRouteMap'
import { request } from './lib/api'
import type { FinalMileBatch } from './finalMileTypes'

export function FinalMileBatches({ token, revision, onSelect, disabled }: { token: string; revision: number; onSelect: (id: string) => void; disabled: boolean }) {
  const [batches, setBatches] = useState<FinalMileBatch[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await request<{ data: FinalMileBatch[] }>('/api/v1/courier/final-mile-batches', {}, token)
      setBatches(result.data)
      setSelected((current) => result.data.some((batch) => batch.id === current) ? current : result.data[0]?.id ?? null)
    } catch (caught) {
      setBatches([])
      setError(caught instanceof Error ? caught.message : 'Dispatches could not be loaded.')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { void load() }, [load, revision])
  const batch = batches.find((item) => item.id === selected)

  return (
    <section className="route-manifest" aria-labelledby="final-mile-batches-heading">
      <div className="route-manifest-header">
        <div>
          <h3 id="final-mile-batches-heading">Assigned delivery parcels</h3>
          <p>Review and accept or reject each parcel before delivery.</p>
        </div>
        <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={disabled || loading} onClick={() => void load()} variant="outline">Refresh dispatches</Button>
      </div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {loading ? <p role="status">Loading dispatches…</p> : null}
      {!loading && batches.length === 0 ? <p className="empty-state">No delivery parcels assigned.</p> : null}
      {batches.length > 0 ? <>
        <label htmlFor="final-mile-batch-select">Dispatch</label>
        <select disabled={disabled || loading} id="final-mile-batch-select" onChange={(event) => setSelected(event.target.value)} value={selected ?? ''}>
          {batches.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.parcel_count} parcels</option>)}
        </select>
        {batch ? <>
          <p className="status-line">Scheduled {new Date(batch.scheduled_for).toLocaleString('en-PH')}</p>
          <ol className="route-stop-list" aria-label="Parcels in this dispatch">
            {batch.tasks.map((task, index) => <li key={task.task_id}>
              <span className="stop-sequence">{index + 1}</span>
              <span><strong>{task.parcel?.reference ?? task.order?.reference ?? 'Parcel'}</strong><br />{[task.destination_area?.city_municipality, task.destination_area?.province].filter(Boolean).join(', ') || 'Destination area unavailable'}<br />{task.status.replaceAll('_', ' ')}</span>
              <Button className="col-start-2 min-h-10 justify-self-start rounded-md px-4 shadow-none" disabled={disabled || loading} onClick={() => onSelect(task.task_id)} variant="outline">Review parcel</Button>
            </li>)}
          </ol>
          {batch.tasks.some((task) => task.accepted_at !== null) ? <FinalMileRouteMap key={`${batch.id}:${revision}`} scheduleId={batch.id} token={token} /> : null}
        </> : null}
      </> : null}
    </section>
  )
}
