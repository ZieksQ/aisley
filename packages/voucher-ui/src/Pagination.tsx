import { Button } from '@aisley/ui'
import type { Page } from './types'

export function Pagination({
  meta,
  onPage,
}: {
  meta: Page<unknown>['meta']
  onPage: (page: number) => void
}) {
  return (
    <nav aria-label="Pagination" className="voucher-pager">
      <span>
        {meta.total} results · Page {meta.current_page} of {meta.last_page}
      </span>
      <Button
        variant="outline"
        disabled={meta.current_page <= 1}
        onClick={() => onPage(meta.current_page - 1)}
      >
        Previous
      </Button>
      <Button
        variant="outline"
        disabled={meta.current_page >= meta.last_page}
        onClick={() => onPage(meta.current_page + 1)}
      >
        Next
      </Button>
    </nav>
  )
}
