import { csrf, request, requestWithTimeout } from '../../lib/api'
import type {
  FulfillmentQueueResponse,
  FulfillmentRecordResponse,
} from '../../types/fulfillment'

export function fetchParcelQueue(query: URLSearchParams) {
  return requestWithTimeout<FulfillmentQueueResponse>(
    `/api/v1/logistics/dashboard/queue?${query}`,
  )
}

export function fetchParcelRecord(reference: string) {
  return requestWithTimeout<FulfillmentRecordResponse>(
    `/api/v1/logistics/update-status/records/${encodeURIComponent(reference)}`,
  )
}

export async function commitParcelTransition(body: string, key: string) {
  await csrf()
  return request<FulfillmentRecordResponse>(
    '/api/v1/logistics/update-status/transitions',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body,
    },
  )
}
