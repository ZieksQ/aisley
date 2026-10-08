import { useEffect, useRef, useState } from 'react'
import { FaArrowRightFromBracket, FaBars, FaBell, FaChevronUp, FaGear, FaTruckFast, FaXmark } from 'react-icons/fa6'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { NotificationBell } from '../components/NotificationBell'
import { LogisticsAvatar } from '../components/LogisticsAvatar'
import { LogisticsSidebarNav } from '../components/LogisticsSidebarNav'
import { SettingsSidebarNav } from '../components/SettingsSidebarNav'
import type { LogisticsUser } from '../types/auth'

const menuItemClass = 'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4C1268] dark:text-zinc-200 dark:hover:bg-white/[0.08] dark:hover:text-white'

function displayName(logistics: LogisticsUser | null): string {
  const name = [logistics?.profile?.first_name, logistics?.profile?.last_name].filter(Boolean).join(' ').trim()
  return name || logistics?.organization?.business_name || 'Logistics account'
}

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'L'
}

function AccountMenu({ logistics, onNavigate, onLogout, signingOut }: { logistics: LogisticsUser | null; onNavigate: () => void; onLogout: () => void; signingOut: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const name = displayName(logistics)
  const initials = initialsFor(name)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        window.requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function closeMenu() {
    setOpen(false)
    onNavigate()
  }

  return <div className="relative" ref={rootRef}>
    <button aria-controls="logistics-account-menu" aria-expanded={open} aria-haspopup="menu" className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:hover:bg-white/[0.06]" onClick={() => setOpen((current) => !current)} ref={triggerRef} type="button">
      <LogisticsAvatar className="size-9" initials={initials} photoUrl={null} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{logistics?.email ?? 'No email available'}</span></span>
      <FaChevronUp aria-hidden="true" className={`shrink-0 text-xs text-zinc-500 transition-transform duration-150 ${open ? '' : 'rotate-180'}`} />
    </button>
    {open ? <div aria-label="Account menu" className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 max-h-[calc(100dvh-7rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-950 shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:border-white/15 dark:bg-[#18181b] dark:text-white" id="logistics-account-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={(event) => {
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')]
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }
    }} role="menu">
      <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><p className="truncate text-sm font-semibold">{name}</p><p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{logistics?.email ?? 'No email available'}</p></div>
      <div className="py-1">
        <Link className={menuItemClass} onClick={closeMenu} role="menuitem" to="/settings"><FaGear aria-hidden="true" className="text-zinc-500 dark:text-zinc-400" /><span>Settings</span></Link>
        <Link className={menuItemClass} onClick={closeMenu} role="menuitem" to="/notifications"><FaBell aria-hidden="true" className="text-zinc-500 dark:text-zinc-400" /><span>Notifications</span></Link>
      </div>
      <div className="border-t border-zinc-200 pt-1 dark:border-white/10"><button className={`${menuItemClass} text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-400/10 dark:hover:text-red-200`} disabled={signingOut} onClick={onLogout} role="menuitem" type="button"><FaArrowRightFromBracket aria-hidden="true" />{signingOut ? 'Signing out…' : 'Log out'}</button></div>
    </div> : null}
  </div>
}

export function LogisticsLayout() {
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const settings = location.pathname.startsWith('/settings')
  const sidebar = useRef<HTMLElement>(null)
  const navigationButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const media = window.matchMedia('(min-width: 1024px)')
    const resized = () => { if (media.matches) setOpen(false) }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (!document.querySelector('#logistics-account-menu')) setOpen(false); return }
      if (event.key !== 'Tab') return
      const elements = [...(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])].filter((element) => element.getClientRects().length)
      const first = elements[0]
      const last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    media.addEventListener('change', resized)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', keyboard)
      media.removeEventListener('change', resized)
      navigationButton.current?.focus()
    }
  }, [open])

  async function signOut() {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
      setSigningOut(false)
    }
  }

  const title = settings
    ? 'Settings'
    : location.pathname.startsWith('/finance')
    ? 'Finance'
    : location.pathname.startsWith('/support-tickets')
    ? 'Support tickets'
    : location.pathname.startsWith('/messages')
    ? 'Operational messages'
    : location.pathname.startsWith('/receive-at-hub')
    ? 'Receive at hub'
    : location.pathname.startsWith('/sort-plan')
      ? 'Sort plan'
    : location.pathname.startsWith('/linehaul-dispatch')
      ? 'Linehaul dispatch'
    : location.pathname.startsWith('/linehaul')
      ? 'Linehaul'
    : location.pathname.startsWith('/inbound-linehaul')
      ? 'Inbound linehaul'
    : location.pathname.startsWith('/sorting')
      ? 'Sorting'
    : location.pathname.startsWith('/dispatch')
      ? 'Last-mile dispatch'
    : location.pathname.startsWith('/delivery-confirmations')
      ? 'Delivery confirmations'
    : location.pathname.startsWith('/couriers/') && location.pathname.endsWith('/vehicle')
      ? 'Courier vehicle'
    : location.pathname.startsWith('/vehicles')
      ? 'Vehicles'
    : location.pathname.startsWith('/fleet')
      ? 'Company fleet'
    : location.pathname.startsWith('/operations')
      ? 'Parcel search'
      : location.pathname.startsWith('/pickups')
      ? 'Pickups'
      : location.pathname.startsWith('/courier-applications')
        ? 'Courier applications'
        : location.pathname.startsWith('/notifications')
          ? 'Notifications'
          : location.pathname.startsWith('/account')
            ? 'Account settings'
          : location.pathname.startsWith('/shipping-rates')
              ? 'Shipping rates'
              : location.pathname.startsWith('/policy-consent')
              ? 'Terms & condition'
              : location.pathname === '/dashboard'
                ? 'Dashboard'
                : 'Page not found'

  return <main className="min-h-screen bg-[#f7f7f8] text-zinc-950 dark:bg-[#101012] dark:text-white">
    <aside aria-label="Logistics navigation" aria-modal={open ? true : undefined} id="logistics-navigation" ref={sidebar} role={open ? 'dialog' : undefined} className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-30 w-64 flex-col overflow-visible border-r border-zinc-200 bg-white px-4 py-5 dark:border-white/10 dark:bg-[#171719] lg:flex`}>
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-[#4C1268] text-white"><FaTruckFast /></span><span><span className="block font-semibold">Aisley</span><span className="block text-xs text-zinc-500">Logistics workspace</span></span></div>
        <button aria-label="Close navigation" className="grid size-9 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} type="button"><FaXmark /></button>
      </div>
      {settings ? <SettingsSidebarNav onNavigate={() => setOpen(false)} /> : <LogisticsSidebarNav onNavigate={() => setOpen(false)} />}
      <div className="mt-4 shrink-0 border-t border-zinc-200 pt-3 dark:border-white/10"><AccountMenu logistics={logistics} onLogout={() => void signOut()} onNavigate={() => setOpen(false)} signingOut={signingOut} /></div>
    </aside>
    {open ? <button aria-label="Close navigation overlay" className="fixed inset-0 z-20 bg-black/55 lg:hidden" onClick={() => setOpen(false)} type="button" /> : null}
    <section className="min-h-screen lg:pl-64">
      <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-white/10 dark:bg-[#171719] sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><button aria-controls="logistics-navigation" aria-expanded={open} aria-label="Open navigation" className="grid size-10 place-items-center rounded-md border border-zinc-300 dark:border-white/15 lg:hidden" onClick={() => setOpen(true)} ref={navigationButton} type="button"><FaBars /></button><h1 className="text-lg font-semibold">{title}</h1></div>
        <div className="flex items-center gap-2"><NotificationBell /></div>
      </header>
      <Outlet />
    </section>
  </main>
}
