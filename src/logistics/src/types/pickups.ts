export type PickupStatus = 'pending_logistics' | 'partially_scheduled' | 'scheduled'

export type PickupSchedule = {
  id: string
  reference: string
  status: 'scheduled' | 'completed' | 'cancelled'
  courier_id: string
  starts_at: string
  ends_at: string
  timezone: 'UTC'
  revision: number
  order_ids: string[] | null
}

export type PickupScheduleSummary = PickupSchedule & {
  courier: CourierOption
  pickup_requests: Array<{ id: string; shop: { id: string; name: string }; created_at: string; parcel_count: number }>
  parcel_count: number
  remaining_parcel_count: number
  created_at: string
}

export type PickupOrder = {
  id: string
  reference: string
  status: string
  pickup_area: PickupArea | null
  scheduled: boolean
  schedule: PickupSchedule | null
  waybill: { id: string; reference: string } | null
}

export type PickupArea = { city_municipality: string; province: string; region: string }

export type Pickup = {
  id: string
  status: PickupStatus
  shop: { id: string; name: string; pickup_area: PickupArea | null; pickup_areas: PickupArea[] }
  order_count: number
  unscheduled_count: number
  ready_at: string
  created_at: string
  schedules?: PickupSchedule[]
  orders?: PickupOrder[]
}

export type PickupPage = { data: Pickup[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export type PickupSchedulePage = { data: PickupScheduleSummary[]; meta: PickupPage['meta'] }
export type CourierOption = { id: string; name: string; email: string }
