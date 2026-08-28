import { useEffect, useId, useState } from 'react'
import { FaCircleExclamation, FaXmark } from 'react-icons/fa6'

type DecisionDialogProps = {
  decision: 'approve' | 'reject'
  applicantName: string
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (reason: string | null) => void
}

export function DecisionDialog({
  decision,
  applicantName,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}: DecisionDialogProps) {
  const [reason, setReason] = useState('')
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen])

  if (!isOpen) return null

  const isApproval = decision === 'approve'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#171921]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${isApproval ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300'}`}>
              <FaCircleExclamation aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" id={titleId}>
                {isApproval ? 'Approve registration?' : 'Reject registration?'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400" id={descriptionId}>
                This will {decision} the account registration for <strong className="font-semibold text-slate-700 dark:text-slate-200">{applicantName}</strong> and notify them by email.
              </p>
            </div>
          </div>
          <button
            aria-label="Close confirmation"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <FaXmark aria-hidden="true" />
          </button>
        </div>

        {!isApproval && (
          <label className="mt-5 block text-sm font-medium" htmlFor="rejection-reason">
            Reason <span className="font-normal text-slate-400">(optional, shared with applicant)</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10"
              id="rejection-reason"
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain the decision if needed"
              value={reason}
            />
          </label>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${isApproval ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
            disabled={isSubmitting}
            onClick={() => onConfirm(reason.trim() || null)}
            type="button"
          >
            {isSubmitting ? 'Saving decision…' : isApproval ? 'Approve account' : 'Reject account'}
          </button>
        </div>
      </div>
    </div>
  )
}
