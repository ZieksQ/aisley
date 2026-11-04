'use client'

import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LuArrowRight, LuBell, LuRefreshCw, LuX } from 'react-icons/lu'
import { NotificationList, type NotificationListProps } from './NotificationList'
import type { NotificationActionProps, NotificationItem } from './types'
import { useNotificationPopover } from './useNotificationPopover'
import './notifications.css'

export function NotificationPopover<T extends NotificationItem>({
  unreadCount, hasUnread = false, triggerVariant = 'portal', onRefresh, renderViewAll, ...list
}: NotificationListProps<T> & {
  unreadCount: number | null
  hasUnread?: boolean
  triggerVariant?: 'portal' | 'storefront'
  onRefresh: () => void
  renderViewAll: (props: NotificationActionProps) => ReactNode
}) {
  const { trigger, panel, open, setOpen, close, position, keyboardOpening } = useNotificationPopover()
  const titleId = useId()
  const panelId = useId()
  const status = unreadCount === null ? 'Unread count unavailable' : `${unreadCount} unread`
  return (
    <div className="aisley-notifications notification-bell" data-role={list.role}>
      <button ref={trigger} className="notification-trigger" data-variant={triggerVariant} type="button"
        aria-label={`Notifications, ${status}`} aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog"
        onClick={event => {
          keyboardOpening.current = event.detail === 0
          setOpen(!open)
          if (!open) onRefresh()
        }}>
        <LuBell aria-hidden="true" />
        {unreadCount !== null && unreadCount > 0 ? <span className="notification-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
          : hasUnread ? <span className="notification-badge" aria-hidden="true">●</span> : null}
      </button>
      {open && createPortal(
        <div ref={panel} id={panelId} tabIndex={-1} role="dialog" aria-labelledby={titleId}
          className="aisley-notifications notification-popover" data-role={list.role} style={position}>
          <header className="notification-popover-heading">
            <div><h2 id={titleId}>Notifications</h2><p role="status">{status}</p></div>
            <div className="notification-heading-actions">
              <button type="button" className="notification-icon-button" aria-label="Refresh notifications" disabled={list.loading} onClick={onRefresh}><LuRefreshCw aria-hidden="true" /></button>
              <button type="button" className="notification-icon-button" aria-label="Close notifications" onClick={() => close(true)}><LuX aria-hidden="true" /></button>
            </div>
          </header>
          <div className="notification-popover-scroll">
            <NotificationList {...list} compact onRetry={onRefresh} onOpen={() => close()} />
          </div>
          <footer className="notification-popover-footer">
            {renderViewAll({ className: 'notification-view-all', onClick: () => close(), children: <>View all notifications <LuArrowRight aria-hidden="true" /></> })}
          </footer>
        </div>, document.body,
      )}
    </div>
  )
}
