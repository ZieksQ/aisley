import { csrf, requestWithTimeout } from '../../lib/api'
import type { Driver, Truck, TruckInput } from './types'

export function loadFleet() {
  return requestWithTimeout<{ data: { trucks: Truck[]; drivers: Driver[] } }>('/api/v1/logistics/fleet')
}

export async function saveTruck(input: TruckInput, truck?: Truck) {
  await csrf()
  return requestWithTimeout(truck ? `/api/v1/logistics/fleet/trucks/${truck.id}` : '/api/v1/logistics/fleet/trucks', {
    method: truck ? 'PATCH' : 'POST',
    body: JSON.stringify(truck ? { ...input, expected_revision: truck.revision } : input),
  })
}

export async function changeTruckState(truck: Truck) {
  await csrf()
  return requestWithTimeout(`/api/v1/logistics/fleet/trucks/${truck.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ expected_revision: truck.revision, is_active: !truck.is_active }),
  })
}

export async function changeDriverCapability(driver: Driver) {
  await csrf()
  return requestWithTimeout(`/api/v1/logistics/fleet/drivers/${driver.courier_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ expected_revision: driver.revision, can_drive_company_truck: !driver.can_drive_company_truck }),
  })
}
