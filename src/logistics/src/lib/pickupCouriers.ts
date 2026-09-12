import { request } from './api'
import { toUtc, type ScheduleWindow } from './pickupSchedule'
import type { CourierAvailabilityOption } from '../types/pickups'

export type PickupCouriersResponse = { data: CourierAvailabilityOption[] }

export function getPickupCouriers(window?: ScheduleWindow, excludeScheduleId?: string): Promise<PickupCouriersResponse> {
  const params = new URLSearchParams()
  const startsAt = window && window.date && window.startTime ? toUtc(window.date, window.startTime) : ''
  const endsAt = window && window.date && window.endTime ? toUtc(window.date, window.endTime) : ''

  if (startsAt && endsAt) {
    params.set('starts_at', startsAt)
    params.set('ends_at', endsAt)
  }
  if (excludeScheduleId) params.set('exclude_schedule_id', excludeScheduleId)

  const query = params.toString()
  return request<PickupCouriersResponse>(`/api/v1/logistics/pickup-couriers${query ? `?${query}` : ''}`)
}
