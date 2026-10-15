export function PickupStatus({ status }: { status: string }) {
  const scheduled = status === 'scheduled'
  return (
    <span className={`portal-tag ${scheduled ? 'portal-tag-success' : ''}`}
      title={status === 'partially_scheduled' ? 'Partially scheduled; waiting for Logistics to schedule the remaining parcels.' : undefined}>
      {scheduled ? 'Scheduled' : 'Request'}
    </span>
  )
}
