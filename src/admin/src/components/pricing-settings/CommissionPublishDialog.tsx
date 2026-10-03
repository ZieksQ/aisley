import type { CommissionPolicy } from '../../types/pricingSettings'
import { CommissionDialog } from './CommissionDialog'
import { formatDate, primaryButtonClass, secondaryButtonClass } from './ui'

type Props = { policy: CommissionPolicy; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }

export function CommissionPublishDialog({ policy, busy, error, onClose, onConfirm }: Props) {
  const future = policy.effective_at && new Date(policy.effective_at).getTime() > Date.now()
  return (
    <CommissionDialog busy={busy} onClose={onClose} title="Publish commission policy?">
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Publish the <span className="capitalize">{policy.beneficiary_type}</span> commission at <strong>{(policy.rate_basis_points / 100).toFixed(2)}%</strong> {future ? `effective ${formatDate(policy.effective_at)}` : 'immediately'}?
        {' '}The current policy for this beneficiary expires when this policy takes effect. Existing Order commissions remain unchanged.
      </p>
      {error ? <p className="mt-4 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className={secondaryButtonClass} data-initial-focus disabled={busy} onClick={onClose} type="button">Cancel</button>
        <button className={primaryButtonClass} disabled={busy} onClick={onConfirm} type="button">{busy ? 'Publishing…' : 'Confirm publish'}</button>
      </div>
    </CommissionDialog>
  )
}
