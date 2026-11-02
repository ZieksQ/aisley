import type { CourierAssignmentVehicle } from '../types/vehicles'

const vehicleLabels: Record<CourierAssignmentVehicle['vehicle_type'], string> = {
  motorcycle: 'Motorcycle',
  car: 'Car',
  van: 'Van',
  truck: 'Truck',
}

export function courierVehicleLabel(vehicle: CourierAssignmentVehicle | null | undefined): string {
  if (!vehicle) return 'Vehicle information unavailable'
  return `${vehicleLabels[vehicle.vehicle_type]} · ${vehicle.plate_number}`
}
