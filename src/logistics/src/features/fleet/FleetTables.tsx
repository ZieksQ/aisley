import { PortalButton, PortalState, PortalTable } from '@aisley/ui/portal'
import type { Driver, Truck } from './types'

export function FleetTrucks({ trucks, busy, onEdit, onToggle }: { trucks: Truck[]; busy: boolean; onEdit: (truck: Truck) => void; onToggle: (truck: Truck) => void }) {
  if (!trucks.length) return <PortalState
    title="No company trucks registered"
    description="Register a company-owned truck to make it available for linehaul operations." />
  return <PortalTable label="Company-owned trucks">
    <thead>
      <tr>
        <th scope="col">
          Truck
        </th>
        <th scope="col">
          Availability / location
        </th>
        <th scope="col">
          Parcel capacity
        </th>
        <th scope="col">
          Current trip
        </th>
        <th scope="col">
          Actions
        </th>
      </tr>
    </thead>
    <tbody>
      {trucks.map((truck) => <tr key={truck.id}>
        <td>
          <span className="font-medium whitespace-nowrap">{truck.plate_number}</span>
          <span className="portal-table-meta">{[truck.make, truck.model].filter(Boolean).join(' ') || 'Make/model not set'}</span>
          <span className={`portal-tag mt-1 ${truck.is_active ? 'portal-tag-brand' : ''}`}>{truck.is_active ? 'Active' : 'Inactive'}</span>
        </td>
        <td>
          <span className={`portal-tag capitalize ${truck.availability === 'available' ? 'portal-tag-success' : ''}`}>{truck.availability.replaceAll('_', ' ')}</span>
          <span className="portal-table-meta">{truck.last_confirmed_hub?.name ?? 'In transit'}</span>
        </td>
        <td>
          <span className="font-medium whitespace-nowrap">{truck.reserved_or_onboard_parcels} / {truck.max_parcels}</span>
          <span className="portal-table-meta">{truck.remaining_capacity} remaining</span>
        </td>
        <td className="portal-table-name">
          {truck.active_trip ? <><span>{truck.active_trip.from_hub} → {truck.active_trip.to_hub}</span><span className="portal-table-meta">{truck.active_trip.driver} · {truck.active_trip.parcel_count} parcels</span></> : <span className="portal-secondary">No active trip</span>}
        </td>
        <td>
          <div className="portal-inline-actions flex-nowrap">
            <PortalButton disabled={busy} onClick={() => onEdit(truck)}>
              Edit
              <span className="sr-only"> {truck.plate_number}</span>
            </PortalButton>
            <PortalButton variant="ghost" disabled={busy} onClick={() => onToggle(truck)}>
              {truck.is_active ? 'Deactivate' : 'Activate'}
              <span className="sr-only"> {truck.plate_number}</span>
            </PortalButton>
          </div>
        </td>
      </tr>)}
    </tbody>
  </PortalTable>
}

export function FleetDrivers({ drivers, busy, onToggle }: { drivers: Driver[]; busy: boolean; onToggle: (driver: Driver) => void }) {
  if (!drivers.length) return <PortalState
    title="No eligible drivers"
    description="Approved, active Couriers appear here. Enable company-truck capability before assigning them a truck." />
  return <PortalTable label="Company truck driver capabilities">
    <thead>
      <tr>
        <th scope="col">
          Courier
        </th>
        <th scope="col">
          Company-truck capability
        </th>
      </tr>
    </thead>
    <tbody>
      {drivers.map((driver) => <tr key={driver.courier_id}>
        <td className="portal-table-name">
          <span className="font-medium">{driver.name}</span>
          <span className="portal-table-meta">{driver.email}</span>
        </td>
        <td>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input
            type="checkbox"
            className="size-5 accent-[var(--brand-primary)]"
            checked={driver.can_drive_company_truck}
            disabled={busy}
            onChange={() => onToggle(driver)} /><span>{driver.can_drive_company_truck ? 'Enabled' : 'Not enabled'}<span className="sr-only"> · Can drive company trucks · {driver.name}</span></span></label>
        </td>
      </tr>)}
    </tbody>
  </PortalTable>
}
