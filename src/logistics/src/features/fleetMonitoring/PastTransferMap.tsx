import { useCallback, useMemo } from 'react'
import { AssignmentMap } from './AssignmentMap'
import type { FleetAssignment, AssignmentStop } from './assignmentTypes'
import type { MonitoringTrip } from './types'
import './assignments.css'

export function PastTransferMap({ trip }: { trip: MonitoringTrip }) {
  const rows = useMemo<FleetAssignment[]>(() => {
    const stop = (kind: 'origin' | 'destination', hub: MonitoringTrip['from_hub']): AssignmentStop => ({
      kind, label: hub?.name ?? 'Hub unavailable', area: '',
      latitude: hub?.latitude ?? null, longitude: hub?.longitude ?? null,
    })
    return [{
      id: trip.id, source_id: trip.id, stage: 'linehaul', status: trip.status, reference: trip.id,
      courier: trip.driver, scheduled_for: trip.scheduled_for, schedule_ends_at: null,
      schedule_reference: trip.manifest_id ?? null, updated_at: null, parcel_count: trip.parcel_count,
      truck: null, direction: trip.direction, events: {},
      stops: [stop('origin', trip.from_hub), stop('destination', trip.to_hub)],
    }]
  }, [trip])
  const select = useCallback(() => undefined, [])
  return <AssignmentMap rows={rows} selected={trip.id} onSelect={select} manifested />
}
