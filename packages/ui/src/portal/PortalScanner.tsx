import type { ReactNode } from 'react'
import { LuMaximize, LuMinimize } from 'react-icons/lu'
import { PortalButton } from './PortalButton'
import { useScannerFeedback, type ScannerFeedback } from './useScannerFeedback'
import { useScannerFullscreen } from './useScannerFullscreen'

/** The same camera stays mounted in the page and in the full-screen viewfinder. */
export function PortalScanner({ title, children, controls, fullscreenControls, footer, scanFeedback, error, onExpand }: {
  title: string
  children: ReactNode
  controls?: ReactNode
  fullscreenControls?: ReactNode
  footer?: ReactNode
  scanFeedback?: ScannerFeedback
  error?: string
  onExpand?: () => void
}) {
  const { root, toggle, expanded, enter, exit } = useScannerFullscreen()
  const { notification, prepare } = useScannerFeedback(expanded, scanFeedback, error)

  function expand() {
    prepare()
    onExpand?.()
    enter()
  }

  return <section ref={root} className={`portal-scanner ${expanded ? 'portal-scanner-expanded' : 'portal-section'}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={title}>
    <header className="portal-scanner-header">
      <div className="portal-scanner-title"><h3>{title}</h3><p className="portal-secondary">Code 128 barcode &amp; 2D QR</p></div>
      <nav className="portal-inline-actions" aria-label="Scanner controls">
        <PortalButton ref={toggle} aria-label={expanded ? 'Exit full screen scanner' : 'Full screen scanner'} aria-expanded={expanded} onClick={expanded ? exit : expand}>
          {expanded ? <LuMinimize aria-hidden="true" /> : <LuMaximize aria-hidden="true" />}
          <span>{expanded ? 'Exit full screen' : 'Full screen'}</span>
        </PortalButton>
        {expanded && fullscreenControls}
        {controls}
      </nav>
    </header>
    <div className="portal-scanner-content">{children}</div>
    {footer && <div className="portal-scanner-footer">{footer}</div>}
    {expanded && <>
      <div className="portal-scanner-viewfinder" aria-hidden="true">
        <span /><span /><span /><span />
        <p>Align barcode or QR inside the frame</p>
      </div>
      <div className="portal-scanner-feedback" aria-live="polite" aria-atomic="true">
        {notification && <p className={`portal-scanner-${notification.tone}`} role={notification.tone === 'error' ? 'alert' : 'status'}>{notification.message}</p>}
      </div>
    </>}
  </section>
}
