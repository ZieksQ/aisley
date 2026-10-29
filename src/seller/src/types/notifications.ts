export type SellerNotificationSchedule = {
  id: string
  reference: string | null
  starts_at: string | null
  ends_at: string | null
  timezone: string
  order_count: number | null
  pickup_area: null | {
    city_municipality: string | null
    province: string | null
    region: string | null
  }
}

export type SellerNotification = {
  id: string
  type: string
  title: string
  summary: string
  category?: string | null
  category_label?: string | null
  resource_type?: string | null
  resource_id?: string | null
  read_at: string | null
  created_at: string
  destination: string
  schedule: SellerNotificationSchedule | null
}

export type SellerNotificationResponse = {
  data: SellerNotification[]
  meta: {
    current_page: number
    last_page: number
    total: number
    categories?: { key: string; label: string }[]
  }
}
