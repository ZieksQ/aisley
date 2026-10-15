import { DashboardMetricCard, PortalSkeleton } from '@aisley/ui/portal'
import { useEffect, useState } from 'react'
import { FaClock, FaRotateRight } from 'react-icons/fa6'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { OrderButton, OrderError } from '../components/orders/OrderUi'
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
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>(
    `/api/v1/seller/orders?status=placed&sort=oldest&per_page=20&page=${page}`,
  )

  useEffect(() => { document.title = 'Order approval | Aisley Seller' }, [])
  useEffect(() => {
    if (!state?.decision) return
    setDecisionMessage(`${state.reference ? `${state.reference} was` : 'The order was'} ${state.decision} and removed from this queue.`)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.pathname, location.search, navigate, state?.decision, state?.reference])

  function changePage(nextPage: number) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage > 1) next.set('page', String(nextPage))
      else next.delete('page')
      return next
    })
  }

  return (
    <main className="portal-page seller-order-workspace">
      <header className="portal-page-header">
        <div>
          <h1 className="portal-page-heading">Order approval</h1>
          <p className="portal-page-description">Review new COD orders, starting with the oldest.</p>
        </div>
        <OrderButton isLoading={loading} loadingLabel="Refreshing…" onClick={refresh}>
          <FaRotateRight aria-hidden="true" />Refresh
        </OrderButton>
      </header>
      {decisionMessage && <p className="portal-feedback" role="status">{decisionMessage}</p>}
      <section className="mb-6 grid items-stretch gap-4 md:grid-cols-[minmax(14rem,1fr)_2fr]" aria-label="Approval summary">
        <DashboardMetricCard label="Awaiting your decision" value={data?.meta.total ?? '—'}
          icon={<FaClock />} detail="New orders ready for review." />
        <aside className="order-surface flex flex-col justify-center p-4">
          <h2 className="text-sm font-semibold">Before you approve</h2>
          <p className="portal-secondary mt-2 max-w-[65ch] text-sm leading-6">
            Check the purchased items, COD state, and delivery address. Approval starts preparation
            and closes the customer’s normal cancellation window. Rejection releases reserved inventory.
          </p>
        </aside>
      </section>
      <section className="order-surface order-table-wrap overflow-hidden" aria-labelledby="approval-queue-title" aria-busy={loading}>
        <div className="order-section-heading">
          <h2 id="approval-queue-title">Waiting orders</h2>
          <p>Oldest first</p>
        </div>
        {error && <div className="px-4"><OrderError message={error} retry={refresh} /></div>}
        {!data && loading ? <PortalSkeleton label="Loading orders awaiting approval" rows={5} /> : data ? (
          <>
            <OrdersTable approval orders={data.data} empty="No orders are waiting for approval." />
            <OrderPagination currentPage={data.meta.current_page} lastPage={data.meta.last_page}
              onPage={changePage} total={data.meta.total} disabled={loading} />
          </>
        ) : null}
      </section>
    </main>
  )
}
