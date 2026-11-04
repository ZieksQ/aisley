import { PortalButton, PortalState } from '@aisley/ui/portal'
import { LuRefreshCw } from 'react-icons/lu'
import { manilaTime } from './types'

export function MonitoringRefresh({ loading, error, updatedAt, refresh }: {
  loading: boolean
  error: string
  updatedAt?: string
  refresh: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="portal-secondary text-sm" role="status">
          {updatedAt ? `Last refreshed ${manilaTime(updatedAt)} · Manila` : 'Waiting for fleet data'}
          {' · '}Refreshes every 30 seconds while visible
        </p>
        <PortalButton isLoading={loading} onClick={refresh}>
          <LuRefreshCw aria-hidden="true" />Refresh
        </PortalButton>
      </div>
      {error ? (
        <PortalState
          error title={updatedAt ? 'Displayed data is outdated' : 'Fleet monitoring unavailable'}
          description={error}
          action={<PortalButton onClick={refresh} disabled={loading}>Retry</PortalButton>}
        />
      ) : null}
    </div>
  )
}
