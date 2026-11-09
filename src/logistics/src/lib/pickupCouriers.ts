import { request } from './api'
import { toUtc, type ScheduleWindow } from './pickupSchedule'
import type { CourierAvailabilityOption } from '../types/pickups'

export type PickupCouriersResponse = { data: CourierAvailabilityOption[] }

export function getPickupCouriers(window?: ScheduleWindow, excludeScheduleId?: string): Promise<PickupCouriersResponse> {
  const params = new URLSearchParams()
  const startsAt = window?.startDateTime ? toUtc(window.startDateTime) : ''

  if (startsAt) {
    params.set('starts_at', startsAt)
  }
  if (excludeScheduleId) params.set('exclude_schedule_id', excludeScheduleId)

  const query = params.toString()
  return request<PickupCouriersResponse>(`/api/v1/logistics/pickup-couriers${query ? `?${query}` : ''}`)
}
