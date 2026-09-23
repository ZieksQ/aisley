import { csrf, requestWithTimeout } from '../../lib/api'
import type { Capture, ReceivingDetail } from './types'

type BatchResult = {
  results: Array<{ client_id: string; status: 'received' | 'unexpected' | 'failed'; message?: string }>
  receiving: ReceivingDetail
}

const path = (trip: string) => `/api/v1/logistics/linehaul/trips/${trip}/receiving`

export async function getReceiving(trip: string) {
  return (await requestWithTimeout<{ data: ReceivingDetail }>(path(trip))).data
}

export async function receivingAction(trip: string, action: string, body: object) {
  await csrf()
  const response = await requestWithTimeout<{ data: ReceivingDetail }>(`${path(trip)}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return response.data
}

export async function syncReceiving(trip: string, captures: Capture[]) {
  await csrf()
  const response = await requestWithTimeout<{ data: BatchResult }>(`${path(trip)}/batches`, {
    method: 'POST',
    body: JSON.stringify({ captures }),
  })
  return response.data
}
