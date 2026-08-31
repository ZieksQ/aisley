import { useEffect, useId, useRef, useState } from 'react'
import { FaTriangleExclamation, FaXmark } from 'react-icons/fa6'
import type { ComplianceActionName, ComplianceCaseDetail } from '../../types/sellerCompliance'

type Props = {
  action: ComplianceActionName | null
  complianceCase: ComplianceCaseDetail
  isSubmitting: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string, idempotencyKey: string, confirmation?: string) => void
}

const copy: Record<ComplianceActionName, { title: string; button: string; description: string }> = {
  dismiss: { title: 'Dismiss compliance case?', button: 'Dismiss case', description: 'No Seller or Product access will change. The dismissal remains in the case history.' },
  warn: { title: 'Issue formal warning?', button: 'Issue warning', description: 'The Seller will receive this reason. Product and account access will not change.' },
  'restrict-product': { title: 'Restrict this Product?', button: 'Restrict Product', description: 'The listing becomes unavailable to Buyers and the Seller cannot publish or unarchive it.' },
  'revoke-product-restriction': { title: 'Remove Product restriction?', button: 'Remove restriction', description: 'The restriction is removed, but the Product will not be republished automatically.' },
  'suspend-seller': { title: 'Suspend this Seller?', button: 'Suspend Seller', description: 'The Seller loses protected access and all active listings become unavailable to Buyers.' },
  close: { title: 'Close compliance case?', button: 'Close case', description: 'The committed actions remain active and immutable. Closing only ends the review.' },
}

export function ComplianceActionDialog({ action, complianceCase, isSubmitting, error, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const titleId = useId()
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!action) return
    setReason('')
    setConfirmation('')
    setIdempotencyKey(crypto.randomUUID())
    window.setTimeout(() => reasonRef.current?.focus(), 0)
  }, [action])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && action && !isSubmitting) onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [action, isSubmitting, onClose])

  if (!action) return null
  const details = copy[action]
  const identity = `${complianceCase.seller.email}/seller`
  const valid = reason.trim().length >= 3 && (action !== 'suspend-seller' || confirmation === identity)
  const target = complianceCase.product ? `${complianceCase.product.name} · ${complianceCase.seller.name}` : complianceCase.seller.name

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4">
      <div aria-labelledby={titleId} aria-modal="true" className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#17111d]" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <FaTriangleExclamation aria-hidden="true" className="mt-1 shrink-0 text-rose-600" />
            <div><h2 className="text-lg font-semibold" id={titleId}>{details.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400"><strong className="text-slate-800 dark:text-slate-200">{target}</strong>. {details.description}</p></div>
          </div>
          <button aria-label="Close confirmation" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" disabled={isSubmitting} onClick={onClose} type="button"><FaXmark /></button>
        </div>

        <label className="mt-5 block text-sm font-medium" htmlFor="compliance-action-reason">Reason <span className="text-rose-600">*</span>
          <textarea ref={reasonRef} className="mt-2 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10" id="compliance-action-reason" maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder={action === 'warn' || action === 'restrict-product' || action === 'suspend-seller' ? 'This reason will be visible to the Seller' : 'Record why this action is appropriate'} value={reason} />
        </label>

        {action === 'suspend-seller' && <label className="mt-5 block text-sm font-medium" htmlFor="seller-suspension-confirmation">Type <code className="select-all break-all font-mono text-rose-700 dark:text-rose-300">{identity}</code> to confirm <span className="text-rose-600">*</span>
          <input autoComplete="off" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-pink-500/10" id="seller-suspension-confirmation" onChange={(event) => setConfirmation(event.target.value)} spellCheck={false} value={confirmation} />
        </label>}

        {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-300" role="alert">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5" disabled={isSubmitting} onClick={onClose} type="button">Cancel</button>
          <button className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${action === 'warn' || action === 'dismiss' || action === 'close' ? 'bg-[#4C1268] hover:bg-[#37104b]' : action === 'revoke-product-restriction' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'}`} disabled={isSubmitting || !valid} onClick={() => onConfirm(reason.trim(), idempotencyKey, action === 'suspend-seller' ? confirmation : undefined)} type="button">{isSubmitting ? 'Saving…' : details.button}</button>
        </div>
      </div>
    </div>
  )
}
