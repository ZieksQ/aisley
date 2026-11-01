export function statusLabel(status: string | null | undefined): string {
  return (status ?? 'unknown').replaceAll('_', ' ')
}

function statusClass(status: string | null | undefined): string {
  if (status === 'approved' || status === 'verified' || status === 'active') return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300'
  if (status === 'rejected' || status === 'deactivated' || status === 'suspended') return 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-300'
  return 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300'
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <span className={`inline-block rounded-md px-2 py-1 text-xs font-medium capitalize ${statusClass(status)}`}>{statusLabel(status)}</span>
}
