import { useCallback, useEffect, useState } from 'react'
import { FaArrowsRotate, FaMagnifyingGlass } from 'react-icons/fa6'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from '../components/PickupUi'
import { blob, csrf, request } from '../lib/api'

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

function submittedAt(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-zinc-200 pb-3 last:border-b-0 dark:border-white/10 sm:border-b-0 sm:pb-0">
    <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
  </div>
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
      setSelected((current) => current
        ? response.data.find((row) => row.task_id === current.task_id) ?? null
        : response.data[0] ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load delivery confirmations.')
    }
  }, [page, query])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPhotoUrl(null); setCodConfirmed(false) }, [selected?.proof.id])
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  async function preview() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      setPhotoUrl(URL.createObjectURL(await blob(`/api/v1/logistics/delivery-proofs/${selected.proof.id}/photo`)))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Photo unavailable. Refresh the queue.')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!selected || (selected.cod && !codConfirmed) || !photoUrl) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/update-status/transitions', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          reference: selected.shipment_reference,
          target_state: 'delivered',
          expected_revision: selected.shipment_revision,
          evidence_id: selected.proof.id,
        }),
      })
      setNotice(`Delivery ${selected.order.reference} confirmed.`)
      setSelected(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Delivery confirmation failed. Refresh the queue.')
    } finally {
      setBusy(false)
    }
  }

  async function correction() {
    if (!selected || reason.trim().length < 3) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await csrf()
      await request(`/api/v1/logistics/delivery-proofs/${selected.proof.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim(), expected_revision: selected.task_revision }),
      })
      setNotice(`Correction requested for ${selected.order.reference}.`)
      setReason('')
      setPhotoUrl(null)
      setSelected(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Correction request failed. Refresh the queue.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
    <header className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">Delivery confirmations</h2>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-600 dark:text-zinc-400">Review delivery proof and COD collection before completing an Order.</p>
      </div>
      <ActionButton aria-label="Refresh delivery confirmations" className="w-10 shrink-0 px-0 sm:w-auto sm:px-3" disabled={busy} onClick={() => void load()}>
        <FaArrowsRotate aria-hidden="true" />
        <span className="hidden sm:inline">Refresh</span>
      </ActionButton>
    </header>

    <form className="mt-4 grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:max-w-2xl" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()) }}>
      <label className="relative min-w-0" htmlFor="confirmation-search">
        <span className="sr-only">Search Order reference</span>
        <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-zinc-400" />
        <input className={`${field} min-w-0 pl-9`} id="confirmation-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search Order reference" value={search} />
      </label>
      <PrimaryButton className="w-auto shrink-0 px-4" type="submit">Search</PrimaryButton>
    </form>

    <div className="mt-4 space-y-3">
      {error ? <ErrorNotice message={error} /> : null}
      {notice ? <p className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}
    </div>

    <div className="mt-4 grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(19rem,25rem)_minmax(0,1fr)]">
      <section aria-label="Pending confirmations" className={`${panel} min-w-0 overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <h3 className="font-semibold">Pending review</h3>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{rows.length} on this page</span>
        </div>

        {rows.length > 0 ? <ul className="max-h-[22rem] divide-y divide-zinc-200 overflow-y-auto overscroll-contain dark:divide-white/10 sm:max-h-[28rem] xl:max-h-[calc(100vh-19rem)]">
          {rows.map((row) => <li key={row.task_id}>
            <button
              aria-current={selected?.task_id === row.task_id ? 'true' : undefined}
              className="grid w-full min-w-0 gap-2 border-l-2 border-transparent px-3 py-3 text-left transition-colors duration-150 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#4C1268] aria-current:border-l-[#4C1268] aria-current:bg-purple-50/70 dark:hover:bg-white/[0.04] dark:aria-current:bg-white/[0.07] sm:grid-cols-[minmax(0,1fr)_auto] sm:px-4"
              onClick={() => { setSelected(row); setReason('') }}
              type="button"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm">{row.order.reference}</strong>
                <span className="mt-1 block truncate text-sm text-zinc-600 dark:text-zinc-400">{row.courier.name || 'Courier unavailable'}</span>
              </span>
              <span className="text-left sm:text-right">
                <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">Pending</span>
                <span className="mt-1 block text-sm">{row.cod ? `COD ${money(row.cod.declared_amount, row.cod.currency)}` : 'Prepaid'}</span>
              </span>
            </button>
          </li>)}
        </ul> : <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{query ? `No pending confirmations match “${query}”.` : 'No delivery confirmations are waiting.'}</p>}

        <nav aria-label="Delivery confirmation pagination" className="flex items-center justify-between gap-3 border-t border-zinc-200 px-3 py-3 text-sm dark:border-white/10 sm:px-4">
          <button className="font-medium text-[#4C1268] disabled:cursor-not-allowed disabled:text-zinc-400 dark:text-purple-300 dark:disabled:text-zinc-600" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Page {page} of {lastPage}</span>
          <button className="font-medium text-[#4C1268] disabled:cursor-not-allowed disabled:text-zinc-400 dark:text-purple-300 dark:disabled:text-zinc-600" disabled={page >= lastPage} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
        </nav>
      </section>

      <section aria-label="Confirmation review" className={`${panel} min-w-0 overflow-hidden`}>
        {!selected ? <div className="px-4 py-10 text-center sm:px-6">
          <h3 className="font-semibold">No confirmation selected</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Select a pending Order to review its delivery proof.</p>
        </div> : <>
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-5">
            <h3 className="break-words font-semibold">Review {selected.order.reference}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Verify the private proof before confirming delivery.</p>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <dl className="grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4">
              <DetailItem label="Order" value={selected.order.reference} />
              <DetailItem label="Courier" value={selected.courier.name || 'Unavailable'} />
              <DetailItem label="Intent submitted" value={submittedAt(selected.intent.confirmed_at)} />
              <DetailItem label="Proof status" value={selected.proof.status.replaceAll('_', ' ')} />
            </dl>

            <div className="border-t border-zinc-200 pt-4 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">Delivery proof</h4>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Private image submitted by the Courier.</p>
                </div>
                <ActionButton busy={busy} className="w-full sm:w-auto" onClick={() => void preview()} type="button">{photoUrl ? 'Reload photo' : 'Load photo'}</ActionButton>
              </div>
              {photoUrl ? <div className="mt-3 grid min-h-48 place-items-center overflow-hidden border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-black/20 sm:min-h-64">
                <img alt={`Delivery proof for Order ${selected.order.reference}`} className="max-h-[32rem] w-full object-contain" src={photoUrl} />
              </div> : <div className="mt-3 grid min-h-40 place-items-center border border-dashed border-zinc-300 px-4 text-center dark:border-white/15">
                <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">Load the private photo to inspect the delivery evidence.</p>
              </div>}
            </div>

            {selected.cod ? <label className="flex items-start gap-3 border-y border-zinc-200 py-4 text-sm leading-5 dark:border-white/10">
              <input checked={codConfirmed} className="mt-0.5 size-4 shrink-0 accent-[#E6007A]" onChange={(event) => setCodConfirmed(event.target.checked)} type="checkbox" />
              <span>Confirm the Courier collected <strong>{money(selected.cod.declared_amount, selected.cod.currency)}</strong> in cash from the customer.</span>
            </label> : <p className="border-y border-zinc-200 py-4 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">This Order is prepaid. No cash collection confirmation is required.</p>}

            <PrimaryButton className="w-full sm:w-auto" disabled={busy || !photoUrl || !!selected.cod && !codConfirmed} onClick={() => void confirm()}>{busy ? 'Saving…' : 'Confirm delivery'}</PrimaryButton>

            <div className="border-t border-zinc-200 pt-4 dark:border-white/10">
              <label className="block text-sm font-medium" htmlFor="correction-reason">Request correction</label>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Tell the Courier what must be resubmitted.</p>
              <textarea className={`${field} mt-2 min-h-24 w-full resize-y py-2`} id="correction-reason" maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Describe the issue with the proof" value={reason} />
              <ActionButton className="mt-2 w-full sm:w-auto" disabled={busy || reason.trim().length < 3} onClick={() => void correction()}>Request correction</ActionButton>
            </div>
          </div>
        </>}
      </section>
    </div>
  </main>
}
