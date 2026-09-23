import { useCallback, useEffect, useState } from 'react'
import { blob, csrf, request } from '../lib/api'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from '../components/PickupUi'

type Confirmation = {
  task_id: string
  task_revision: number
  shipment_id: string
  shipment_revision: number
  shipment_reference: string
  order: { id: string; reference: string; payment_method: string; payment_status: string }
  proof: { id: string; status: string; submitted_at: string | null }
  courier: { id: string; name: string }
  cod: { collected: boolean; declared_amount: string; currency: string; declared_at: string | null } | null
  intent: { id: string; status: string; confirmed_at: string; expected_revision: number }
}

function money(amount: string, currency: string) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(amount))
}

export function DeliveryConfirmationsPage() {
  const [rows, setRows] = useState<Confirmation[]>([])
  const [selected, setSelected] = useState<Confirmation | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [codConfirmed, setCodConfirmed] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (query) params.set('search', query)
      const response = await request<{ data: Confirmation[]; meta: { last_page: number } }>(`/api/v1/logistics/delivery-confirmations?${params}`)
      setRows(response.data)
      setLastPage(response.meta.last_page)
      setSelected((current) => current ? response.data.find((row) => row.task_id === current.task_id) ?? null : response.data[0] ?? null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load delivery confirmations.') }
  }, [page, query])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPhotoUrl(null); setCodConfirmed(false) }, [selected?.proof.id])
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  async function preview() {
    if (!selected) return
    setBusy(true); setError('')
    try { setPhotoUrl(URL.createObjectURL(await blob(`/api/v1/logistics/delivery-proofs/${selected.proof.id}/photo`))) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Photo unavailable. Refresh the queue.') }
    finally { setBusy(false) }
  }

  async function confirm() {
    if (!selected || (selected.cod && !codConfirmed) || !photoUrl) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/update-status/transitions', {
        method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ reference: selected.shipment_reference, target_state: 'delivered', expected_revision: selected.shipment_revision, evidence_id: selected.proof.id }),
      })
      setNotice(`Delivery ${selected.order.reference} confirmed.`)
      setSelected(null)
      await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Delivery confirmation failed. Refresh the queue.') }
    finally { setBusy(false) }
  }

  async function correction() {
    if (!selected || reason.trim().length < 3) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request(`/api/v1/logistics/delivery-proofs/${selected.proof.id}/reject`, {
        method: 'POST', body: JSON.stringify({ reason: reason.trim(), expected_revision: selected.task_revision }),
      })
      setNotice(`Correction requested for ${selected.order.reference}.`)
      setReason(''); setPhotoUrl(null); setSelected(null)
      await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Correction request failed. Refresh the queue.') }
    finally { setBusy(false) }
  }

  return <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Delivery confirmations</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review Courier proof and collected COD before finalizing delivery.</p></div><button className={field} onClick={() => void load()} type="button">Refresh</button></header>
    {error ? <ErrorNotice message={error} /> : null}{notice ? <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">{notice}</p> : null}
    <form className="flex max-w-xl gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()) }}><label className="sr-only" htmlFor="confirmation-search">Search Order reference</label><input className={`${field} min-w-0 flex-1`} id="confirmation-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search Order reference" value={search} /><button className={field} type="submit">Search</button></form>
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
      <section aria-label="Pending confirmations" className={`${panel} p-0`}><ul className="divide-y divide-zinc-200 dark:divide-white/10">{rows.map((row) => <li key={row.task_id}><button aria-current={selected?.task_id === row.task_id ? 'true' : undefined} className="w-full p-4 text-left hover:bg-zinc-50 aria-current:bg-purple-50 dark:hover:bg-white/[0.04] dark:aria-current:bg-white/[0.08]" onClick={() => { setSelected(row); setReason('') }} type="button"><span className="flex justify-between gap-3"><strong>{row.order.reference}</strong><span className="text-xs text-amber-700 dark:text-amber-300">Pending</span></span><span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">Courier: {row.courier.name || 'Unavailable'}</span><span className="mt-1 block text-sm">{row.cod ? `COD ${money(row.cod.declared_amount, row.cod.currency)}` : 'Prepaid'}</span></button></li>)}</ul>
        {rows.length === 0 ? <p className="p-4 text-sm text-zinc-500">No delivery confirmations are waiting.</p> : null}
        <div className="flex items-center justify-between border-t border-zinc-200 p-3 text-sm dark:border-white/10"><button className="underline disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button><span>Page {page} of {lastPage}</span><button className="underline disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage((current) => current + 1)} type="button">Next</button></div>
      </section>
      <section className={`${panel} space-y-4 p-4 sm:p-5`}>
        {!selected ? <p className="text-sm text-zinc-500">Select a pending confirmation.</p> : <>
          <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-zinc-500">Order</dt><dd className="mt-1 font-medium">{selected.order.reference}</dd></div><div><dt className="text-xs text-zinc-500">Courier</dt><dd className="mt-1">{selected.courier.name || 'Unavailable'}</dd></div><div><dt className="text-xs text-zinc-500">Intent submitted</dt><dd className="mt-1">{new Date(selected.intent.confirmed_at).toLocaleString('en-PH')}</dd></div><div><dt className="text-xs text-zinc-500">Proof</dt><dd className="mt-1">{selected.proof.status.replaceAll('_', ' ')}</dd></div></dl>
          <button className="text-sm font-medium text-[#4C1268] underline dark:text-purple-300" disabled={busy} onClick={() => void preview()} type="button">{photoUrl ? 'Reload private proof photo' : 'Preview private proof photo'}</button>
          {photoUrl ? <img alt={`Delivery proof for Order ${selected.order.reference}`} className="max-h-[28rem] max-w-full border border-zinc-200 object-contain dark:border-white/10" src={photoUrl} /> : null}
          {selected.cod ? <label className="flex items-start gap-2 border-y border-zinc-200 py-3 text-sm dark:border-white/10"><input checked={codConfirmed} className="mt-1 accent-[#E6007A]" onChange={(event) => setCodConfirmed(event.target.checked)} type="checkbox" /><span>Confirm the Courier collected {money(selected.cod.declared_amount, selected.cod.currency)} in cash from the customer.</span></label> : <p className="text-sm text-zinc-600 dark:text-zinc-400">This Order is not cash on delivery.</p>}
          <div className="flex flex-wrap gap-2"><PrimaryButton disabled={busy || !photoUrl || !!selected.cod && !codConfirmed} onClick={() => void confirm()}>{busy ? 'Saving…' : 'Confirm delivery'}</PrimaryButton></div>
          <div className="border-t border-zinc-200 pt-3 dark:border-white/10"><label className="block text-sm font-medium" htmlFor="correction-reason">Request correction</label><textarea className={`${field} mt-1 min-h-20 w-full`} id="correction-reason" maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Explain what the Courier needs to correct" value={reason} /><ActionButton disabled={busy || reason.trim().length < 3} onClick={() => void correction()}>Request correction</ActionButton></div>
        </>}
      </section>
    </div>
  </main>
}
