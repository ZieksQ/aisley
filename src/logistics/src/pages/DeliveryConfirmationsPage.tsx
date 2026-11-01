import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  PortalButton,
  PortalPagination,
  PortalSkeleton,
  PortalState,
  PortalTable
} from '@aisley/ui/portal'
import { ErrorNotice } from '../components/PickupUi'
import { ApprovalSettings } from '../features/deliveryReview/ApprovalSettings'
import { useDeliveryReview } from '../features/deliveryReview/useDeliveryReview'
import { date } from '../features/logisticsFinance/presentation'
import '../features/transport.css'

function ReviewQueue({ view }: { view: 'pending' | 'history' }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const query = params.get('search') ?? ''
  const [search, setSearch] = useState(query)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const state = useDeliveryReview(view, query, page)
  function filter(nextPage: number, nextSearch = query) {
    setParams({
      view,
      ...(nextSearch ? { search: nextSearch } : {}),
      page: String(nextPage)
    })
  }
  return (
    <section className="transport-panel" aria-label="Delivery review queue">
      <form
        className="transport-toolbar"
        onSubmit={(event) => {
          event.preventDefault()
          filter(1, search.trim())
        }}
      >
        <label>
          Search Order reference
          <input
            className="portal-input"
            type="search"
            maxLength={120}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <PortalButton type="submit">Search</PortalButton>
        <PortalButton
          disabled={state.loading}
          onClick={() => void state.load()}
        >
          Refresh
        </PortalButton>
      </form>
      {state.error && (
        <ErrorNotice message={state.error} retry={() => void state.load()} />
      )}
      {state.loading ? (
        <PortalSkeleton label="Loading delivery reviews" />
      ) : state.rows.length ? (
        <PortalTable
          label={
            view === 'history'
              ? 'Delivery confirmation history'
              : 'Pending delivery confirmations'
          }
        >
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Courier</th>
              <th scope="col">Payment</th>
              <th scope="col">Submitted</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => {
              const url = `/delivery-confirmations/${encodeURIComponent(row.proof.id)}?${new URLSearchParams({ view, reference: row.order.reference, return: params.toString() })}`
              const status =
                row.proof.status === 'validated'
                  ? 'Approved'
                  : row.proof.status === 'rejected'
                    ? 'Correction requested'
                    : 'Pending review'
              return (
                <tr
                  key={row.proof.id}
                  data-href={url}
                  onClick={(event) => {
                    if (
                      !(event.target as HTMLElement).closest('a') &&
                      !window.getSelection()?.toString()
                    )
                      navigate(url)
                  }}
                >
                  <td>
                    <Link to={url}>
                      {row.order.reference}
                      <span className="sr-only"> — view delivery details</span>
                    </Link>
                  </td>
                  <td>{row.courier.name || 'Courier'}</td>
                  <td>
                    {row.order.payment_method === 'cod'
                      ? 'Cash on delivery'
                      : 'Prepaid'}
                  </td>
                  <td>{date(row.proof.submitted_at)}</td>
                  <td>
                    <span
                      className="transport-status"
                      data-state={row.proof.status}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </PortalTable>
      ) : (
        !state.error && (
          <PortalState
            title={
              query
                ? 'No matching delivery reviews'
                : view === 'pending'
                  ? 'No deliveries waiting for review'
                  : 'No delivery review history yet'
            }
            description={
              query
                ? 'Try another Order reference.'
                : view === 'pending'
                  ? 'Submitted delivery proofs will appear here for your review.'
                  : 'Approved deliveries and correction requests will appear here.'
            }
          />
        )
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--portal-border)] px-4">
        <p className="portal-secondary py-4 text-sm">
          {state.total}{' '}
          {view === 'history' ? 'reviewed proofs' : 'pending reviews'}
        </p>
        <PortalPagination
          page={page}
          lastPage={state.lastPage}
          disabled={state.loading}
          onPage={filter}
        />
      </div>
    </section>
  )
}

export function DeliveryConfirmationsPage() {
  const [params] = useSearchParams()
  const view =
    params.get('view') === 'history'
      ? 'history'
      : params.get('view') === 'settings'
        ? 'settings'
        : 'pending'
  useEffect(() => {
    document.title = 'Delivery confirmations | Aisley Logistics'
  }, [])
  return (
    <div className="transport-workspace">
      <header className="transport-heading">
        <div>
          <h1>Delivery confirmations</h1>
          <p>
            Review delivery evidence, confirm collection, and track decisions.
          </p>
        </div>
      </header>
      <nav className="transport-tabs" aria-label="Delivery confirmation views">
        {(['pending', 'history', 'settings'] as const).map((item) => (
          <Link
            key={item}
            to={`?view=${item}`}
            aria-current={view === item ? 'page' : undefined}
          >
            {item === 'pending'
              ? 'Pending'
              : item === 'history'
                ? 'History'
                : 'Approval settings'}
          </Link>
        ))}
      </nav>
      {view === 'settings' ? (
        <ApprovalSettings />
      ) : (
        <ReviewQueue
          key={`${view}:${params.get('search') ?? ''}`}
          view={view}
        />
      )}
    </div>
  )
}
