'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Fits a ticket workspace below its consuming app's navigation and page header. */
export function TicketViewport({ children, className, label }: {
  children: ReactNode
  className: string
  label?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = root.current
    if (!node) return
    let frame = 0
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport
        const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight
        const available = bottom - Math.max(0, node.getBoundingClientRect().top) - 16
        node.style.setProperty('--ticket-height', `${Math.max(360, Math.min(900, available))}px`)
      })
    }
    resize()
    const observer = new ResizeObserver(resize)
    if (node.parentElement) observer.observe(node.parentElement)
    window.addEventListener('resize', resize)
    viewportEvents('addEventListener')
    function viewportEvents(method: 'addEventListener' | 'removeEventListener') {
      window.visualViewport?.[method]('resize', resize)
      window.visualViewport?.[method]('scroll', resize)
    }
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      viewportEvents('removeEventListener')
    }
  }, [])
  return <div ref={root} className={className} aria-label={label}>{children}</div>
}
