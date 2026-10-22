import { useEffect, useRef, useState } from 'react'

export function useScannerFullscreen() {
  const [expanded, setExpanded] = useState(false)
  const root = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const native = useRef(false)

  function exit() {
    setExpanded(false)
    if (document.fullscreenElement === root.current) void document.exitFullscreen().catch(() => {})
  }

  function enter() {
    setExpanded(true)
    // Unsupported or denied browser fullscreen still has an edge-to-edge viewport fallback.
    void root.current?.requestFullscreen?.().catch(() => {})
  }

  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === root.current) native.current = true
      else if (native.current) { native.current = false; setExpanded(false) }
    }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])

  useEffect(() => {
    if (!expanded || !root.current) return
    const element = root.current
    const previous = document.activeElement as HTMLElement | null
    const disabled: Array<{ element: HTMLElement; inert: boolean }> = []
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
        exit()
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

  return { root, toggle, expanded, enter, exit }
}
