import type { PageMeta } from './types'

export const stageLabels = { first_mile: 'First-mile', linehaul: 'Linehaul', final_mile: 'Last-mile' } as const
export type AssignmentStage = keyof typeof stageLabels
export type AssignmentStop = {
  kind: 'pickup' | 'hub' | 'origin' | 'destination' | 'delivery' | 'last_confirmed_hub'
  label: string
  area: string
  latitude: number | null
  longitude: number | null
}
export type FleetAssignment = {
  id: string
  source_id: string
  stage: AssignmentStage
  status: string
  availability?: string
  reference: string
  courier: { id: string; name: string } | null
  scheduled_for: string | null
  schedule_ends_at: string | null
  schedule_reference: string | null
  updated_at: string | null
  parcel_count: number
  truck: { id: string; plate_number: string } | null
  direction: 'outbound' | 'return' | null
  events: Record<string, string | null>
  stops: AssignmentStop[]
}
export type AssignmentList = { data: FleetAssignment[]; meta: PageMeta }

export function hasPin(stop: AssignmentStop): stop is AssignmentStop & { latitude: number; longitude: number } {
  return typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
    && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
    && Math.abs(stop.latitude) <= 90 && Math.abs(stop.longitude) <= 180
}

const statuses: Record<string, string> = {
  no_active_trip: 'No active trip', assigned: 'Pickup assigned', accepted: 'Pickup accepted', picked_up_from_seller: 'Returning to hub',
  pending_acceptance: 'Awaiting destination approval', scheduled: 'Scheduled', in_transfer: 'In transit', receiving: 'Receiving at hub',
  delivery_assigned: 'Delivery assigned', delivery_accepted: 'Delivery accepted', picked_up_from_hub: 'Collected from hub',
  in_transit: 'In transit', out_for_delivery: 'Out for delivery',
}
export const assignmentStatus = (work: FleetAssignment) => statuses[work.status] ?? 'Status unavailable'

export function assignmentDestination(work: FleetAssignment) {
  return work.stops.map((stop) => stop.area || stop.label).join(' → ')
}
