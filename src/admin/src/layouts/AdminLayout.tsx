import { useState } from 'react'
import {
  FaArrowRightFromBracket,
  FaBars,
  FaShieldHalved,
  FaXmark,
} from 'react-icons/fa6'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
import { AdminAvatar } from '../components/AdminAvatar'
import { AdminNotificationBell } from '../components/AdminNotificationBell'
import { AdminSidebarNav } from '../components/AdminSidebarNav'

const storefrontUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function AdminLayout() {
  const { admin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const firstName = admin?.profile?.first_name ?? 'Administrator'
  const initials = `${admin?.profile?.first_name?.[0] ?? 'A'}${admin?.profile?.last_name?.[0] ?? ''}`
  const canViewNotifications = admin?.permissions.includes('notifications.view') ?? false
  const isUserDetail = /^\/users\/[^/]+$/.test(location.pathname)
  const isRegistrationDetail = /^\/registrations\/[^/]+$/.test(location.pathname)
  const isAuditDetail = /^\/audit-logs\/[^/]+$/.test(location.pathname)
  const isHomepageAdEditor = location.pathname.startsWith('/platform-settings/homepage-ads/')
  const pageTitle = location.pathname.startsWith('/support-tickets') ? 'Support tickets' : location.pathname.startsWith('/notification-campaigns') ? 'Notification campaigns' : location.pathname.startsWith('/registrations')
    ? isRegistrationDetail ? 'Registration review' : 'Manage account registrations'
    : location.pathname.startsWith('/audit-logs')
      ? isAuditDetail ? 'Audit event' : 'System audit logs'
      : location.pathname.startsWith('/finance') ? 'Finance' : location.pathname.startsWith('/users') ? isUserDetail ? 'User account' : 'Manage user accounts' : location.pathname.startsWith('/seller-compliance') ? location.pathname.includes('/cases/') ? 'Compliance case' : 'Seller compliance' : location.pathname.startsWith('/notifications') ? 'Notifications' : location.pathname.startsWith('/account') ? 'Account settings' : location.pathname.startsWith('/policy-consent') ? 'Policy consent' : location.pathname.startsWith('/feature-controls') ? 'Feature controls' : location.pathname.startsWith('/platform-settings') ? isHomepageAdEditor ? 'Homepage advertisement' : 'Platform settings' : 'Dashboard'
  const pageContext = location.pathname.startsWith('/support-tickets') ? 'User support' : location.pathname.startsWith('/notification-campaigns') ? 'Customer in-app messages' : location.pathname.startsWith('/registrations')
    ? 'Account approvals'
    : location.pathname.startsWith('/audit-logs')
      ? 'System accountability'
      : location.pathname.startsWith('/users') ? 'Account lifecycle' : location.pathname.startsWith('/seller-compliance') ? 'Marketplace policy enforcement' : location.pathname.startsWith('/notifications') ? 'Admin inbox' : location.pathname.startsWith('/account') ? 'Administrator account' : location.pathname.startsWith('/policy-consent') ? 'Shared policy acceptance' : location.pathname.startsWith('/feature-controls') ? 'Platform behavior switches' : location.pathname.startsWith('/platform-settings') ? isHomepageAdEditor ? 'Advertisement content' : 'Announcements, policies, and homepage ads' : 'Admin workspace'

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
      <aside className={`${isMenuOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-30 w-72 flex-col overflow-hidden border-r border-slate-200 bg-white px-5 py-6 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-[#180b20] dark:text-white lg:flex lg:shadow-none`}>
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#E6007A]">
              <FaShieldHalved aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Aisley</p>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-purple-200/55">Admin Console</p>
            </div>
          </div>
          <button
            aria-label="Close navigation"
            className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-950 dark:text-purple-100/60 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
            onClick={() => setIsMenuOpen(false)}
            type="button"
          >
            <FaXmark aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 pr-2">
          <AdminSidebarNav onNavigate={() => setIsMenuOpen(false)} permissions={admin?.permissions ?? []} />
        </div>

        <div className="mt-6 shrink-0 border-t border-slate-200 pt-5 dark:border-white/10">
          <div className="flex items-center gap-3 px-2">
            <AdminAvatar initials={initials} photoUrl={admin?.profile?.profile_photo_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{firstName}</p>
              <p className="truncate text-xs text-slate-400 dark:text-purple-100/45">{admin?.email}</p>
            </div>
          </div>
          <button
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50 dark:text-purple-100/65 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={isSigningOut}
            onClick={handleLogout}
            type="button"
          >
            <FaArrowRightFromBracket aria-hidden="true" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
          <nav aria-label="Policy links" className="mt-3 flex gap-3 border-t border-slate-200 px-2 pt-3 text-xs text-slate-400 dark:border-white/10 dark:text-purple-100/45">
            <a className="hover:text-[#4C1268] dark:hover:text-white" href={`${storefrontUrl}/policies/terms_of_service`} rel="noreferrer" target="_blank">Terms</a>
            <a className="hover:text-[#4C1268] dark:hover:text-white" href={`${storefrontUrl}/policies/privacy_policy`} rel="noreferrer" target="_blank">Privacy</a>
          </nav>
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
            {canViewNotifications && <AdminNotificationBell />}
            <ThemeToggle />
          </div>
        </header>

        <Outlet />
      </section>
    </main>
  )
}
