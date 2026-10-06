import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FaXmark } from 'react-icons/fa6'
import type { SortingLane, SortingPlan, SortingPlanVersion } from '../../types/sorting'
import { field, manilaDate } from '../PickupUi'
import { SortingButton } from './SortingButton'
import { VersionMappings } from './VersionMappings'

export function PublishedVersions({ plan, lanes, hubs, blocked, feedback, actions }: {
  plan: SortingPlan
  lanes: SortingLane[]
  hubs: Array<{ id: string; name: string }>
  blocked: boolean
  feedback: ReactNode
  actions: (version: SortingPlanVersion) => ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const query = search.trim().toLocaleLowerCase()
  const versions = plan.versions.filter((version) => [String(version.number), `Version ${version.number}`, version.name, manilaDate(version.published_at)].some((value) => value.toLocaleLowerCase().includes(query)))
  const selected = versions.find((version) => version.id === selectedId) ?? versions[0]

  return <>
    <SortingButton onClick={() => dialog.current?.showModal()}>
      Published versions ({plan.versions.length})
    </SortingButton>
    <dialog ref={dialog} aria-labelledby="published-versions-title" onCancel={(event) => { event.stopPropagation(); event.preventDefault(); if (!blocked) dialog.current?.close() }} onClose={(event) => event.stopPropagation()} className="m-auto max-h-[92dvh] w-[min(94vw,64rem)] max-w-none overflow-hidden rounded-md border border-zinc-300 bg-white p-0 text-zinc-950 backdrop:bg-black/50 dark:border-white/20 dark:bg-zinc-900 dark:text-white">

      <div className="flex max-h-[92dvh] flex-col">

        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10">

          <h3 id="published-versions-title" className="min-w-0 break-words font-semibold">
            Published versions · {plan.name}
          </h3>

          <button type="button" aria-label="Close published versions" disabled={blocked} className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-zinc-100 focus-visible:outline-2 disabled:opacity-40 dark:hover:bg-white/10" onClick={() => dialog.current?.close()}>
            <FaXmark aria-hidden="true" />
          </button>

        </header>

        <div className="min-h-0 space-y-4 overflow-y-auto p-4">
          {feedback}

          <label className="block text-sm font-medium">
            Search published versions
            <input type="search" autoFocus className={`${field} mt-1`} placeholder="Version number, name or date" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>

          <div className="grid min-w-0 gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">

            <div className="max-h-48 overflow-y-auto border border-zinc-200 md:max-h-96 dark:border-white/10" aria-label="Published version list">
              {versions.map((version) => <button key={version.id} type="button" disabled={blocked} aria-pressed={selected?.id === version.id} className={`block w-full border-b border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5 ${selected?.id === version.id ? 'border-l-2 border-l-[#4C1268] bg-purple-50 dark:bg-purple-400/10' : ''}`} onClick={() => setSelectedId(version.id)}>

                <strong className="block">
                  Version {version.number}{version.id === plan.active_version_id ? ' · Active' : ''}
                </strong>

                <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                  {manilaDate(version.published_at)}
                </span>

              </button>)}
              {!versions.length ? <p className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                {plan.versions.length ? 'No matching published versions.' : 'No published versions yet.'}
              </p> : null}

            </div>
            {selected ? <section className="min-w-0 space-y-3" aria-label={`Version ${selected.number} details`}>

              <h4 className="font-semibold">
                Version {selected.number}
              </h4>

              <p className="break-words text-sm">
                {selected.name} · {manilaDate(selected.published_at)}
              </p>

              <p className="break-all text-xs text-zinc-600 dark:text-zinc-400">
                Published by {selected.published_by}
              </p>

              <VersionMappings version={selected} lanes={lanes} hubs={hubs} />
              {actions(selected)}

            </section> : null}

          </div>

        </div>

      </div>

    </dialog>
  </>
}
