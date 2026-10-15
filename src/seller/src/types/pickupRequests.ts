export type SellerPickupRequest = {
  id: string
  status: 'pending_logistics' | 'partially_scheduled' | 'scheduled' | string
  requested_at: string
  pickup_date: string | null
  order_count: number
  provider: null | { id: string; business_name: string }
}

export type SellerPickupRequestPage = {
  data: SellerPickupRequest[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export type SellerPickupRequestResponse = { data: SellerPickupRequest }

export function pickupDate(date: string | null) {
  return date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Date pending'
}
