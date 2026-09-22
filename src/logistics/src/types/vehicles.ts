export type VehicleDocument = { id: string; url: string }

export type CourierVehicle = {
  id: string
  vehicle_type: 'motorcycle' | 'car' | 'van' | 'truck'
  plate_number: string
  make: string | null
  model: string | null
  revision: number
  official_receipt: VehicleDocument | null
  certificate_of_registration: VehicleDocument | null
}

export type CourierVehicleResponse = { data: CourierVehicle }

export type CourierVehicleSummary = {
  courier: { id: string; name: string; email: string }
  vehicle: {
    id: string
    vehicle_type: CourierVehicle['vehicle_type']
    plate_number: string
    make: string | null
    model: string | null
    revision: number
    official_receipt_uploaded: boolean
    certificate_of_registration_uploaded: boolean
  }
}

export type CourierVehiclePageResponse = {
  data: CourierVehicleSummary[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}
