import { useEffect, useState } from 'react'
import {
  FaBox,
  FaChartLine,
  FaCircleExclamation,
  FaClipboardList,
  FaCommentDots,
  FaCubes,
  FaRotateRight,
  FaStore,
  FaWallet,
} from 'react-icons/fa6'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from '../lib/api'
import type { CatalogSection, DashboardResponse } from '../types/dashboard'

const deferredSections = [
  { key: 'financial', name: 'Financial summary', detail: 'Waiting for Orders, payments, fees, refunds, and settlement definitions.', icon: FaWallet },
  { key: 'orders', name: 'Order workload', detail: 'Waiting for the canonical Order lifecycle and Seller fulfillment states.', icon: FaClipboardList },
  { key: 'inventory', name: 'Inventory attention', detail: 'Waiting for inventory movements, reservations, and low-stock rules.', icon: FaCubes },
  { key: 'reviews', name: 'Review summary', detail: 'Waiting for verified Reviews and Seller response rules.', icon: FaCommentDots },
  { key: 'traffic', name: 'Traffic and conversion', detail: 'Waiting for Seller-scoped analytics event definitions.', icon: FaChartLine },
  { key: 'notifications', name: 'Notifications', detail: 'Waiting for the shared persisted notification domain.', icon: FaCircleExclamation },
] as const

export function DashboardPage() {
  const { seller, logout } = useAuth()
  const navigate = useNavigate()
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

    apiRequest<DashboardResponse>('/api/v1/seller/dashboard', { signal: controller.signal })
      .then(setDashboard)
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) return

        if (caughtError instanceof ApiError && [401, 403].includes(caughtError.status)) {
          void logout()
            .catch(() => undefined)
            .finally(() => navigate('/login', {
              replace: true,
              state: { notice: caughtError.message },
            }))
          return
        }

        setError('We could not load your dashboard. Check the API connection and try again.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [logout, navigate, reloadKey])

  const firstName = seller?.profile?.first_name ?? 'Seller'

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-5 dark:border-white/10">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome, {firstName}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Current shop and catalog status from your Seller account.</p>
        </div>
        {dashboard ? <p className="text-xs text-zinc-500">Updated {formatTimestamp(dashboard.generated_at)}</p> : null}
      </div>

      {isLoading ? <DashboardSkeleton /> : null}

      {!isLoading && error ? (
        <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-400/20 dark:bg-red-400/10" role="alert">
          <div className="flex gap-3">
            <FaCircleExclamation aria-hidden="true" className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Dashboard unavailable</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
          <button
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-3.5 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-400/30 dark:bg-transparent dark:text-red-200 dark:hover:bg-white/10"
            onClick={() => setReloadKey((value) => value + 1)}
            type="button"
          >
            <FaRotateRight aria-hidden="true" />
            Try again
          </button>
        </section>
      ) : null}

      {!isLoading && dashboard?.code === 'SHOP_SETUP_REQUIRED' ? (
        <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-400/25 dark:bg-amber-400/10">
          <div className="flex gap-3">
            <FaStore aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <h3 className="font-semibold">Shop setup is required</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                Your Seller account is active, but no Shop is connected yet. Shop onboarding has not been defined, so this dashboard will not create a placeholder shop or show marketplace-wide data.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!isLoading && dashboard?.shop && 'metrics' in dashboard.sections.catalog ? (
        <>
          <section className="mt-6 rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="shop-catalog-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="font-semibold" id="shop-catalog-heading">{dashboard.shop.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">Catalog summary</p>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Shop status: <span className="font-medium capitalize">{dashboard.shop.status}</span>{dashboard.shop.is_on_vacation ? ' · Vacation mode' : ''}
              </p>
            </div>
            <CatalogSummary catalog={dashboard.sections.catalog} />
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="future-sections-heading">
            <div className="border-b border-zinc-200 px-5 py-4 dark:border-white/10">
              <h3 className="font-semibold" id="future-sections-heading">Dashboard sections</h3>
              <p className="mt-1 text-sm text-zinc-500">These areas stay unavailable until their source domains are implemented.</p>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-white/10">
              {deferredSections.map(({ detail, icon: Icon, key, name }) => (
                <li className="flex gap-3 px-5 py-4" key={key}>
                  <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="mt-1 text-sm leading-5 text-zinc-500 dark:text-zinc-400">Unavailable — {detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}

function CatalogSummary({ catalog }: { catalog: CatalogSection }) {
  const rows = [
    ['Total products', catalog.metrics.total],
    ['Active', catalog.metrics.active],
    ['Draft', catalog.metrics.draft],
    ['Archived', catalog.metrics.archived],
    ['Zero-stock products without variants', catalog.metrics.zero_stock_products],
    ['Zero-stock variant SKUs', catalog.metrics.zero_stock_skus],
  ] as const

  return (
    <div className="px-5 py-2">
      {catalog.state === 'empty' ? (
        <p className="border-b border-zinc-200 py-4 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">No products are recorded for this Shop yet.</p>
      ) : null}
      <dl className="divide-y divide-zinc-200 dark:divide-white/10">
        {rows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-4 py-3.5" key={label}>
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-2 border-t border-zinc-200 py-4 text-xs leading-5 text-zinc-500 dark:border-white/10">
        <FaBox aria-hidden="true" className="mt-0.5 shrink-0" />
        Stock figures are current catalog quantities, not authoritative available inventory.
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading dashboard" aria-live="polite" className="mt-6 space-y-4" role="status">
      <span className="sr-only">Loading Seller dashboard</span>
      <div className="h-16 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" />
      <div className="h-72 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" />
    </div>
  )
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
