import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PortalButton, PortalPagination, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { loadAssignments } from './api'
import { AssignmentDetails } from './AssignmentDetails'
import { AssignmentIcon } from './AssignmentIcon'
import { AssignmentMap } from './AssignmentMap'
import { assignmentDestination, assignmentStatus, hasPin, stageLabels, truckLocation } from './assignmentTypes'
import type { AssignmentStage } from './assignmentTypes'
import { MonitoringRefresh } from './MonitoringRefresh'
import { manilaTime, pageNumber } from './types'
import { useFleetMonitoring } from './useFleetMonitoring'
import './assignments.css'

export function AssignmentsWorkspace() {
  const [params, setParams] = useSearchParams()
  const stage = Object.hasOwn(stageLabels, params.get('stage') ?? '') ? params.get('stage') as AssignmentStage : ''
  const search = (params.get('assignment_search') ?? '').slice(0, 100)
  const page = pageNumber(params.get('assignment_page'))
  const query = new URLSearchParams({ page: String(page), ...(stage ? { stage } : {}), ...(search ? { search } : {}) }).toString()
  const load = useCallback(() => loadAssignments(query), [query])
  const { data, loading, error, refresh } = useFleetMonitoring(`assignments:${query}`, load)
  const [selection, setSelection] = useState<{ query: string; id: string } | null>(null)
  const select = useCallback((id: string) => setSelection({ query, id }), [query])
  const selected = selection?.query === query ? data?.data.find((row) => row.id === selection.id) : undefined

  useEffect(() => {
    if (!data || page <= data.meta.last_page) return
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('assignment_page', String(Math.max(1, data.meta.last_page)))
      return next
    }, { replace: true })
  }, [data, page, setParams])

  function filter(nextStage: string) {
    const next = new URLSearchParams(params)
    if (nextStage) next.set('stage', nextStage)
    else next.delete('stage')
    next.delete('assignment_page')
    setParams(next)
  }

  return (
    <section className="space-y-4" aria-labelledby="courier-work-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="courier-work-title" className="text-lg font-semibold">Pickup & delivery monitoring</h3>
        <p className="portal-secondary text-sm">Active work and owned trucks · Manila time</p>
      </div>
      <div className="assignment-toolbar">
        <div className="flex flex-wrap gap-1" aria-label="Assignment stage filters">
          <PortalButton variant={stage === '' ? 'primary' : 'ghost'} aria-pressed={stage === ''} onClick={() => filter('')}>All stages</PortalButton>
          {Object.entries(stageLabels).map(([value, label]) => (
            <PortalButton key={value} variant={stage === value ? 'primary' : 'ghost'} aria-pressed={stage === value} onClick={() => filter(value)}>
              <span className={`assignment-color-${value}`}><AssignmentIcon stage={value as AssignmentStage} /></span>{label}
            </PortalButton>
          ))}
        </div>
        <form key={search} className="assignment-search" onSubmit={(event) => {
          event.preventDefault()
          const next = new URLSearchParams(params)
          const term = String(new FormData(event.currentTarget).get('assignment_search') ?? '').trim()
          if (term) next.set('assignment_search', term)
          else next.delete('assignment_search')
          next.delete('assignment_page')
          setParams(next)
        }}>
          <label className="portal-field min-w-0 flex-1">
            <span className="portal-field-label">Courier, parcel or truck plate</span>
            <input name="assignment_search" className="portal-input" type="search" maxLength={100} defaultValue={search} />
          </label>
          <PortalButton type="submit" variant="default">Search work</PortalButton>
          {search ? <PortalButton variant="ghost" onClick={() => {
            const next = new URLSearchParams(params)
            next.delete('assignment_search'); next.delete('assignment_page'); setParams(next)
          }}>Clear work search</PortalButton> : null}
        </form>
      </div>
      <MonitoringRefresh loading={loading} error={error} updatedAt={data?.meta.server_time} refresh={refresh} label="Refresh assignments" />
      {loading && !data ? <PortalSkeleton label="Loading courier assignments" /> : data ? (
        <div className="portal-panel assignment-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--portal-border)] px-4 py-3">
            <p className="text-sm"><strong className="tabular-nums">{data.meta.total}</strong> matching record{data.meta.total === 1 ? '' : 's'} · Map shows {data.data.length} on page {data.meta.current_page}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Map legend">
              {Object.entries(stageLabels).map(([value, label]) => <li key={value} className="flex items-center gap-1.5"><span className={`assignment-color-${value}`}><AssignmentIcon stage={value as AssignmentStage} /></span>{label}</li>)}
              <li className="flex items-center gap-1.5"><span className="portal-secondary"><AssignmentIcon stage="linehaul" hub /></span>Hub</li>
            </ul>
          </div>
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.65fr)]">
            <AssignmentMap key={query} rows={data.data} selected={selected?.id ?? null} onSelect={select} />
            <div className="min-w-0 border-t border-[var(--portal-border)] lg:border-t-0 lg:border-l">
              <h4 className="border-b border-[var(--portal-border)] px-4 py-3 font-medium">Courier work & trucks</h4>
              {data.data.length ? <ul className="max-h-[432px] overflow-y-auto" aria-label="Active courier assignments">
                {data.data.map((work) => (
                  <li key={work.id}>
                    <button type="button" className="assignment-row flex w-full gap-3 px-4 py-3 text-left" aria-pressed={selected?.id === work.id} onClick={() => select(work.id)}>
                      <span className={`assignment-color-${work.stage} mt-0.5`}><AssignmentIcon stage={work.stage} /></span>
                      <span className="min-w-0 space-y-1 text-sm">
                        <span className="block break-words font-semibold">{work.courier?.name ?? (work.truck ? `Truck ${work.truck.plate_number}` : 'Courier unavailable')}</span>
                        <span className="block">{stageLabels[work.stage]} · {assignmentStatus(work)}</span>
                        <span className="portal-secondary block break-words">{work.reference}{work.direction === 'return' ? ' · Return' : ''}</span>
                        <span className="portal-secondary block break-words">{assignmentDestination(work)}</span>
                        {work.truck ? <span className="block font-medium">{truckLocation(work)}</span> : null}
                        <span className="portal-secondary block">{work.scheduled_for ? manilaTime(work.scheduled_for) : (work.status === 'no_active_trip' ? 'Last confirmed hub · No active schedule' : 'Schedule unavailable')}{work.stops.some((stop) => !hasPin(stop)) ? ' · Missing map pin' : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul> : <PortalState title="No matching work or trucks" description="No pickup, truck or delivery records match these filters." />}
            </div>
          </div>
          {selected ? <AssignmentDetails work={selected} /> : data.data.length ? <p className="portal-secondary border-t border-[var(--portal-border)] px-4 py-3 text-sm">Select a stop or courier assignment for schedule, stops and recorded events.</p> : null}
          <div className="px-4" aria-label="Assignment pagination">
            <PortalPagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} disabled={loading} onPage={(number) => {
              const next = new URLSearchParams(params); next.set('assignment_page', String(number)); setParams(next)
            }} />
          </div>
        </div>
      ) : null}
    </section>
  )
}
