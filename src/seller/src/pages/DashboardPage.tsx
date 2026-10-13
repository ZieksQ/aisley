import { DashboardSkeleton } from '@aisley/ui/portal'
import { OrderActivityOverview } from '../components/dashboard/OrderActivityOverview'
import { useEffect, useState } from 'react'
import {
  FaCircleExclamation,
  FaRotateRight,
  FaStore,
} from 'react-icons/fa6'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { CatalogSummary } from '../components/dashboard/CatalogSummary'
import { DashboardReviews } from '../components/dashboard/DashboardReviews'
import { fetchSellerDashboard, type DashboardPeriodFilter } from '../lib/dashboard'
import type { DashboardResponse } from '../types/dashboard'
import { DashboardOrders } from '../components/orders/DashboardOrders'

export function DashboardPage() {
  const { seller } = useAuth()
  return seller ? <DashboardOverview key={seller.id} /> : null
}

function DashboardOverview() {
  const { seller, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const timezone = searchParams.get('timezone') ?? ''
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Dashboard | Aisley Seller'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    fetchSellerDashboard({ from, to, timezone }, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setDashboard(response) })
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) return

        if (caughtError instanceof ApiError && caughtError.code === 'POLICY_CONSENT_REQUIRED') {
          navigate('/policy-consent', { replace: true, state: { from: '/dashboard' } })
          return
        }

        if (caughtError instanceof ApiError && [401, 403, 419].includes(caughtError.status)) {
          void logout()
            .catch(() => undefined)
            .finally(() => navigate('/login', {
              replace: true,
              state: { notice: caughtError.message },
            }))
          return
        }

        setError(caughtError instanceof ApiError && caughtError.status === 422
          ? 'The review date range or time zone is invalid. Clear the filter and try again.'
          : 'We could not load your dashboard. Check the API connection and try again.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [from, logout, navigate, reloadKey, timezone, to])

  function changePeriod(filters: DashboardPeriodFilter) {
    const next = new URLSearchParams()
    if (filters.from && filters.to) {
      next.set('from', filters.from)
      next.set('to', filters.to)
      next.set('timezone', filters.timezone)
    }
    setSearchParams(next)
  }

  const firstName = seller?.profile?.first_name ?? 'Seller'

  return (
    <div className="portal-page dashboard-page">
      <div className="dashboard-heading">
        <div>
          <h2 className="portal-page-heading">{firstName}’s dashboard</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review orders, prepare pickups, and keep your catalog up to date.</p>
        </div>
        <div className="dashboard-heading-actions">
          {dashboard ? <p className="text-xs portal-secondary">{error ? 'Last loaded' : 'Updated'} {formatTimestamp(dashboard.generated_at)}</p> : null}
          <button
            className="portal-button"
            disabled={isLoading}
            onClick={() => setReloadKey((value) => value + 1)}
            type="button"
          >
            <FaRotateRight aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {isLoading && !dashboard ? <DashboardSkeleton className="mt-6" /> : null}
      {isLoading && dashboard ? <p className="sr-only" role="status">Refreshing dashboard…</p> : null}

      {!isLoading && error ? (
        <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-400/20 dark:bg-red-400/10" role="alert">
          <div className="flex gap-3">
            <FaCircleExclamation aria-hidden="true" className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">{dashboard ? 'Showing the last loaded dashboard' : 'Dashboard unavailable'}</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-3.5 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-400/30 dark:bg-transparent dark:text-red-200 dark:hover:bg-white/10"
              onClick={() => setReloadKey((value) => value + 1)}
              type="button"
            >
              <FaRotateRight aria-hidden="true" /> Try again
            </button>
            {from || to || timezone ? <button className="px-3 text-sm font-medium text-red-800 underline dark:text-red-200" onClick={() => changePeriod({ from: '', to: '', timezone: 'UTC' })} type="button">Clear filter</button> : null}
          </div>
        </section>
      ) : null}

      {dashboard?.code === 'SHOP_SETUP_REQUIRED' ? (
        <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-400/25 dark:bg-amber-400/10">
          <div className="flex gap-3">
            <FaStore aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <h3 className="font-semibold">Shop setup is required</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                Your Seller account is active. A Shop must be connected before you can manage its catalog and orders.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {dashboard?.shop && 'metrics' in dashboard.sections.catalog ? (
        <>
          <OrderActivityOverview activity={dashboard.sections.order_activity} />
          <DashboardOrders key={reloadKey} />
          <section className="overflow-hidden rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)]" aria-labelledby="shop-catalog-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="font-semibold" id="shop-catalog-heading">{dashboard.shop.name}</h3>
                <p className="mt-1 text-sm portal-secondary">Catalog summary</p>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Shop status: <span className="font-medium capitalize">{dashboard.shop.status}</span>{dashboard.shop.is_on_vacation ? ' · Vacation mode' : ''}
              </p>
            </div>
            <CatalogSummary catalog={dashboard.sections.catalog} />
          </section>

          <DashboardReviews
            onPeriodChange={changePeriod}
            onRefresh={() => setReloadKey((value) => value + 1)}
            period={dashboard.period}
            refreshing={isLoading}
            section={dashboard.sections.reviews}
          />
        </>
      ) : null}
    </div>
  )
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
