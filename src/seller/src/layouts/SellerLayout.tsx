import { useState } from 'react'
import {
  FaArrowRightFromBracket,
  FaBars,
  FaGaugeHigh,
  FaBoxesStacked,
  FaBoxOpen,
  FaStore,
  FaXmark,
} from 'react-icons/fa6'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
    isActive
      ? 'bg-purple-50 text-[#4C1268] dark:bg-white/10 dark:text-white'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white'
  }`

export function SellerLayout() {
  const { seller, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const firstName = seller?.profile?.first_name ?? 'Seller'
  const initials = `${seller?.profile?.first_name?.[0] ?? 'S'}${seller?.profile?.last_name?.[0] ?? ''}`

  async function handleLogout() {
    setIsSigningOut(true)
    try {
      await logout()
    } catch {
      // The local session is cleared by AuthProvider even if the API is unavailable.
    } finally {
      navigate('/login', { replace: true })
      setIsSigningOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-zinc-950 dark:bg-[#101012] dark:text-white">
      <aside className={`${isMenuOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-zinc-200 bg-white px-4 py-5 dark:border-white/10 dark:bg-[#171719] lg:flex`}>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-[#4C1268] text-white">
              <FaStore aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Aisley</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Seller workspace</p>
            </div>
          </div>
          <button
            aria-label="Close navigation"
            className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
            onClick={() => setIsMenuOpen(false)}
            type="button"
          >
            <FaXmark aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Seller navigation" className="mt-8">
          <NavLink className={navClass} onClick={() => setIsMenuOpen(false)} to="/dashboard">
            <FaGaugeHigh aria-hidden="true" />
            Dashboard
          </NavLink>
          <NavLink className={navClass} onClick={() => setIsMenuOpen(false)} to="/products">
            <FaBoxOpen aria-hidden="true" />
            Products
          </NavLink>
          <NavLink className={navClass} onClick={() => setIsMenuOpen(false)} to="/inventory">
            <FaBoxesStacked aria-hidden="true" />
            Inventory
          </NavLink>
        </nav>

        <p className="mt-5 border-t border-zinc-200 px-3 pt-5 text-xs leading-5 text-zinc-500 dark:border-white/10 dark:text-zinc-500">
          Purchased-order fulfillment and reporting will appear when their source domains become available.
        </p>

        <div className="mt-auto border-t border-zinc-200 pt-4 dark:border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-purple-100 text-sm font-semibold text-[#4C1268] dark:bg-purple-400/15 dark:text-purple-200">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{firstName}</p>
              <p className="truncate text-xs text-zinc-500">{seller?.email}</p>
            </div>
          </div>
          <button
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
            disabled={isSigningOut}
            onClick={handleLogout}
            type="button"
          >
            <FaArrowRightFromBracket aria-hidden="true" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {isMenuOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-20 bg-black/55 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
          type="button"
        />
      ) : null}

      <section className="min-h-screen lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-white/10 dark:bg-[#171719] sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open navigation"
              className="grid size-10 place-items-center rounded-lg border border-zinc-300 text-zinc-600 dark:border-white/15 dark:text-zinc-300 lg:hidden"
              onClick={() => setIsMenuOpen(true)}
              type="button"
            >
              <FaBars aria-hidden="true" />
            </button>
            <h1 className="truncate text-lg font-semibold">{location.pathname.startsWith('/products') ? 'Products' : location.pathname.startsWith('/inventory') ? 'Inventory' : 'Dashboard'}</h1>
          </div>
          <ThemeToggle />
        </header>
        <Outlet />
      </section>
    </main>
  )
}
