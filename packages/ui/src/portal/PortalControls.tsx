import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { FaCircleInfo } from 'react-icons/fa6'
export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      className={`portal-icon-action ${className}`}
      type="button"
      {...props}>
      {children}
      <span className="portal-action-tooltip" aria-hidden="true">
        {label}
      </span>
    </button>
  )
}
function PortalFieldHelp({ label, text }: { label: string; text: string }) {
  const tooltipId = useId()
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const tooltip = useRef<HTMLSpanElement>(null)
  const pointerInteraction = useRef(false)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState({ left: 16, top: 16 })
  const visible = open || hovered

  useLayoutEffect(() => {
    if (!visible) return

    function positionTooltip() {
      if (!trigger.current || !tooltip.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const bounds = tooltip.current.getBoundingClientRect()
      const left = Math.max(16, Math.min(anchor.left, window.innerWidth - bounds.width - 16))
      const below = anchor.bottom + 8
      const top = below + bounds.height <= window.innerHeight - 16
        ? below
        : Math.max(16, anchor.top - bounds.height - 8)

      setPosition({ left, top })
    }

    positionTooltip()
    window.addEventListener('resize', positionTooltip)
    window.addEventListener('scroll', positionTooltip, true)
    return () => {
      window.removeEventListener('resize', positionTooltip)
      window.removeEventListener('scroll', positionTooltip, true)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return

    function dismissOutside(event: PointerEvent) {
      if (root.current?.contains(event.target as Node)) return
      setOpen(false)
      setHovered(false)
    }

    window.addEventListener('pointerdown', dismissOutside)
    return () => window.removeEventListener('pointerdown', dismissOutside)
  }, [visible])

  return <span
    ref={root}
    className="portal-field-help"
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}>
    <button
      ref={trigger}
      aria-label={`Help for ${label}`}
      aria-describedby={visible ? tooltipId : undefined}
      aria-expanded={visible}
      className="portal-field-help-button"
      onBlur={() => setOpen(false)}
      onClick={(event) => setOpen(event.detail === 0 ? true : (isOpen) => !isOpen)}
      onFocus={() => {
        if (!pointerInteraction.current) setOpen(true)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        setOpen(false)
        setHovered(false)
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerCancel={() => { pointerInteraction.current = false }}
      onPointerDown={() => { pointerInteraction.current = true }}
      onPointerUp={() => { pointerInteraction.current = false }}
      type="button">
      <FaCircleInfo aria-hidden="true" />
    </button>
    {visible && <span
      ref={tooltip}
      className="portal-field-help-tooltip"
      id={tooltipId}
      role="tooltip"
      style={position}>
      {text}
    </span>}
  </span>
}

export function PortalField({ label, hint, help, suffix, error, id, className = '', required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; help?: string; suffix?: string; error?: string }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const descriptionId = `${fieldId}-description`
  const fieldLabel = <label htmlFor={fieldId}>
    {label}
    {required && <span className="portal-required" aria-hidden="true">
      *
    </span>}
  </label>
  return (
    <div className={`portal-field ${className}`}>
      {help ? <div className="portal-field-label-row">
        {fieldLabel}
        <PortalFieldHelp label={label} text={help} />
      </div> : fieldLabel}
      <div className="portal-field-control">
        <input
          id={fieldId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? descriptionId : undefined}
          {...props} />
        {suffix && <span className="portal-field-suffix" aria-hidden="true">
          {suffix}
        </span>}
      </div>
      {(error || hint) && <p className={error ? 'portal-field-error' : 'portal-field-hint'} id={descriptionId}>
        {error || hint}
      </p>}
    </div>
  )
}
export function PortalSection({ id, title, description, action, children }: { id: string; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section
      className="portal-section"
      id={id}
      aria-labelledby={`${id}-heading`}>
      <div className="portal-section-heading">
        <div>
          <h3 id={`${id}-heading`}>
            {title}
          </h3>
          {description && <p>
            {description}
          </p>}
        </div>
        {action}
      </div>
      <div className="portal-section-content">
        {children}
      </div>
    </section>
  )
}
