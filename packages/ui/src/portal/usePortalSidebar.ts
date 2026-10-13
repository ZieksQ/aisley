import { useEffect, useRef, useState } from 'react'

export function usePortalSidebar(role: string, routeKey: string) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(`aisley-${role}-sidebar`) === 'collapsed' }
    catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebar = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try { localStorage.setItem(`aisley-${role}-sidebar`, collapsed ? 'collapsed' : 'expanded') }
    catch { /* Keep the preference for the current session. */ }
  }, [collapsed, role])

  useEffect(() => { setMobileOpen(false) }, [routeKey])

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const firstVisibleButton = [...(sidebar.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.getClientRects().length > 0)
    firstVisibleButton?.focus()
    const media = window.matchMedia('(min-width: 1024px)')
    const onResize = () => { if (media.matches) setMobileOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileOpen(false)
      }
      if (event.key !== 'Tab') return
      const elements = [...(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ?? [])]
        .filter((element) => element.getClientRects().length > 0)
      const first = elements[0]
      const last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    media.addEventListener('change', onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      media.removeEventListener('change', onResize)
      trigger.current?.focus()
    }
  }, [mobileOpen])

  return { collapsed, setCollapsed, mobileOpen, setMobileOpen, sidebar, trigger }
}
