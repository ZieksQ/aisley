import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useNotificationPopover() {
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const keyboardOpening = useRef(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 384, maxHeight: 480 })
  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const viewport = window.visualViewport
      const width = viewport?.width ?? window.innerWidth
      const height = viewport?.height ?? window.innerHeight
      const offsetTop = viewport?.offsetTop ?? 0
      const offsetLeft = viewport?.offsetLeft ?? 0
      const panelWidth = Math.min(384, width - 24)
      const below = offsetTop + height - rect.bottom - 20
      const above = rect.top - offsetTop - 20
      const useAbove = below < 240 && above > below
      const maxHeight = Math.max(0, Math.min(520, height - 24, useAbove ? above : below))
      setPosition({
        width: panelWidth,
        left: Math.max(offsetLeft + 12, Math.min(rect.right - panelWidth, offsetLeft + width - panelWidth - 12)),
        top: Math.max(offsetTop + 12, Math.min(useAbove ? rect.top - maxHeight - 8 : rect.bottom + 8, offsetTop + height - maxHeight - 12)),
        maxHeight,
      })
    }
    update()
    if (keyboardOpening.current) panel.current?.focus()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, close])

  return { trigger, panel, open, setOpen, close, position, keyboardOpening }
}
