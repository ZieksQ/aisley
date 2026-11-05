import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LuPrinter, LuRoute } from 'react-icons/lu'
import { IconButton, PortalPagination } from '@aisley/ui/portal'
import type { SortingLane } from '../../types/sorting'

const PAGE_SIZE = 8

export function SortingLanes({
  lanes,
  selectedLaneId,
  selectionVersion,
  onSelect,
  onPrint,
}: {
  lanes: SortingLane[]
  selectedLaneId: string
  selectionVersion: number
  onSelect: (lane: SortingLane) => void
  onPrint: (lane: SortingLane) => void
}) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(lanes.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const selectedIndex = lanes.findIndex((lane) => lane.id === selectedLaneId)
  useEffect(() => {
    setPage((value) => Math.min(value, pages))
  }, [pages])
  // Lane-label scans can select a lane on another page. Ordinary paging never changes selection.
  useEffect(() => {
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / PAGE_SIZE) + 1)
  }, [selectedIndex, selectedLaneId, selectionVersion])
  return (
    <section
      className="portal-section min-w-0"
      aria-labelledby="sorting-lanes-title"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-700">
        <h3 id="sorting-lanes-title" className="font-semibold">
          Lanes
        </h3>
        <Link
          aria-label="Manage sort plan"
          title="Sort plan"
          className="grid size-11 place-items-center rounded-md text-blue-700 hover:bg-slate-100 focus-visible:outline-2 dark:text-blue-300 dark:hover:bg-white/10"
          to="/sort-plan"
        >
          <LuRoute aria-hidden="true" />
        </Link>
      </div>
      {lanes.length ? (
        <>
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {lanes
              .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
              .map((lane) => (
                <li
                  className={`${lane.id === selectedLaneId ? 'bg-blue-50 dark:bg-blue-400/10 ' : ''}flex items-center gap-1`}
                  key={lane.id}
                >
                  <button
                    className="min-w-0 flex-1 px-4 py-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:opacity-45"
                    disabled={!lane.is_active}
                    aria-pressed={lane.id === selectedLaneId}
                    onClick={() => onSelect(lane)}
                    type="button"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="break-words font-mono text-sm">
                        {lane.code}
                      </strong>
                      {lane.type === 'exception' ? (
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          Exception
                        </span>
                      ) : null}
                      {!lane.is_active ? (
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Inactive
                        </span>
                      ) : null}
                    </span>
                    <span className="block break-words text-xs text-slate-600 dark:text-slate-400">
                      {lane.name}
                    </span>
                  </button>
                  <IconButton
                    label={'Print ' + lane.code + ' label'}
                    onClick={() => onPrint(lane)}
                  >
                    <LuPrinter aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
          </ul>
          {pages > 1 ? (
            <div role="group" aria-label="Sorting lanes pagination">
              <p
                className="px-4 pt-3 text-xs text-slate-600 dark:text-slate-400"
                role="status"
              >
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, lanes.length)} of{' '}
                {lanes.length} lanes
              </p>
              <PortalPagination
                page={currentPage}
                lastPage={pages}
                onPage={setPage}
              />
            </div>
          ) : null}
        </>
      ) : (
        <p className="px-4 py-5 text-sm text-slate-600 dark:text-slate-400">
          Create lanes in Sort plan.
        </p>
      )}
    </section>
  )
}
