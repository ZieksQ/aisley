export type VehicleDocument = { id: string; url: string }

export type CourierVehicle = {
  id: string
  vehicle_type: 'motorcycle' | 'car' | 'van'
  plate_number: string
  make: string | null
  model: string | null
  revision: number
  official_receipt: VehicleDocument | null
  certificate_of_registration: VehicleDocument | null
}

export type CourierVehicleResponse = { data: CourierVehicle }
