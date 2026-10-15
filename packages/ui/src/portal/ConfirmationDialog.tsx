import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
export function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  busy = false,
  confirmDisabled = false,
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  confirmDisabled?: boolean
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
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
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="portal-confirmation"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div id={descriptionId} className="portal-confirmation-description">
        {children}
      </div>
      <div className="portal-confirmation-actions">
        <button
          className="portal-button"
          type="button"
          disabled={busy}
          onClick={onClose}
          autoFocus
        >
          Cancel
        </button>
        <button
          className={`portal-button ${destructive ? 'portal-button-danger' : 'portal-button-primary'}`}
          type="button"
          disabled={busy || confirmDisabled}
          aria-busy={busy}
          onClick={onConfirm}
        >
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
