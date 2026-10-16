import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { LuX } from 'react-icons/lu'
import { IconButton } from './PortalControls'

export function PortalModal({
  title,
  description,
  busy = false,
  onClose,
  children,
}: {
  title: string
  description?: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement as HTMLElement | null
    element?.showModal()
    return () => {
      element?.close()
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="portal-modal"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header className="portal-modal-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        <IconButton label="Close dialog" disabled={busy} onClick={onClose}>
          <LuX aria-hidden="true" />
        </IconButton>
      </header>
      <div className="portal-modal-content">{children}</div>
    </dialog>
  )
}

export function PortalPagination({
  page,
  lastPage,
  total,
  disabled,
  onPage,
}: {
  page: number
  lastPage: number
  total?: number
  disabled?: boolean
  onPage: (page: number) => void
}) {
  if (lastPage < 2) return null
  return (
    <nav className="portal-pagination" aria-label="Pagination">
      <p className="portal-secondary">
        Page {page} of {lastPage}
        {total !== undefined ? ` · ${total} results` : ''}
      </p>
      <div className="portal-inline-actions">
        <button
          className="portal-button"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="portal-button"
          disabled={disabled || page >= lastPage}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}

export function PortalTable({
  label,
  density = 'default',
  children,
}: {
  label: string
  density?: 'default' | 'compact'
  children: ReactNode
}) {
  return (
    <div
      className="portal-table-region"
      data-density={density}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="portal-table">{children}</table>
    </div>
  )
}

export function PortalState({
  title,
  description,
  action,
  error = false,
}: {
  title: string
  description?: string
  action?: ReactNode
  error?: boolean
}) {
  return (
    <div
      className={`portal-state ${error ? 'portal-state-error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      <p className="portal-state-title">{title}</p>
      {description && <p className="portal-secondary">{description}</p>}
      {action && <div className="portal-inline-actions">{action}</div>}
    </div>
  )
}

export function PortalSkeleton({
  label,
  rows = 5,
}: {
  label: string
  rows?: number
}) {
  return (
    <div
      className="portal-skeleton"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="portal-skeleton-heading" aria-hidden="true">
        <span />
        <span />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div className="portal-skeleton-row" key={index} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}
