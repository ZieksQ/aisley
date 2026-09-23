export type LinehaulTrip = {
  id: string
  direction: 'outbound' | 'return'
  status: 'pending_acceptance' | 'scheduled' | 'rejected' | 'cancelled' | 'in_transfer' | 'receiving' | 'received'
  from_hub: { id: string; name: string | null }
  to_hub: { id: string; name: string | null }
  truck: { id: string; plate_number: string; make: string | null; model: string | null }
  driver: { id: string; name: string; contact_number: string | null }
  scheduled_for: string
  capacity_snapshot: number
  parcel_count: number
  remaining_capacity: number
  references: string[]
  empty_return: boolean
  rejection_reason: string | null
  revision: number
  can_decide: boolean
  can_depart: boolean
  can_receive: boolean
  can_schedule_return: boolean
  departed_at: string | null
  received_at: string | null
}

export type LinehaulReadyParcel = {
  shipment_id: string
  reference: string
  parcel_reference: string | null
  received_at: string | null
  revision: number
  lane_id: string | null
  lane_code: string | null
  lane_name: string | null
}

export type LinehaulLaneGroup = {
  lane_id: string | null
  lane_code: string | null
  lane_name: string | null
  parcels: LinehaulReadyParcel[]
}

export type LinehaulReadyGroup = {
  next_hub_id: string
  next_hub: string
  references: string[]
  lane_groups: LinehaulLaneGroup[]
}

export type LinehaulOverview = {
  enabled: boolean
  ready_groups: LinehaulReadyGroup[]
  trucks: Array<{ id: string; plate_number: string; make: string | null; model: string | null; max_parcels: number; revision: number }>
  drivers: Array<{ id: string; name: string }>
  outbound: LinehaulTrip[]
  inbound: LinehaulTrip[]
  visitors: LinehaulTrip[]
}

export function defaultLinehaulTime(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
