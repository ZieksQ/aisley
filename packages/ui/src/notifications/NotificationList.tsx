import { LuBell, LuRefreshCw } from 'react-icons/lu'
import { NotificationRow } from './NotificationRow'
import type { NotificationRole } from './categories'
import type { NotificationActionRenderer, NotificationItem } from './types'

export type NotificationListProps<T extends NotificationItem> = {
  items: readonly T[]
  role: NotificationRole
  loading?: boolean
  error?: string | null
  emptyTitle?: string
  emptyDescription?: string
  compact?: boolean
  pendingId?: string | null
  onRetry?: () => void
  onOpen?: () => void
  renderAction: NotificationActionRenderer<T>
}

export function NotificationList<T extends NotificationItem>({
  items, role, loading, error, emptyTitle = 'No notifications yet',
  emptyDescription = 'Updates addressed to you will appear here.', compact,
  pendingId, onRetry, onOpen, renderAction,
}: NotificationListProps<T>) {
  return (
    <div className="notification-list" aria-busy={Boolean(loading)}>
      {error && <div className="notification-error" role="alert">
        <p>{error}</p>
        {onRetry && <button className="notification-button" type="button" onClick={onRetry} disabled={loading}>
          <LuRefreshCw aria-hidden="true" /> Try again
        </button>}
      </div>}
      {loading && items.length === 0 ? <div role="status" aria-label="Loading notifications">
        <span className="sr-only">Loading notifications…</span>
        {[0, 1, 2].map(index => <div className="notification-skeleton" aria-hidden="true" key={index}>
          <span /><span /><span />
        </div>)}
      </div> : items.length > 0 ? <ul className="notification-rows">
        {items.map(item => <NotificationRow key={item.id} item={item} role={role} compact={compact}
          pending={pendingId === item.id} renderAction={renderAction} onOpen={onOpen} />)}
      </ul> : !error && <div className="notification-empty" role="status">
        <LuBell aria-hidden="true" />
        <p className="notification-empty-title">{emptyTitle}</p>
        <p>{emptyDescription}</p>
      </div>}
    </div>
  )
}
