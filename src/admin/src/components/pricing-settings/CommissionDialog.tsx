import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FaXmark } from 'react-icons/fa6'
import { secondaryButtonClass } from './ui'

type Props = { title: string; busy: boolean; onClose: () => void; children: ReactNode }

export function CommissionDialog({ title, busy, onClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    const overflow = document.body.style.overflow
    element?.showModal()
    element?.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return createPortal(
    <dialog aria-labelledby={titleId} aria-modal="true"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 text-slate-950 backdrop:bg-slate-950/65 sm:p-6 dark:border-white/10 dark:bg-[#17111d] dark:text-white"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
          .filter((element) => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls.at(-1)
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }} ref={dialog}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold" id={titleId}>{title}</h2>
        <button aria-label="Close dialog" className={`${secondaryButtonClass} shrink-0 px-3`} disabled={busy} onClick={onClose} type="button"><FaXmark aria-hidden="true" /></button>
      </div>
      {children}
    </dialog>, document.body,
  )
}
