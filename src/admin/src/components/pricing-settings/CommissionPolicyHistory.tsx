import { useMemo, useState } from 'react'
import { FaArrowDown, FaArrowUp, FaRotate } from 'react-icons/fa6'
import type { CommissionPolicy, CommissionPolicyStatus } from '../../types/pricingSettings'
import { formatDate, panelClass, secondaryButtonClass } from './ui'

type SortKey = 'beneficiary_type' | 'rate_basis_points' | 'status' | 'effective_at' | 'ends_at'
const pageSize = 10
const statuses: Record<CommissionPolicyStatus, { rank: number; className: string }> = {
  active: { rank: 0, className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200' },
  scheduled: { rank: 1, className: 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200' },
  inactive: { rank: 2, className: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300' },
  expired: { rank: 3, className: 'bg-rose-50 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200' },
}

type Props = {
  policies: CommissionPolicy[]
  canManage: boolean
  busy: boolean
  onPublish: (policy: CommissionPolicy) => void
  onRefresh: () => void
}

export function CommissionPolicyHistory({ policies, canManage, busy, onPublish, onRefresh }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('effective_at')
  const [ascending, setAscending] = useState(false)
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => [...policies].sort((first, second) => {
    const value = (policy: CommissionPolicy) => sortKey === 'status' ? statuses[policy.status].rank
      : sortKey === 'effective_at' || sortKey === 'ends_at' ? policy[sortKey] ? new Date(policy[sortKey]).getTime() : 0 : policy[sortKey]
    const a = value(first)
    const b = value(second)
    const compared = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b)
    return (ascending ? compared : -compared) || second.created_at.localeCompare(first.created_at) || first.id.localeCompare(second.id)
  }), [policies, sortKey, ascending])
  const lastPage = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, lastPage)
  const start = (currentPage - 1) * pageSize

  function sort(key: SortKey) {
    setAscending(key === sortKey ? !ascending : key !== 'effective_at' && key !== 'ends_at')
    setSortKey(key)
    setPage(1)
  }

  function heading(label: string, key: SortKey) {
    return <th aria-sort={key === sortKey ? ascending ? 'ascending' : 'descending' : 'none'} className="px-4 py-3 font-semibold" scope="col">
      <button aria-label={`Sort by ${label.toLowerCase()}`} className="inline-flex min-h-10 items-center gap-2 rounded px-1 text-left hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] dark:hover:text-white" onClick={() => sort(key)} type="button">
        {label}{key === sortKey ? ascending ? <FaArrowUp aria-hidden="true" /> : <FaArrowDown aria-hidden="true" /> : null}
      </button>
    </th>
  }

  return <div className="mt-8">
    <div className="flex items-center justify-between gap-4"><h4 className="font-semibold">Policy history</h4><button aria-label="Refresh commission policy history" className={secondaryButtonClass} disabled={busy} onClick={onRefresh} type="button"><FaRotate aria-hidden="true" />Refresh</button></div>
    <div aria-label="Commission policy history" className={`${panelClass} mt-3 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A]`} role="region" tabIndex={0}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-400"><tr>
          {heading('Beneficiary', 'beneficiary_type')}{heading('Rate', 'rate_basis_points')}{heading('Status', 'status')}{heading('Effective', 'effective_at')}{heading('Ends', 'ends_at')}
          <th className="px-4 py-3 text-right font-semibold" scope="col">Action</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/10">{sorted.slice(start, start + pageSize).map((policy) => <tr key={policy.id}>
          <td className="px-4 py-3 font-semibold capitalize">{policy.beneficiary_type}</td>
          <td className="px-4 py-3 tabular-nums">{(policy.rate_basis_points / 100).toFixed(2)}%</td>
          <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statuses[policy.status].className}`}>{policy.status}</span></td>
          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{policy.effective_at ? formatDate(policy.effective_at) : 'No schedule'}</td>
          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{policy.ends_at ? formatDate(policy.ends_at) : '—'}</td>
          <td className="px-4 py-3 text-right">{canManage && policy.can_publish ? <button aria-label={`Publish ${policy.beneficiary_type} commission at ${(policy.rate_basis_points / 100).toFixed(2)}%`} className={secondaryButtonClass} disabled={busy} onClick={() => onPublish(policy)} type="button">Publish</button> : <span className="text-slate-400">—</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <nav aria-label="Commission policy pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
      <p aria-live="polite">{sorted.length ? start + 1 : 0}–{Math.min(start + pageSize, sorted.length)} of {sorted.length} policies</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className={secondaryButtonClass} disabled={currentPage === 1 || busy} onClick={() => setPage(currentPage - 1)} type="button">Previous</button>
        <span>Page {currentPage} of {lastPage}</span>
        <button className={secondaryButtonClass} disabled={currentPage === lastPage || busy} onClick={() => setPage(currentPage + 1)} type="button">Next</button>
      </div>
    </nav>
  </div>
}
