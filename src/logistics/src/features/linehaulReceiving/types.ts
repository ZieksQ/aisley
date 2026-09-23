export type Receipt = { receipt_id: string; reference: string; condition: 'good' | 'damaged'; committed_at: string }
export type ReceivingDetail = {
  trip_id: string
  manifest_id: string | null
  status: string
  historical_receipt: boolean
  from_hub: string
  to_hub: string
  arrived_at: string | null
  closed_at: string | null
  outcome: string | null
  counts: { expected: number; received: number; outstanding: number; damaged: number; open_discrepancies: number }
  items: Array<{ shipment_id: string; reference: string; receipt: Receipt | null }>
  discrepancies: Array<{ id: string; reference: string; kind: 'missing' | 'damaged' | 'unexpected'; reason: string | null; resolved_at: string | null; resolution_reason: string | null }>
}
export type Capture = { client_id: string; reference: string; condition: 'good' | 'damaged'; source: 'barcode' | 'manual'; captured_at: string; reason: string | null }
export type PendingCapture = Capture & { scope: string; error?: string }
