import { FaLink, FaTrashCan } from 'react-icons/fa6'
import { PrimaryButton, field } from '../PickupUi'
import type { SortPlanEditor } from './useSortPlanEditor'
const iconButton = 'grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

export function DestinationMappingEditor({ editor }: { editor: SortPlanEditor }) {
  const {
    overview,
    laneId,
    setLaneId,
    postalCode,
    setPostalCode,
    destinationType,
    setDestinationType,
    destinationHubId,
    setDestinationHubId,
    mappingPosition,
    setMappingPosition,
    busy,
    workBlocked,
    selectedPlan,
    standardLanes,
    orderedMappings,
    unmappedCodes,
    addMapping,
    removeMapping,
  } = editor
  if (!selectedPlan) return null
  return (
    <section className="border border-zinc-200 dark:border-white/10">

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-white/10">
        <h4 className="font-semibold">
          Destination lanes
        </h4>
        <span className="text-xs text-zinc-500">
          Ordered by lane no.
        </span>
      </div>

      <form className="grid gap-2 border-b border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_5rem_auto] sm:items-end" onSubmit={(event) => void addMapping(event)}>

        <label className="min-w-0 text-xs font-medium">
          Standard lane
          <select className={field + ' mt-1'} onChange={(event) => setLaneId(event.target.value)} required value={laneId}>
            <option value="">
              Choose lane
            </option>{standardLanes.map((lane) => <option key={lane.id} value={lane.id}>
              {lane.position} · {lane.code} · {lane.name}
            </option>)}
          </select>
        </label>

        <label className="text-xs font-medium">
          Destination
          <select className={field + ' mt-1'} value={destinationType} onChange={(event) => setDestinationType(event.target.value as 'postal_code' | 'hub')}>
            <option value="postal_code">
              Postal code
            </option>
            <option value="hub">
              Next hub
            </option>
          </select>
        </label>
        {destinationType === 'hub' ? <label className="min-w-0 text-xs font-medium">
          Next hub
          <select className={field + ' mt-1'} required value={destinationHubId} onChange={(event) => setDestinationHubId(event.target.value)}>
            <option value="">
              Choose connected hub
            </option>{overview?.next_hubs?.map((hub) => <option key={hub.id} value={hub.id}>
              {hub.name}
            </option>)}
          </select>
        </label> : <label className="text-xs font-medium">
          Postal code
          <select className={field + ' mt-1 font-mono'} onChange={(event) => setPostalCode(event.target.value)} required value={postalCode}>
            <option value="">
              Choose supported code
            </option>{unmappedCodes.map((code) => <option key={code} value={code}>
              {code}
            </option>)}
          </select>
        </label>}

        <label className="text-xs font-medium">
          Order
          <input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setMappingPosition(event.target.value)} required type="number" value={mappingPosition} />
        </label>

        <PrimaryButton busy={busy} disabled={workBlocked || Boolean(selectedPlan.archived_at) || !standardLanes.length || (destinationType === 'hub' ? !overview?.next_hubs?.length : !unmappedCodes.length)} type="submit">
          <FaLink aria-hidden="true" />Map
        </PrimaryButton>

      </form>

      <div className="overflow-x-auto">

        <table className="w-full min-w-[430px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs dark:border-white/10 dark:bg-white/[0.03]">
            <tr>
              <th className="px-2 py-2">
                Lane no.
              </th>
              <th className="px-2 py-2">
                Physical lane
              </th>
              <th className="px-2 py-2">
                Destination
              </th>
              <th className="px-2 py-2 text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
            {orderedMappings.map((mapping) => {
              const destination = mapping.destination_type === 'hub' ? (overview?.next_hubs?.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'Unavailable hub') : mapping.postal_code ?? 'Unavailable postal code'; return <tr key={mapping.id}>
                <td className="px-2 py-2 font-mono">
                  {mapping.lane?.position ?? '—'}
                </td>
                <td className="px-2 py-2">
                  {mapping.lane?.code ?? 'Lane unavailable'}
                </td>
                <td className="px-2 py-2">
                  {destination}
                  <span className="ml-2 text-xs text-zinc-500">
                    {mapping.destination_type === 'hub' ? 'Next hub' : 'Postal'}
                  </span>
                </td>
                <td className="px-2 py-1 text-right">
                  <button aria-label={'Remove ' + destination + ' mapping'} className={iconButton + ' ml-auto'} disabled={busy || workBlocked || Boolean(selectedPlan.archived_at)} onClick={() => void removeMapping(mapping.id, destination)} title="Remove mapping" type="button">
                    <FaTrashCan aria-hidden="true" />
                  </button>
                </td>
              </tr>
            })}
            {!orderedMappings.length ? <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                No destinations mapped.
              </td>
            </tr> : null}
          </tbody>
        </table>

      </div>

    </section>
  )
}
