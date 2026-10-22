import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LuMaximize, LuMinimize } from 'react-icons/lu'
import { PortalButton } from './PortalButton'

/** Keeps the camera mounted while expanding its workspace, including on mobile. */
export function PortalScanner({ title, children, controls, footer, feedback, error }: {
  title: string
  children: ReactNode
  controls?: ReactNode
  footer?: ReactNode
  feedback?: string
  error?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const root = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!expanded || !root.current) return
    const element = root.current
    const previous = document.activeElement as HTMLElement | null
    const disabled: Array<{ element: HTMLElement; inert: boolean }> = []
    // Isolate the full-screen task without hiding or remounting its camera.
    let branch: HTMLElement = element
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          disabled.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      branch = branch.parentElement
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    toggle.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setExpanded(false)
      }
      if (event.key !== 'Tab') return
      const targets = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter((target) => target.getClientRects().length && !target.closest('[inert]'))
      const first = targets[0]
      const last = targets.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard, true)
    return () => {
      document.removeEventListener('keydown', keyboard, true)
      document.body.style.overflow = overflow
      disabled.forEach((item) => { item.element.inert = item.inert })
      if (toggle.current?.isConnected) toggle.current.focus()
      else if (previous?.isConnected) previous.focus()
    }
  }, [expanded])

  return <section ref={root} className={`portal-scanner ${expanded ? 'portal-scanner-expanded' : 'portal-section'}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={title}>
    <header className="portal-scanner-header">
      <div><h3>{title}</h3><p className="portal-secondary">Code 128 barcode &amp; 2D QR</p></div>
      <div className="portal-inline-actions">
        {controls}
        <PortalButton ref={toggle} aria-label={expanded ? 'Exit full screen scanner' : 'Full screen scanner'} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? <LuMinimize aria-hidden="true" /> : <LuMaximize aria-hidden="true" />}
          <span>{expanded ? 'Exit full screen' : 'Full screen'}</span>
        </PortalButton>
      </div>
    </header>
    <div className="portal-scanner-content">{children}</div>
    {footer && <div className="portal-scanner-footer">{footer}</div>}
    {expanded && <div className="portal-scanner-feedback">
      {error ? <p className="portal-scanner-error" role="alert">{error}</p> : <p role="status" aria-live="polite">{feedback || 'Ready to scan. Captures need server verification.'}</p>}
    </div>}
  </section>
}
