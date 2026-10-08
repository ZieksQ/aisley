import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@aisley/ui'

export function Confirmation({
  title,
  children,
  confirm,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirm: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    return () => {
      ref.current?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby="voucher-confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 id="voucher-confirm-title">{title}</h2>
      {children}
      <div className="voucher-actions">
        <Button variant="outline" onClick={onCancel} autoFocus>
          Cancel
        </Button>
        <Button onClick={onConfirm}>{confirm}</Button>
      </div>
    </dialog>
  )
}
