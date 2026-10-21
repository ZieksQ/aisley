import { request } from '../lib/api'
import type { LinehaulRoute, LinehaulTrip } from './types'

export type LinehaulAction = 'depart' | 'arrival'

export async function confirmLinehaulAction(tripId: string, action: LinehaulAction, revision: number, token: string) {
  const response = await request<{ data: LinehaulTrip }>(`/api/v1/courier/linehaul-trips/${tripId}/${action}`, {
    method: 'POST', body: JSON.stringify({ expected_revision: revision, confirmation: true }),
  }, token)
  return response.data
}

export async function getLinehaulTrips(token: string, signal: AbortSignal) {
  const response = await request<{ data: LinehaulTrip[] }>('/api/v1/courier/linehaul-trips', { signal }, token)
  return response.data
}

export async function getLinehaulRoute(tripId: string, token: string, signal: AbortSignal) {
  const response = await request<{ data: LinehaulRoute }>(`/api/v1/courier/linehaul-trips/${tripId}/route`, { signal }, token)
  return response.data
}
