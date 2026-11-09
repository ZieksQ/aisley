export const availabilityLabels = {
  available: 'Available', reserved: 'Reserved', in_transit: 'In transit',
  unloading: 'Unloading', visiting: 'Visiting', inactive: 'Inactive',
} as const
export type Availability = keyof typeof availabilityLabels
export type Hub = { id: string; name: string | null; logistics?: { id: string; name: string } | null; latitude?: number | null; longitude?: number | null }
export type MonitoringTrip = {
  id: string
  manifest_id?: string | null
  direction: 'outbound' | 'return'
  status: 'pending_acceptance' | 'scheduled' | 'in_transfer' | 'receiving' | 'received' | 'rejected' | 'cancelled'
  from_hub: Hub | null
  to_hub: Hub | null
  driver: { id: string; name: string } | null
  parcel_count: number
  capacity_snapshot: number
  scheduled_for: string | null
  overdue: boolean
  decided_at: string | null
  released_for_departure_at: string | null
  departed_at: string | null
  courier_arrived_at: string | null
  arrived_at: string | null
  unloading_closed_at: string | null
  received_at: string | null
}
export type MonitoringTruck = {
  id: string; plate_number: string; make: string | null; model: string | null
  is_active: boolean; availability: Availability
  home_hub: Hub | null; last_confirmed_hub: Hub | null
  max_parcels: number; reserved_or_onboard_parcels: number; remaining_capacity: number
  active_trip: MonitoringTrip | null
}
export type Meta = { server_time: string }
export type PageMeta = Meta & { current_page: number; last_page: number; per_page: number; total: number }
export type MonitoringList = { data: MonitoringTruck[]; meta: PageMeta & { summary: Record<Availability, number> } }
export type MonitoringHistory = { data: MonitoringTrip[]; meta: PageMeta }
export const tripLabels: Record<MonitoringTrip['status'], string> = {
  pending_acceptance: 'Awaiting approval', scheduled: 'Scheduled', in_transfer: 'In transit',
  receiving: 'Receiving', received: 'Unloading closed', rejected: 'Rejected', cancelled: 'Cancelled',
}
export function manilaTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value)) : 'Not recorded'
}
export function pageNumber(value: string | null) {
  return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1
}
