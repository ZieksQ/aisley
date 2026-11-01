import { PortalState, PortalTable } from '@aisley/ui/portal'
import { manilaDate } from '../../components/PickupUi'
import type { DispatchSchedule } from './types'

export function DispatchScheduleTable({
  schedules
}: {
  schedules: DispatchSchedule[]
}) {
  return (
    <section className="transport-panel mt-6">
      <div className="transport-toolbar">
        <div>
          <h2 className="font-semibold">Recent dispatch schedules</h2>
          <p className="portal-secondary mt-1 text-sm">
            Courier assignments and stored source lanes for recent loads.
          </p>
        </div>
      </div>
      {schedules.length ? (
        <PortalTable label="Recent last-mile dispatch schedules">
          <thead>
            <tr>
              <th scope="col">Schedule</th>
              <th scope="col">Courier</th>
              <th scope="col">Scheduled for</th>
              <th scope="col">Source lanes</th>
              <th scope="col">Parcels</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id}>
                <td className="font-medium">{schedule.reference}</td>
                <td>
                  <p>{schedule.courier.name}</p>
                  <p className="portal-secondary mt-1 text-xs">
                    {schedule.courier.contact_number ?? schedule.courier.email}
                  </p>
                </td>
                <td>{manilaDate(schedule.scheduled_for)}</td>
                <td>
                  {[
                    ...new Set(
                      schedule.parcels.map(
                        (item) => item.source_lane?.code ?? 'Unassigned'
                      )
                    )
                  ].join(', ')}
                </td>
                <td>{schedule.parcel_count}</td>
              </tr>
            ))}
          </tbody>
        </PortalTable>
      ) : (
        <PortalState
          title="No dispatch schedules yet"
          description="Choose parcels and an approved Courier to create your first schedule."
        />
      )}
    </section>
  )
}
