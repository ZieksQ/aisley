import { useEffect, useRef, useState } from 'react'
import { downloadReportCsv, ReportDownloadError } from './download-report'

/** Bounded, authenticated report download with explicit paging and recoverable errors. */
export function ReportCsvExport({ url, total, onAccessLost }: { url: string; total: number; onAccessLost?: () => void }) {
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const pages = Math.max(1, Math.ceil(total / 100))
  useEffect(() => () => active.current?.abort(), [])
  const href = `${url}&page=${page}`

  async function download() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    try {
      await downloadReportCsv(href, `aisley-finance-ledger-page-${page}.csv`, controller.signal)
    } catch (cause) {
      if (cause instanceof ReportDownloadError && [401, 403].includes(cause.status)) onAccessLost?.()
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The CSV could not be downloaded.')
    } finally {
      if (!controller.signal.aborted) { setBusy(false); active.current = null }
    }
  }

  return <div className="report-csv-export">
    {pages > 1 && <label>Export page<input type="number" min={1} max={pages} value={page} disabled={busy} onChange={(event) => setPage(Math.max(1, Math.min(pages, Number(event.target.value) || 1)))} /><span>of {pages}</span></label>}
    <a href={href} aria-disabled={busy} onClick={(event) => { event.preventDefault(); void download() }}>{busy ? 'Downloading CSV…' : 'Export CSV · up to 100 journals'}</a>
    {error && <p role="alert">{error}</p>}
  </div>
}
