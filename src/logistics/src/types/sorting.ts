export type SortingLane = {
  id: string
  code: string
  name: string
  type: 'standard' | 'exception'
  is_active: boolean
  position: number
  revision: number
  label_payload: string
  label_url: string
}

export type SortingItem = {
  id: string
  shipment_id: string
  reference: string
  order_reference: string | null
  status: 'pending' | 'sorted' | 'exception'
  expected_revision: number
  lane_id: string | null
  exception_code: string | null
  exception_reason: string | null
  completed_at: string | null
  destination: {
    barangay: string | null
    city_municipality: string | null
    province: string | null
    region: string | null
    postal_code: string | null
  }
}

export type SortingSession = {
  id: string
  reference: string
  status: 'open' | 'closed'
  expected_count: number
  revision: number
  opened_at: string
  closed_at: string | null
  counts: { pending: number; sorted: number; exception: number }
  items: SortingItem[]
}

export type SortingOverview = {
  context: { organization_id: string; hub_id: string; hub_name: string }
  lanes: SortingLane[]
  session: SortingSession | null
  waiting_received: number
  session_limit: number
}

export type SortingBatchResponse = {
  data: Array<{
    client_id: string
    reference: string
    status: 'sorted' | 'exception' | 'failed'
    code?: string
    message?: string
  }>
  summary: { sorted: number; exception: number; failed: number }
}
