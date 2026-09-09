export type PickupStatus = 'pending_logistics' | 'partially_scheduled' | 'scheduled'

export type PickupSchedule = {
  id: string
  reference: string
  status: 'scheduled' | 'cancelled'
  courier_id: string
  starts_at: string
  ends_at: string
  timezone: 'UTC'
  revision: number
  order_ids: string[] | null
}

export type PickupOrder = {
  id: string
  reference: string
  status: string
  scheduled: boolean
  schedule: PickupSchedule | null
  waybill: { id: string; reference: string } | null
}

export type Pickup = {
  id: string
  status: PickupStatus
  shop: { name: string; pickup_area: { city_municipality: string; province: string; region: string } | null }
  order_count: number
  unscheduled_count: number
  ready_at: string
  created_at: string
  schedules?: PickupSchedule[]
  orders?: PickupOrder[]
}

export type PickupPage = { data: Pickup[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export type CourierOption = { id: string; name: string; email: string }
