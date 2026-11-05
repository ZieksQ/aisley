import type {
  FulfillmentCompletionIntent,
  FulfillmentEvidence,
  FulfillmentShipment,
  FulfillmentTask,
} from '../../types/fulfillment'

export const transitionLabels: Record<string, string> = {
  sorted_at_hub: 'Mark sorted at hub',
  picked_up_from_hub: 'Validate hub pickup',
  in_transit: 'Record in transit',
  out_for_delivery: 'Mark out for delivery',
  delivered: 'Validate delivery',
}

export const statusOptions = [
  'picked_up_from_seller',
  'received_at_hub',
  'sorted_at_hub',
  'dispatched_from_hub',
  'delivery_assigned',
  'delivery_accepted',
  'picked_up_from_hub',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

export const evidenceOptions = [
  'submitted',
  'awaiting_validation',
  'validated',
  'rejected',
]

export function human(value: string): string {
  return value.replaceAll('_', ' ')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function stateTone(value: string): string {
  if (value === 'delivered' || value === 'validated' || value === 'accepted')
    return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200'
  if (value === 'rejected')
    return 'border-red-300 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200'
  if (value === 'awaiting_validation' || value === 'submitted')
    return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200'
  return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-300'
}

export function StateLabel({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium capitalize ${stateTone(value)}`}
    >
      {human(value)}
    </span>
  )
}

export function referenceFor(record: FulfillmentShipment): string {
  return (
    record.parcel?.tracking_id ??
    record.parcel?.waybill_reference ??
    record.parcel?.order_reference ??
    record.parcel?.reference ??
    ''
  )
}

export function validEvidence(
  task: FulfillmentTask | null,
  purpose: string,
): FulfillmentEvidence[] {
  return (task?.evidence ?? []).filter(
    (item) =>
      item.purpose === purpose &&
      item.status !== 'rejected' &&
      item.status !== 'unavailable',
  )
}

export function completionFor(
  task: FulfillmentTask | null,
  evidenceId: string | undefined,
): FulfillmentCompletionIntent | null {
  return (
    task?.completion_intents?.find(
      (intent) => intent.evidence_id === evidenceId,
    ) ?? null
  )
}
