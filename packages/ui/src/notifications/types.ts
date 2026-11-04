import type { ReactNode } from 'react'

/** Safe inbox presentation; routing and private resource data stay with the app. */
export type NotificationItem = {
  id: string
  title: string
  summary: string
  category?: string | null
  category_label?: string | null
  created_at: string | null
  read_at: string | null
}

export type NotificationActionProps = {
  children: ReactNode
  className: string
  onClick?: () => void
  'aria-busy'?: boolean
}

export type NotificationActionRenderer<T extends NotificationItem> = (
  item: T,
  props: NotificationActionProps,
) => ReactNode
