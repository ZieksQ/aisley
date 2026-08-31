import { useEffect, useId, useRef, useState } from 'react'
import { FaTriangleExclamation, FaXmark } from 'react-icons/fa6'
import type { ManagedUserRole, ManagedUserStatus } from '../../types/users'

type Action = 'suspend' | 'restore' | 'deactivate'
type Step = 'warning' | 'confirmation'

type Props = {
  action: Action | null
  userName: string
  userEmail: string
  userRole: ManagedUserRole
  currentStatus: ManagedUserStatus
  isSubmitting: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string | null, confirmation: string | null) => void
}

const copy: Record<Action, { title: string; description: string; button: string; requiresReason: boolean }> = {
  suspend: {
    title: 'Suspend account?',
    description: 'The account will immediately lose access to protected features until an Admin restores it.',
    button: 'Suspend account',
    requiresReason: true,
  },
  restore: {
    title: 'Restore account?',
    description: 'The account will regain access to protected features. Independent bans or restrictions are not changed.',
    button: 'Restore account',
    requiresReason: false,
  },
  deactivate: {
    title: 'Deactivate account?',
    description: 'This is the most restrictive account action and cannot currently be reversed by an Admin.',
    button: 'Deactivate account',
    requiresReason: true,
  },
}

export function LifecycleActionDialog({ action, userName, userEmail, userRole, currentStatus, isSubmitting, error, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [step, setStep] = useState<Step>('confirmation')
  const titleId = useId()
  const descriptionId = useId()
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!action) return

    setReason('')
    setConfirmation('')
    setStep(action === 'deactivate' ? 'warning' : 'confirmation')
    if (action !== 'deactivate') window.setTimeout(() => reasonRef.current?.focus(), 0)
  }, [action])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && action && !isSubmitting) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [action, isSubmitting, onClose])

  if (!action) return null

  const details = copy[action]
  const confirmationTarget = `${userEmail}/${userRole}`
  const isDeactivationWarning = action === 'deactivate' && step === 'warning'
  const validReason = !details.requiresReason || reason.trim().length >= 3
  const validConfirmation = action !== 'deactivate' || confirmation === confirmationTarget
  const valid = validReason && validConfirmation

  function continueToConfirmation() {
    setStep('confirmation')
    window.setTimeout(() => reasonRef.current?.focus(), 0)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4">
      <div aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#17111d]" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <FaTriangleExclamation aria-hidden="true" className={action === 'restore' ? 'mt-1 text-emerald-600' : action === 'deactivate' ? 'mt-1 text-rose-600' : 'mt-1 text-amber-600'} />
            <div>
              <h2 className="text-lg font-semibold" id={titleId}>{isDeactivationWarning ? details.title : action === 'deactivate' ? 'Confirm account deactivation' : details.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400" id={descriptionId}>
                <strong className="text-slate-800 dark:text-slate-200">{userName}</strong> is currently {currentStatus}. {details.description}
              </p>
            </div>
          </div>
          <button aria-label="Close confirmation" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" disabled={isSubmitting} onClick={onClose} type="button"><FaXmark aria-hidden="true" /></button>
        </div>

        {isDeactivationWarning ? (
          <>
            <div className="mt-5 border-y border-rose-200 py-4 text-sm text-slate-700 dark:border-rose-400/20 dark:text-slate-300">
              <p className="font-semibold text-rose-700 dark:text-rose-300">Before you continue:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>The user immediately loses access to protected account features.</li>
                <li>Orders, audit history, and related records remain preserved.</li>
                <li>This Admin workflow does not provide a way to reactivate the account.</li>
              </ul>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5" onClick={onClose} type="button">Cancel</button>
              <button className="rounded-lg bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#37104b]" onClick={continueToConfirmation} type="button">Continue</button>
            </div>
          </>
        ) : (
          <>
            <label className="mt-5 block text-sm font-medium" htmlFor="lifecycle-reason">
              Reason {details.requiresReason ? <span className="text-rose-600">*</span> : <span className="font-normal text-slate-400">(optional)</span>}
              <textarea ref={reasonRef} className="mt-2 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10" id="lifecycle-reason" maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Record the account-management reason" value={reason} />
            </label>

            {action === 'deactivate' && <label className="mt-5 block text-sm font-medium" htmlFor="lifecycle-confirmation">
              Type <code className="select-all break-all font-mono text-rose-700 dark:text-rose-300">{confirmationTarget}</code> to confirm <span className="text-rose-600">*</span>
              <input autoComplete="off" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10" id="lifecycle-confirmation" onChange={(event) => setConfirmation(event.target.value)} spellCheck={false} value={confirmation} />
            </label>}

            {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-300" role="alert">{error}</p>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {action === 'deactivate' && <button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5" disabled={isSubmitting} onClick={() => setStep('warning')} type="button">Back</button>}
              <button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5" disabled={isSubmitting} onClick={onClose} type="button">Cancel</button>
              <button className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${action === 'restore' ? 'bg-emerald-700 hover:bg-emerald-800' : action === 'deactivate' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-[#4C1268] hover:bg-[#37104b]'}`} disabled={isSubmitting || !valid} onClick={() => onConfirm(reason.trim() || null, action === 'deactivate' ? confirmation : null)} type="button">{isSubmitting ? 'Saving…' : details.button}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
