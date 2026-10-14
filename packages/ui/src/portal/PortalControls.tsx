import { useId } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
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
export function PortalField({ label, hint, suffix, error, id, className = '', required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; suffix?: string; error?: string }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const descriptionId = `${fieldId}-description`
  return (
    <div className={`portal-field ${className}`}>
      <label htmlFor={fieldId}>
        {label}
        {required && <span className="portal-required" aria-hidden="true">
          *
        </span>}
      </label>
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
