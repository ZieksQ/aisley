import { Button, TextField } from '@aisley/ui'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, request } from './lib/api'
import type { FinalMileTask } from './finalMileTypes'

export function DeliveryHistory({ token }: { token: string }) {
  const [rows, setRows] = useState<FinalMileTask[]>([])
  const [reference, setReference] = useState('')
  const [selected, setSelected] = useState<FinalMileTask | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (filter = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (filter.trim()) params.set('reference', filter.trim())
      const response = await request<{ data: FinalMileTask[]; meta: { has_more: boolean; next_cursor: null } }>(`/api/v1/courier/delivery-history?${params}`, {}, token)
      setRows(response.data)
      setHasMore(response.meta.has_more)
      setSelected(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load delivery history. Retry when connected.')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { void load() }, [load])

  async function select(taskId: string) {
    setError(null)
    try {
      const response = await request<{ data: FinalMileTask }>(`/api/v1/courier/delivery-history/${taskId}`, {}, token)
      setSelected(response.data)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load this delivery. Retry when connected.')
    }
  }

  return <section className="history-section" aria-labelledby="delivery-history-heading">
    <div className="pickup-toolbar"><div><h3 id="delivery-history-heading">Delivery history</h3><p className="panel-description">Completed deliveries from the API.</p></div><Button className="min-h-10 rounded-md px-4 shadow-none" isLoading={loading} onClick={() => void load(reference)} variant="outline">Refresh history</Button></div>
    <form className="history-filter" onSubmit={(event) => { event.preventDefault(); void load(reference) }}>
      <TextField id="history-reference" label="Exact Order reference (optional)" onChange={(event) => setReference(event.target.value)} value={reference} />
      <Button className="min-h-10 rounded-md px-4 shadow-none" type="submit" variant="outline">Search</Button>
    </form>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {!loading && rows.length === 0 && !error ? <p className="empty-state">No delivered tasks match this search.</p> : null}
    {rows.length > 0 ? <ul className="history-list">{rows.map((row) => <li key={row.task_id}>
      <button aria-current={selected?.task_id === row.task_id ? 'true' : undefined} className="task-row" onClick={() => void select(row.task_id)} type="button"><span><strong>{row.order?.reference ?? 'Delivery'}</strong><span>{row.destination_area?.city_municipality ?? 'Destination unavailable'}</span></span><span>{row.delivered_at ? new Date(row.delivered_at).toLocaleDateString('en-PH') : 'Delivered'}</span></button>
    </li>)}</ul> : null}
    {hasMore ? <p className="confirmation-note">Only the first 50 deliveries are available; the API does not provide a next-page cursor yet. Search by exact Order reference.</p> : null}
    {selected ? <dl className="task-facts history-detail">
      <div><dt>Order</dt><dd>{selected.order?.reference ?? '—'}</dd></div>
      <div><dt>Waybill</dt><dd>{selected.waybill?.reference ?? '—'}</dd></div>
      <div><dt>Delivered</dt><dd>{selected.delivered_at ? new Date(selected.delivered_at).toLocaleString('en-PH') : '—'}</dd></div>
      <div><dt>Proof</dt><dd>{selected.evidence_status.replaceAll('_', ' ')}</dd></div>
      <div><dt>Completion</dt><dd>{selected.completion_status?.replaceAll('_', ' ') ?? '—'}</dd></div>
    </dl> : null}
  </section>
}
