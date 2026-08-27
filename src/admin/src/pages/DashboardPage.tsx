import { useEffect, useState } from 'react'
import {
  FaArrowRightFromBracket,
  FaBars,
  FaBell,
  FaChartLine,
  FaClipboardCheck,
  FaGaugeHigh,
  FaShieldHalved,
  FaXmark,
} from 'react-icons/fa6'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'

const scaffoldCards = [
  {
    title: 'Registration reviews',
    description: 'Account approval queues and application review tools will live here.',
    icon: FaClipboardCheck,
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
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    document.title = 'Dashboard | Aisley Admin'
  }, [])

  const firstName = admin?.profile?.first_name ?? 'Administrator'
  const initials = `${admin?.profile?.first_name?.[0] ?? 'A'}${admin?.profile?.last_name?.[0] ?? ''}`

  async function handleLogout() {
    setIsSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950 dark:bg-[#0b0d13] dark:text-white">
      <aside className={`${isMenuOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-30 w-72 flex-col border-r border-white/10 bg-[#180b20] px-5 py-6 text-white lg:flex`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#E6007A]">
              <FaShieldHalved aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Aisley</p>
              <p className="text-xs uppercase tracking-[0.16em] text-purple-200/55">Admin Console</p>
            </div>
          </div>
          <button
            aria-label="Close navigation"
            className="grid size-9 place-items-center rounded-lg text-purple-100/60 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setIsMenuOpen(false)}
            type="button"
          >
            <FaXmark aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-10" aria-label="Admin navigation">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-200/40">Workspace</p>
          <Link className="mt-3 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold ring-1 ring-white/10" to="/dashboard">
            <FaGaugeHigh aria-hidden="true" className="text-pink-300" />
            Dashboard
          </Link>
        </nav>

        <div className="mt-6 rounded-xl border border-dashed border-white/15 p-4 text-xs leading-5 text-purple-100/50">
          Additional admin tools will be added as their workflows are implemented.
        </div>

        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-purple-200/15 text-sm font-semibold uppercase text-purple-100">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{firstName}</p>
              <p className="truncate text-xs text-purple-100/45">{admin?.email}</p>
            </div>
          </div>
          <button
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-purple-100/65 hover:bg-white/10 hover:text-white disabled:opacity-50"
            disabled={isSigningOut}
            onClick={handleLogout}
            type="button"
          >
            <FaArrowRightFromBracket aria-hidden="true" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {isMenuOpen && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-20 bg-slate-950/55 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMenuOpen(false)}
          type="button"
        />
      )}

      <section className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0d13]/85 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              aria-label="Open navigation"
              className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 lg:hidden"
              onClick={() => setIsMenuOpen(true)}
              type="button"
            >
              <FaBars aria-hidden="true" />
            </button>
            <div>
              <p className="text-xs font-medium text-slate-400">Admin workspace</p>
              <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Notifications"
              className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm disabled:cursor-default dark:border-white/10 dark:bg-white/5 dark:text-slate-500"
              disabled
              title="Notifications coming soon"
              type="button"
            >
              <FaBell aria-hidden="true" />
            </button>
            <ThemeToggle />
          </div>
        </header>

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
            {scaffoldCards.map(({ title, description, icon: Icon }) => (
              <article className="min-h-52 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.035]" key={title}>
                <div className="grid size-11 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                  <Icon aria-hidden="true" />
                </div>
                <h4 className="mt-6 font-semibold">{title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Coming soon</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
