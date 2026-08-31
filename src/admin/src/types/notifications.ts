export type AdminNotification = {
  id: string
  type: string
  title: string
  summary: string
  resource_type: string | null
  resource_id: string | null
  destination: string | null
  read_at: string | null
  created_at: string | null
}

export type NotificationListResponse = {
  data: AdminNotification[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}

export type UnreadCountResponse = {
  unread_count: number
}

export type MarkNotificationReadResponse = {
  message: string
  data: AdminNotification
}
