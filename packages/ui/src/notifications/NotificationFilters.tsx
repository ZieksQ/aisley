'use client'

import { useId } from 'react'
import { notificationCategoryOptions, type NotificationCategoryOption, type NotificationRole } from './categories'
import './notifications.css'

export type NotificationStatus = 'all' | 'unread' | 'read'
export type NotificationCategory = string

export function NotificationFilters({
  role, status, category, categories, palette, onStatusChange, onCategoryChange,
}: {
  role: NotificationRole
  status: NotificationStatus
  category: NotificationCategory
  categories?: readonly NotificationCategoryOption[]
  palette?: 'purple' | 'blue'
  onStatusChange: (status: NotificationStatus) => void
  onCategoryChange: (category: NotificationCategory) => void
}) {
  const id = useId()
  return (
    <div className="aisley-notifications notification-filters" data-role={palette === 'blue' ? 'logistics' : role}>
      <div className="notification-status-options" role="group" aria-label="Notification status">
        {(['all', 'unread', 'read'] as const).map(value => <button key={value} type="button"
          aria-pressed={value === status} onClick={() => onStatusChange(value)}>
          {value === 'all' ? 'All' : value === 'unread' ? 'Unread' : 'Read'}
        </button>)}
      </div>
      <div className="notification-category-select">
        <label htmlFor={id}>Category</label>
        <select id={id} value={category} onChange={event => onCategoryChange(event.target.value)}>
          <option value="all">All categories</option>
          {(categories ?? notificationCategoryOptions(role)).map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </div>
    </div>
  )
}
