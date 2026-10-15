import { useEffect, useState } from 'react'
import { FaClock } from 'react-icons/fa6'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { OrderButton, OrderError, orderPanel } from '../components/orders/OrderUi'
import { OrderPagination, OrdersTable } from '../components/orders/OrdersTable'
import { useSellerOrders } from '../lib/useSellerOrders'
import type { SellerOrderPage } from '../types/orders'

type ApprovalLocationState = { decision?: 'approved' | 'rejected'; reference?: string } | null

export function OrderApprovalPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ApprovalLocationState
  const [decisionMessage, setDecisionMessage] = useState('')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>(`/api/v1/seller/orders?status=placed&sort=oldest&per_page=20&page=${page}`)

  useEffect(() => { document.title = 'Order approval | Aisley Seller' }, [])
  useEffect(() => {
    if (!state?.decision) return
    setDecisionMessage(`${state.reference ? `${state.reference} was` : 'The order was'} ${state.decision} and removed from this queue.`)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, state?.decision, state?.reference])

  function changePage(nextPage: number) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage > 1) next.set('page', String(nextPage))
      else next.delete('page')
      return next
    })
  }

  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
      <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4C1268] dark:text-purple-300">Orders</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Order approval</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Review new COD orders in the order they arrived. Approval starts preparation; rejection releases the order’s inventory reservation.</p></div>
      <OrderButton isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>Refresh</OrderButton>
    </header>

    {decisionMessage && <p className="mt-5 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-400/25 dark:bg-green-400/10 dark:text-green-100" role="status">{decisionMessage}</p>}

    <section className="mt-6 grid gap-4 md:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
      <article className={`${orderPanel} flex items-center gap-4 p-5`}>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#F1EAF4] text-lg text-[#4C1268] dark:bg-purple-300/10 dark:text-purple-200"><FaClock aria-hidden="true" /></span>
        <div><p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Awaiting your decision</p><p className="mt-1 text-2xl font-semibold tabular-nums">{data?.meta.total ?? '—'}</p></div>
      </article>
      <aside className="rounded-xl border border-[#D9C6E2] bg-[#F7F1FA] p-5 dark:border-purple-300/20 dark:bg-purple-300/5">
        <h2 className="font-semibold text-[#3D0E54] dark:text-purple-100">Review before deciding</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">Check the purchased item snapshot, COD payment state, and delivery address. The approval action closes the customer’s normal cancellation window.</p>
      </aside>
    </section>

    <section className="mt-8" aria-labelledby="approval-queue-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold" id="approval-queue-title">Waiting orders</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Oldest orders appear first.</p></div></div>
      {error && <OrderError message={error} retry={refresh} />}
      {!data && loading ? <div aria-label="Loading orders awaiting approval" className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" role="status"><span className="sr-only">Loading orders awaiting approval…</span></div> : data ? <>
        <OrdersTable approval orders={data.data} empty="No orders are waiting for approval." />
        {data.meta.last_page > 1 && <OrderPagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} onPage={changePage} total={data.meta.total} />}
      </> : null}
    </section>
  </main>
}
