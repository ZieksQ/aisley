'use client'

import type { ReactNode } from 'react'
import { PortalPagination } from '../portal/WorkspaceControls'
import { NotificationFilters, type NotificationStatus } from './NotificationFilters'
import { NotificationList, type NotificationListProps } from './NotificationList'
import { notificationCategoryOptions, type NotificationCategoryOption } from './categories'
import type { NotificationItem } from './types'
import './notifications.css'

export function NotificationCenter<T extends NotificationItem>({
  description, actions, headingLevel = 1, status, category, categories, total, page, lastPage,
  onStatusChange, onCategoryChange, onPageChange, ...list
}: NotificationListProps<T> & {
  description?: string
  actions?: ReactNode
  headingLevel?: 1 | 2
  status: NotificationStatus
  category: string
  categories?: readonly NotificationCategoryOption[]
  total?: number
  page: number
  lastPage: number
  onStatusChange: (value: NotificationStatus) => void
  onCategoryChange: (value: string) => void
  onPageChange: (page: number) => void
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const categoryName = (categories ?? notificationCategoryOptions(list.role)).find(option => option.key === category)?.label ?? 'Other'
  const emptyTitle = `No ${status === 'all' ? '' : `${status} `}notifications${category === 'all' ? ' yet' : ` in ${categoryName}`}`
  return (
    <section className="aisley-notifications notification-center" data-role={list.role}>
      <header className="notification-center-heading">
        <div><Heading>Notifications</Heading>{description && <p>{description}</p>}</div>
        {actions && <div className="notification-heading-actions">{actions}</div>}
      </header>
      <div className="notification-inbox">
        <NotificationFilters role={list.role} status={status} category={category} categories={categories}
          onStatusChange={onStatusChange} onCategoryChange={onCategoryChange} />
        <p className="notification-result-count" role="status">
          {list.loading ? 'Loading notifications…' : list.error ? 'Notifications could not be refreshed' : total === undefined ? `${list.items.length} notifications on this page` : `${total} notification${total === 1 ? '' : 's'}`}
        </p>
        <NotificationList {...list} emptyTitle={list.emptyTitle ?? emptyTitle} />
      </div>
      {!list.error && <PortalPagination page={page} lastPage={lastPage} disabled={list.loading} onPage={onPageChange} />}
    </section>
  )
}
