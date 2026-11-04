import { LuChevronRight } from 'react-icons/lu'
import { notificationCategoryLabel, type NotificationRole } from './categories'
import type { NotificationActionRenderer, NotificationItem } from './types'

export function notificationTimestamp(value: string | null) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
  }).format(date)
}

export function NotificationRow<T extends NotificationItem>({
  item, role, compact = false, pending = false, renderAction, onOpen,
}: {
  item: T
  role: NotificationRole
  compact?: boolean
  pending?: boolean
  renderAction: NotificationActionRenderer<T>
  onOpen?: () => void
}) {
  const unread = !item.read_at
  const validDate = item.created_at && !Number.isNaN(new Date(item.created_at).getTime())
  return (
    <li className="notification-row" data-unread={unread} data-compact={compact}>
      {renderAction(item, {
        className: 'notification-row-action',
        onClick: onOpen,
        'aria-busy': pending,
        children: <>
          <span className="notification-row-content">
            <span className="notification-row-heading">
              <span className="notification-row-title">{item.title}</span>
              <span className="notification-read-state">{unread ? 'Unread' : 'Read'}</span>
            </span>
            <span className="notification-row-summary">{item.summary}</span>
            <span className="notification-row-meta">
              <span>{notificationCategoryLabel(item.category, item.category_label, role)}</span>
              <time dateTime={validDate ? item.created_at! : undefined}>{notificationTimestamp(item.created_at)}</time>
            </span>
          </span>
          <LuChevronRight aria-hidden="true" className="notification-row-chevron" />
        </>,
      })}
    </li>
  )
}
