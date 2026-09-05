import { useEffect, useState } from 'react'
import {
  FaArrowRight,
  FaChartLine,
  FaClipboardCheck,
  FaGaugeHigh,
  FaRotateRight,
  FaUsers,
} from 'react-icons/fa6'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from '../lib/api'
import { formatDate, roleLabel } from '../lib/registrations'
import type { DashboardData, DashboardResponse } from '../types/dashboard'

const scaffoldCards = [
  {
    title: 'Platform health',
    description: 'Marketplace activity and operational signals will be summarized here.',
    icon: FaGaugeHigh,
  },
  {
    title: 'Reports overview',
    description: 'Commission and performance reporting will be added in a future feature.',
    icon: FaChartLine,
  },
]

export function DashboardPage() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const canViewRegistrations = admin?.permissions.includes('registrations.view') ?? false
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [isRegistrationLoading, setIsRegistrationLoading] = useState(canViewRegistrations)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Dashboard | Aisley Admin'
  }, [])

  useEffect(() => {
    if (!canViewRegistrations) {
      setDashboard(null)
      setRegistrationError(null)
      setIsRegistrationLoading(false)
      return
    }

    const controller = new AbortController()

    setIsRegistrationLoading(true)
    setRegistrationError(null)

    apiRequest<DashboardResponse>('/api/v1/admin/dashboard', {
      signal: controller.signal,
    })
      .then((response) => {
        setDashboard(response.data)

        if (!response.data.registrations) {
          setRegistrationError('Registration dashboard access is no longer available for this account.')
        }
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }

        setRegistrationError('We could not load the registration overview. Please try again.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRegistrationLoading(false)
      })

    return () => controller.abort()
  }, [canViewRegistrations, logout, navigate, reloadKey])

  const firstName = admin?.profile?.first_name ?? 'Administrator'
  const registrationOverview = dashboard?.registrations ?? null

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <section className="overflow-hidden rounded-2xl bg-[#4C1268] px-6 py-8 text-white shadow-xl shadow-purple-950/10 sm:px-9 sm:py-10">
        <p className="text-sm font-medium text-purple-200">Welcome back, {firstName}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Your admin dashboard is ready.</h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-purple-100/65">
          Registration workload is available below. Additional operational widgets will appear here as each admin feature is built.
        </p>
      </section>

      {canViewRegistrations && (
        <section aria-labelledby="registration-overview-heading" className="mt-8">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E6007A]">Account approvals</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight" id="registration-overview-heading">Registration overview</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Current Customer and Seller applications awaiting Admin review.</p>
            </div>
            {dashboard && registrationOverview && !isRegistrationLoading && !registrationError && (
              <p className="text-xs text-slate-400">Updated {formatDate(dashboard.generated_at)}</p>
            )}
          </div>

          {isRegistrationLoading ? (
            <RegistrationOverviewSkeleton />
          ) : registrationError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-400/20 dark:bg-red-400/10" role="alert">
              <h4 className="font-semibold text-red-900 dark:text-red-200">Unable to load registration overview</h4>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">{registrationError}</p>
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-400/20 dark:bg-white/5 dark:text-red-200 dark:hover:bg-white/10"
                onClick={() => setReloadKey((value) => value + 1)}
                type="button"
              >
                <FaRotateRight aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : registrationOverview ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <Link
                aria-label={`${registrationOverview.pending.total} pending registrations. View pending registrations.`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-pink-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-pink-400/30 sm:p-7"
                to="/registrations?status=pending"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-11 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                    <FaUsers aria-hidden="true" />
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b0005d] dark:text-pink-300">
                    View queue
                    <FaArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
                <p className="mt-7 text-sm font-semibold text-slate-500 dark:text-slate-400">Pending Registrations</p>
                <p className="mt-2 text-5xl font-semibold tracking-[-0.05em]">{registrationOverview.pending.total}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {registrationOverview.pending.total === 0
                    ? 'No pending registrations.'
                    : `${registrationOverview.pending.total === 1 ? 'Application' : 'Applications'} waiting for review.`}
                </p>
                <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5 dark:border-white/10">
                  <div>
                    <dt className="text-xs text-slate-400">Customers</dt>
                    <dd className="mt-1 text-lg font-semibold">{registrationOverview.pending.by_role.customer}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Sellers</dt>
                    <dd className="mt-1 text-lg font-semibold">{registrationOverview.pending.by_role.seller}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Logistics</dt>
                    <dd className="mt-1 text-lg font-semibold">{registrationOverview.pending.by_role.logistics}</dd>
                  </div>
                </dl>
              </Link>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-pink-50 text-[#b0005d] dark:bg-pink-400/10 dark:text-pink-300">
                        <FaClipboardCheck aria-hidden="true" />
                      </div>
                      <h4 className="font-semibold">Registration Action Center</h4>
                    </div>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Oldest pending applications appear first.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-white/5 dark:text-slate-400">
                    {registrationOverview.action_items.length} shown
                  </span>
                </div>

                {registrationOverview.action_items.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center dark:border-white/10">
                    <p className="font-semibold">You're all caught up</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">New pending applications will appear here.</p>
                  </div>
                ) : (
                  <ol className="mt-5 divide-y divide-slate-100 dark:divide-white/10">
                    {registrationOverview.action_items.map((application) => (
                      <li key={application.id}>
                        <Link
                          aria-label={`Review ${roleLabel(application.role)} application submitted ${formatDate(application.submitted_at)}`}
                          className="group flex items-center justify-between gap-4 rounded-lg px-2 py-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:hover:bg-white/[0.035]"
                          to={`/registrations/${application.id}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{roleLabel(application.role)} application</p>
                            <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(application.submitted_at)}</p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-[#b0005d] dark:text-pink-300">
                            Review
                            <FaArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            </div>
          ) : null}
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Workspace scaffold</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Reserved areas for upcoming admin capabilities.</p>
        </div>
        <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-semibold text-[#b0005d] dark:border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-300">
          Foundation
        </span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {scaffoldCards.map(({ title, description, icon: Icon }) => (
          <article className="min-h-52 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.035]" key={title}>
              <div className="grid size-11 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                <Icon aria-hidden="true" />
              </div>
              <h4 className="mt-6 font-semibold">{title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
              <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Coming soon
              </span>
          </article>
        ))}
      </div>
    </div>
  )
}

function RegistrationOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading registration overview" className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" role="status">
      <span className="sr-only">Loading registration overview</span>
      {[0, 1].map((item) => (
        <div className="min-h-72 animate-pulse rounded-2xl border border-slate-200 bg-white p-7 dark:border-white/10 dark:bg-white/[0.035]" key={item}>
          <div className="size-11 rounded-xl bg-slate-100 dark:bg-white/10" />
          <div className="mt-7 h-4 w-36 rounded bg-slate-100 dark:bg-white/10" />
          <div className="mt-4 h-12 w-20 rounded bg-slate-100 dark:bg-white/10" />
          <div className="mt-6 h-16 rounded bg-slate-100 dark:bg-white/10" />
        </div>
      ))}
    </div>
  )
}
