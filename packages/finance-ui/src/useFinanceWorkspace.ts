import { useEffect, useState } from 'react'
import type { FinanceWorkspaceData, FinanceWorkspaceProps, LedgerPage } from './types'

export function useFinanceWorkspace({ endpointPrefix, request }: FinanceWorkspaceProps, periodQuery: string, search: string, page: number) {
  const [result, setResult] = useState<{ key: string; workspace: FinanceWorkspaceData; ledger: LedgerPage } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const key = `${endpointPrefix}?${periodQuery}&search=${encodeURIComponent(search)}&page=${page}`
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const lost = () => { controller.abort(); setResult(null); setError('Your Finance access changed. Sign in again to continue.'); setLoading(false) }
    window.addEventListener('finance-access-lost', lost)
    Promise.all([
      request<{ data: FinanceWorkspaceData }>(`${endpointPrefix}/summary?${periodQuery}`, { signal: controller.signal, cache: 'no-store' }),
      request<LedgerPage>(`${endpointPrefix}/ledger?${periodQuery}&per_page=25&search=${encodeURIComponent(search)}&page=${page}`, { signal: controller.signal, cache: 'no-store' }),
    ]).then(([summary, ledger]) => {
      if (!controller.signal.aborted) setResult({ key, workspace: summary.data, ledger })
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      if ([401, 403].includes((cause as { status?: number }).status ?? 0)) {
        window.dispatchEvent(new Event('finance-access-lost'))
      } else setError(cause instanceof Error ? cause.message : 'Finance data is unavailable.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); window.removeEventListener('finance-access-lost', lost) }
  }, [endpointPrefix, request, periodQuery, search, page, key, revision])
  return { workspace: result?.key === key ? result.workspace : null, ledger: result?.key === key ? result.ledger : null, loading, error, reload: () => setRevision((value) => value + 1) }
}
