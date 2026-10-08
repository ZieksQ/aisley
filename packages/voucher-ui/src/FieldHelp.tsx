import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

export function FieldHelp({
  label,
  children,
}: {
  label: string
  children: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState({ left: 16, top: 16 })
  const visible = open || hovered

  useLayoutEffect(() => {
    if (!visible) return
    function place() {
      if (!button.current || !tip.current) return
      const anchor = button.current.getBoundingClientRect()
      const bounds = tip.current.getBoundingClientRect()
      setPosition({
        left: Math.max(
          16,
          Math.min(anchor.left, window.innerWidth - bounds.width - 16),
        ),
        top:
          anchor.bottom + bounds.height + 20 <= window.innerHeight
            ? anchor.bottom + 4
            : Math.max(16, anchor.top - bounds.height - 4),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    function dismiss(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      setHovered(false)
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', dismiss, true)
    return () => window.removeEventListener('keydown', dismiss, true)
  }, [visible])

  return (
    <span
      className="voucher-help"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={button}
        type="button"
        className="voucher-help-button"
        aria-label={`About ${label}`}
        aria-describedby={visible ? id : undefined}
        aria-expanded={visible}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10 5.5v5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="14" r=".9" fill="currentColor" />
        </svg>
      </button>
      {visible && (
        <span
          ref={tip}
          id={id}
          role="tooltip"
          className="voucher-help-tip"
          style={position}
        >
          {children}
        </span>
      )}
    </span>
  )
}
