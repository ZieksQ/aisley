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
  const changes = [
    ...(differences.added ?? []).map((mapping) => ({ id: `added-${mapping.id}`, destination: destination(mapping), before: '—', after: lane(mapping), change: 'Added' })),
    ...(differences.removed ?? []).map((mapping) => ({ id: `removed-${mapping.id}`, destination: destination(mapping), before: lane(mapping), after: '—', change: 'Removed' })),
    ...(differences.changed ?? []).map(({ before, after }) => ({ id: `changed-${after.id}`, destination: destination(after), before: lane(before), after: lane(after), change: before.sorting_lane_id === after.sorting_lane_id ? 'Order changed' : 'Lane changed' })),
  ]
  return <div className="space-y-4 text-sm">

    <div role="region" aria-label="Preserved destinations table" tabIndex={0} className="max-h-64 overflow-auto border border-zinc-200 focus-visible:outline-2 dark:border-white/10">

      <table className="w-full text-left">

        <caption className="border-b border-zinc-200 px-3 py-2 text-left font-medium dark:border-white/10">
          Preserved destinations
        </caption>

        <thead className="bg-zinc-50 dark:bg-white/5">
          <tr>
            <th scope="col" className="px-3 py-2">
              Destination
            </th>
            <th scope="col" className="px-3 py-2">
              Lane
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
          {version.mappings.map((mapping) => <tr key={mapping.id}>
            <td className="break-words px-3 py-2">
              {destination(mapping)}
            </td>
            <td className="break-words px-3 py-2">
              {lane(mapping)}
            </td>
          </tr>)}
          {!version.mappings.length ? <tr>
            <td colSpan={2} className="px-3 py-3">
              No preserved destinations.
            </td>
          </tr> : null}

        </tbody>

      </table>

    </div>

    <section aria-label="Mapping differences" className="space-y-2">

      <h5 className="font-medium">
        Mapping differences
      </h5>

      <p className="text-zinc-600 dark:text-zinc-400">
        {differences.legacy_import ? 'Imported initial configuration.' : `${differences.added?.length ?? 0} added · ${differences.removed?.length ?? 0} removed · ${differences.changed?.length ?? 0} changed`}
      </p>
      {changes.length ? <div role="region" aria-label="Mapping differences table" tabIndex={0} className="max-h-64 overflow-auto border border-zinc-200 focus-visible:outline-2 dark:border-white/10">

        <table className="w-full min-w-96 text-left">

          <caption className="sr-only">
            Changes from the previous published version
          </caption>

          <thead className="bg-zinc-50 dark:bg-white/5">
            <tr>
              {['Destination', 'Before', 'After', 'Change'].map((label) => <th key={label} scope="col" className="px-3 py-2">
                {label}
              </th>)}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
            {changes.map((change) => <tr key={change.id}>
              <td className="px-3 py-2">
                {change.destination}
              </td>
              <td className="px-3 py-2">
                {change.before}
              </td>
              <td className="px-3 py-2">
                {change.after}
              </td>
              <td className="px-3 py-2">
                {change.change}
              </td>
            </tr>)}
          </tbody>

        </table>

      </div> : <p className="text-zinc-600 dark:text-zinc-400">
        No mapping changes recorded.
      </p>}

    </section>

  </div>
}
