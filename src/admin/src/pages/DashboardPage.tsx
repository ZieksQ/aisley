import { useEffect } from 'react'
import { FaChartLine, FaClipboardCheck, FaGaugeHigh } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const scaffoldCards = [
  {
    title: 'Registration reviews',
    description: 'Review and decide pending Customer and Seller account applications.',
    icon: FaClipboardCheck,
    path: '/registrations',
  },
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
  const { admin } = useAuth()

  useEffect(() => {
    document.title = 'Dashboard | Aisley Admin'
  }, [])

  const firstName = admin?.profile?.first_name ?? 'Administrator'
  const canViewRegistrations = admin?.permissions.includes('registrations.view') ?? false

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <section className="overflow-hidden rounded-2xl bg-[#4C1268] px-6 py-8 text-white shadow-xl shadow-purple-950/10 sm:px-9 sm:py-10">
        <p className="text-sm font-medium text-purple-200">Welcome back, {firstName}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Your admin dashboard is ready.</h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-purple-100/65">
          Authentication and protected navigation are in place. Operational widgets will appear here as each admin feature is built.
        </p>
      </section>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Workspace scaffold</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Reserved areas for upcoming admin capabilities.</p>
        </div>
        <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-semibold text-[#b0005d] dark:border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-300">
          Foundation
        </span>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {scaffoldCards.map(({ title, description, icon: Icon, path }) => {
          const content = (
            <>
              <div className="grid size-11 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                <Icon aria-hidden="true" />
              </div>
              <h4 className="mt-6 font-semibold">{title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
              <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {path && canViewRegistrations ? 'Open workspace' : 'Coming soon'}
              </span>
            </>
          )

          return path && canViewRegistrations ? (
            <Link
              className="min-h-52 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-pink-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-pink-400/30"
              key={title}
              to={path}
            >
              {content}
            </Link>
          ) : (
            <article className="min-h-52 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.035]" key={title}>
              {content}
            </article>
          )
        })}
      </div>
    </div>
  )
}
