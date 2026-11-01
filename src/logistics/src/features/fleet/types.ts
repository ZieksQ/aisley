export type Truck = {
  id: string
  plate_number: string
  make: string | null
  model: string | null
  max_parcels: number
  reserved_or_onboard_parcels: number
  remaining_capacity: number
  is_active: boolean
  availability: string
  revision: number
  last_confirmed_hub: { name: string } | null
  active_trip: { driver: string; from_hub: string; to_hub: string; parcel_count: number } | null
}
export type Driver = { courier_id: string; name: string; email: string; can_drive_company_truck: boolean; revision: number }
export type TruckInput = { plate_number: string; make: string | null; model: string | null; max_parcels: number }
