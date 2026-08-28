import { useState } from 'react'
import {
  FaArrowRightFromBracket,
  FaBars,
  FaBell,
  FaClipboardCheck,
  FaGaugeHigh,
  FaShieldHalved,
  FaXmark,
} from 'react-icons/fa6'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
    isActive
      ? 'bg-white/10 text-white ring-1 ring-white/10'
      : 'text-purple-100/60 hover:bg-white/[0.07] hover:text-white'
  }`

export function AdminLayout() {
  const { admin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const firstName = admin?.profile?.first_name ?? 'Administrator'
  const initials = `${admin?.profile?.first_name?.[0] ?? 'A'}${admin?.profile?.last_name?.[0] ?? ''}`
  const canViewRegistrations = admin?.permissions.includes('registrations.view') ?? false
  const isRegistrationDetail = /^\/registrations\/[^/]+$/.test(location.pathname)
  const pageTitle = location.pathname.startsWith('/registrations')
    ? isRegistrationDetail
      ? 'Registration review'
      : 'Manage account registrations'
    : 'Dashboard'
  const pageContext = location.pathname.startsWith('/registrations')
    ? 'Account approvals'
    : 'Admin workspace'

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
          <div className="mt-3 space-y-1.5">
            <NavLink className={navClass} onClick={() => setIsMenuOpen(false)} to="/dashboard">
              <FaGaugeHigh aria-hidden="true" />
              Dashboard
            </NavLink>
            {canViewRegistrations && (
              <NavLink className={navClass} onClick={() => setIsMenuOpen(false)} to="/registrations">
                <FaClipboardCheck aria-hidden="true" />
                Account registrations
              </NavLink>
            )}
          </div>
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
          <div className="flex min-w-0 items-center gap-4">
            <button
              aria-label="Open navigation"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 lg:hidden"
              onClick={() => setIsMenuOpen(true)}
              type="button"
            >
              <FaBars aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">{pageContext}</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{pageTitle}</h1>
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

        <Outlet />
      </section>
    </main>
  )
}
