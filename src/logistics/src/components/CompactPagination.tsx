export const COMPACT_PAGE_SIZE = 8

export function CompactPagination({ label, page, total, onPageChange }: {
  label: string
  page: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / COMPACT_PAGE_SIZE))
  if (pages === 1) return null

  return <nav aria-label={label + ' pagination'} className="flex items-center justify-between gap-2 border-t border-zinc-200 px-3 py-2 text-xs dark:border-white/10">
    <span>{Math.min((page - 1) * COMPACT_PAGE_SIZE + 1, total)}–{Math.min(page * COMPACT_PAGE_SIZE, total)} of {total}</span>
    <div className="flex items-center gap-2">
      <button className="h-8 rounded-md border border-zinc-300 px-2 disabled:opacity-40 dark:border-white/15" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="h-8 rounded-md border border-zinc-300 px-2 disabled:opacity-40 dark:border-white/15" disabled={page >= pages} onClick={() => onPageChange(page + 1)} type="button">Next</button>
    </div>
  </nav>
}
