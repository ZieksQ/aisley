export function PickupStatus({ status }: { status: string }) {
  const collected = status === 'picked_up'
  const partial = status === 'partially_picked_up'
  const scheduled = status === 'scheduled'
  return (
    <span className={`portal-tag ${scheduled || collected ? 'portal-tag-success' : ''}`}
      title={status === 'partially_scheduled' ? 'Partially scheduled; waiting for Logistics to schedule the remaining parcels.' : undefined}>
      {collected ? 'Picked up' : partial ? 'Partially picked up' : scheduled ? 'Scheduled' : 'Request'}
    </span>
  )
}
