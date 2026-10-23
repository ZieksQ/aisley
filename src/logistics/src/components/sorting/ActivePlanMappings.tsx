import type { SortingPlanLane } from '../../types/sorting'

export function ActivePlanMappings({ mappings, hubs }: {
  mappings: SortingPlanLane[]
  hubs: Array<{ id: string; name: string }>
}) {
  const rows = mappings.map((mapping) => ({
    ...mapping,
    destination: mapping.destination_type === 'hub'
      ? hubs.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'Unavailable hub'
      : mapping.postal_code ?? 'Unavailable postal code',
    destinationLabel: mapping.destination_type === 'hub' ? 'Next hub' : 'Postal code',
  }))

  if (!rows.length) return <p className="portal-secondary px-4 py-5 text-sm">
    No destinations mapped. Edit the active plan to add one.
  </p>

  return <>
    <ul className="divide-y divide-slate-200 sm:hidden dark:divide-slate-700" aria-label="Active destination mappings">
      {rows.map((row) => <li className="p-4" key={row.id}>
        <p className="text-sm font-semibold">{row.lane?.code ?? 'Lane unavailable'}</p>
        <dl className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="portal-secondary">Lane no.</dt><dd>{row.lane?.position ?? '—'}</dd>
          <dt className="portal-secondary">{row.destinationLabel}</dt><dd className="break-words font-medium">{row.destination}</dd>
        </dl>
      </li>)}
    </ul>
    <div className="hidden overflow-x-auto sm:block" role="region" aria-label="Active destination mappings table" tabIndex={0}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-white/[0.03]">
          <tr><th className="px-4 py-3" scope="col">Lane no.</th><th className="px-4 py-3" scope="col">Physical lane</th><th className="px-4 py-3" scope="col">Destination</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((row) => <tr key={row.id}>
            <td className="px-4 py-3 tabular-nums">{row.lane?.position ?? '—'}</td>
            <td className="px-4 py-3">{row.lane?.code ?? 'Lane unavailable'}</td>
            <td className="px-4 py-3 break-words">{row.destination}<span className="portal-secondary mt-1 block text-xs">{row.destinationLabel}</span></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </>
}
