export type NotificationStatus = 'all' | 'unread' | 'read'

export type LogisticsNotification = {
  id: string
  type: string
  title: string
  summary: string
  read_at: string | null
  created_at: string | null
  resource_type: string | null
  resource_id: string | null
  destination: string | null
}

export type NotificationPage = {
  data: LogisticsNotification[]
  links?: {
    first?: string | null
    last?: string | null
    prev?: string | null
    next?: string | null
  }
  meta?: {
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
  }
}

export type NotificationResponse = { data: LogisticsNotification }
export type UnreadCountResponse = { data: { unread_count: number } }
