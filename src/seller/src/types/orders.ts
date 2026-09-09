export const orderStatuses = {
  placed: 'Awaiting approval',
  seller_processing: 'Processing',
  ready_for_pickup: 'Ready for pickup',
  pending_payment: 'Pending payment',
  assigned: 'Received by Logistics',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  delivery_failed: 'Delivery failed',
  return_requested: 'Return requested',
  returned: 'Returned',
} as const

export type SellerOrder = {
  id: string
  reference: string
  status: keyof typeof orderStatuses
  placed_at: string
  latest_activity_at: string
  payment: { method: string; status: string }
  items: Array<{
    id: string; product_id: string | null; variant_id: string | null
    product_name: string; variant_name: string | null; sku: string | null
    selected_options: Array<{ group: string; value: string }>
    unit_price: string; quantity: number; line_subtotal: string; currency: string
  }>
  delivery_address: null | {
    recipient_name: string; contact_number: string; address_line_1: string
    address_line_2: string | null; barangay: string; city_municipality: string
    province: string; region: string; postal_code: string | null; country: string
  }
  totals: {
    merchandise_subtotal: string; shipping_fee: string; discount: string
    shipping_discount: string; payable: string; currency: string
  }
  status_history: Array<{
    id: string; from_status: SellerOrder['status'] | null
    to_status: SellerOrder['status']; occurred_at: string
  }>
  capabilities: { can_approve: boolean; can_reject: boolean; can_prepare: boolean; can_view_waybill: boolean }
  pickup: null | {
    request_id: string; status: string; pickup_date: string | null; logistics_organization_id: string | null
    schedule: null | { id: string; reference: string; status: string; starts_at: string; ends_at: string; timezone: string }
  }
  waybill: null | { id: string; reference: string; created_at: string; pdf_url: string }
  notification: null | { id: string; read_at: string | null }
}

export type SellerOrderPage = {
  data: SellerOrder[]
  meta: { current_page: number; last_page: number; total: number }
  status_counts: Partial<Record<SellerOrder['status'], number>>
}

export function orderStatusLabel(status: string) {
  return orderStatuses[status as SellerOrder['status']] ?? status.replaceAll('_', ' ')
}

export function orderMoney(value: string, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value))
}

export function orderDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
