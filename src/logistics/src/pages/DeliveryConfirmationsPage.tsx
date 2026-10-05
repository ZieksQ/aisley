import { useEffect, useState } from 'react'
import { Button } from '@aisley/ui'
import { ErrorNotice, field } from '../components/PickupUi'
import { ApprovalSettings } from '../features/deliveryReview/ApprovalSettings'
import type { ReviewView } from '../features/deliveryReview/api'
import { ReviewWorkspace } from '../features/deliveryReview/ReviewWorkspace'
import { useDeliveryReview } from '../features/deliveryReview/useDeliveryReview'
import { date, workflowButton, workspace } from '../features/logisticsFinance/presentation'

function ReviewQueue({ view, onLock }: { view: 'pending' | 'history'; onLock: (locked: boolean) => void }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const state = useDeliveryReview(view, query, page)
  useEffect(() => {
    onLock(state.locked);
    return () => onLock(false)
  }, [state.locked, onLock])
  const unlocked = !state.locked
  return <>
    <form
      className="mt-5 flex max-w-2xl items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setPage(1);
        setQuery(search.trim())
      }}
    >
      <label className="min-w-0 flex-1 text-sm font-medium">Search Order reference<input
        className={`${field} mt-2`}
        maxLength={120}
        value={search}
        disabled={!unlocked}
        onChange={(event) => setSearch(event.target.value)}
      /></label>
      <Button className={workflowButton} variant="outline" type="submit" disabled={!unlocked}>Search</Button>
      <Button
        className={workflowButton}
        variant="outline"
        disabled={state.busy || state.loading}
        onClick={() => {
          void state.load()
        }}
      >Refresh</Button>
    </form>
    {state.error && <div className="mt-4">
      <ErrorNotice message={state.error} retry={() => {
        void state.load()
      }} />
    </div>}
    {state.notice && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
      {state.notice}
    </p>}
    {state.attempt && <div
      role="status"
      className="mt-4 flex flex-wrap items-center gap-3 border border-amber-300 p-3 text-sm dark:border-amber-700"
    >
      <p>
        {state.busy ? 'Submitting decision…' : 'The decision result is uncertain. Refresh to check or retry the same action.'}
      </p>
      {!state.busy && <Button className={workflowButton} variant="outline" onClick={() => {
        void state.run(state.attempt!)
      }}>Retry same action</Button>}
    </div>}
    {state.loading ? <p role="status" className="py-8 text-sm">Loading delivery reviews…</p> : <>
      <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">{state.total} {view === 'history' ? 'reviewed proofs' : 'pending reviews'}</p>
      <div className="mt-3 grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <section aria-label="Delivery review queue" className="min-w-0 border border-zinc-200 dark:border-white/10">
          {state.rows.length ? <ul className="max-h-[30rem] divide-y divide-zinc-200 overflow-y-auto dark:divide-white/10">
            {state.rows.map((row) => <li key={row.proof.id}>
              <button
                type="button"
                disabled={!unlocked}
                aria-current={state.selected?.proof.id === row.proof.id ? 'true' : undefined}
                className="w-full p-4 text-left hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 aria-[current=true]:bg-purple-50 disabled:opacity-60 dark:hover:bg-white/5 dark:aria-[current=true]:bg-white/10"
                onClick={() => state.select(row.proof.id)}
              >
                <strong className="block break-words text-sm">
                  {row.order.reference}
                </strong>
                <span className="mt-1 block text-sm">{row.courier.name || 'Courier'} · {row.order.payment_method === 'cod' ? 'COD' : 'Prepaid'}</span>
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{view === 'history' ? (row.proof.status === 'validated' ? 'Approved' : 'Correction requested') : 'Pending'} · {date(row.proof.submitted_at)}</span>
              </button>
            </li>)}
          </ul> : !state.error && <p className="p-6 text-sm">
            {query ? 'No reviews match this Order reference.' : view === 'pending' ? 'No deliveries are waiting for review.' : 'No delivery review history yet.'}
          </p>}
          <nav
            className="flex items-center justify-between gap-2 border-t border-zinc-200 p-3 dark:border-white/10"
            aria-label="Review pagination"
          >
            <Button
              className={workflowButton}
              variant="outline"
              disabled={!unlocked || page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >Previous</Button>
            <span className="text-xs">{page} / {state.lastPage}</span>
            <Button
              className={workflowButton}
              variant="outline"
              disabled={!unlocked || page >= state.lastPage}
              onClick={() => setPage((value) => value + 1)}
            >Next</Button>
          </nav>
        </section>
        <ReviewWorkspace key={state.selected?.proof.id ?? 'empty'} state={state} history={view === 'history'} />
      </div>
    </>}
  </>
}

export function DeliveryConfirmationsPage() {
  const [view, setView] = useState<ReviewView>('pending')
  const [locked, setLocked] = useState(false)
  return <main className={workspace}>
    <header className="border-b border-zinc-200 pb-4 dark:border-white/10">
      <h2 className="text-xl font-semibold">Delivery confirmations</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review proof of delivery and COD collection.</p>
    </header>
    <nav
      aria-label="Delivery confirmation views"
      className="mt-4 flex flex-wrap gap-5 border-b border-zinc-200 dark:border-white/10"
    >
      {(['pending', 'history', 'settings'] as const).map((item) => <button
        key={item}
        type="button"
        disabled={locked}
        aria-current={view === item ? 'page' : undefined}
        className="border-b-2 border-transparent py-3 text-sm font-medium aria-[current=page]:border-[#4C1268] aria-[current=page]:text-[#4C1268] disabled:opacity-50 dark:aria-[current=page]:border-purple-300 dark:aria-[current=page]:text-purple-300"
        onClick={() => setView(item)}
      >
        {item === 'pending' ? 'Pending' : item === 'history' ? 'History' : 'Approval settings'}
      </button>)}
    </nav>
    {view === 'settings' ? <ApprovalSettings /> : <ReviewQueue key={view} view={view} onLock={setLocked} />}
  </main>
}
