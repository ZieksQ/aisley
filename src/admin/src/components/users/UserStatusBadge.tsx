import { statusLabel } from '../../lib/users'
import type { ManagedUserStatus } from '../../types/users'

const styles: Record<ManagedUserStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300',
  suspended: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  deactivated: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-300',
  pending: 'border-purple-200 bg-purple-50 text-[#4C1268] dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-200',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300',
}

export function UserStatusBadge({ status }: { status: ManagedUserStatus }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${styles[status]}`}>{statusLabel(status)}</span>
}
