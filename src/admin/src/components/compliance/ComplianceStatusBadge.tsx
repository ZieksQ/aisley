import type { ComplianceCaseStatus } from '../../types/sellerCompliance'
import { complianceStatusLabel } from '../../lib/sellerCompliance'

const styles: Record<ComplianceCaseStatus, string> = {
  open: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  confirmed: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200',
  dismissed: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
  closed: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
}

export function ComplianceStatusBadge({ status }: { status: ComplianceCaseStatus }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${styles[status]}`}>{complianceStatusLabel(status)}</span>
}
