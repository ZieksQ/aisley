import type { SortingLane, SortingPlanVersion } from '../../types/sorting'

type Mapping = SortingPlanVersion['mappings'][number]
type Differences = { added?: Mapping[]; removed?: Mapping[]; changed?: Array<{ before: Mapping; after: Mapping }>; legacy_import?: boolean }

export function VersionMappings({ version, lanes, hubs }: {
  version: SortingPlanVersion
  lanes: SortingLane[]
  hubs: Array<{ id: string; name: string }>
}) {
  const differences = version.differences as Differences
  const destination = (mapping: Mapping) => mapping.destination_type === 'hub'
    ? `Next hub ${hubs.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'Unavailable hub'}`
    : `Postal code ${mapping.postal_code}`
  const lane = (mapping: Mapping) => lanes.find((item) => item.id === mapping.sorting_lane_id)?.code ?? 'Unavailable lane'

  return (
    <details className="text-sm">
      <summary className="cursor-pointer">Mapping differences and preserved destinations</summary>
      <ul className="mt-2 space-y-1">
        {version.mappings.map((mapping) => (
          <li key={mapping.id}>{destination(mapping)} → {lane(mapping)}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-500">
        {differences.legacy_import ? 'Imported initial configuration.' : `${differences.added?.length ?? 0} added · ${differences.removed?.length ?? 0} removed · ${differences.changed?.length ?? 0} changed`}
      </p>
      <ul className="mt-1 space-y-1 text-xs">
        {differences.added?.map((mapping) => <li key={`added-${mapping.id}`}>Added {destination(mapping)} → {lane(mapping)}</li>)}
        {differences.removed?.map((mapping) => <li key={`removed-${mapping.id}`}>Removed {destination(mapping)} → {lane(mapping)}</li>)}
        {differences.changed?.map(({ before, after }) => (
          <li key={`changed-${after.id}`}>{destination(after)}: {lane(before)} → {lane(after)}</li>
        ))}
      </ul>
    </details>
  )
}
