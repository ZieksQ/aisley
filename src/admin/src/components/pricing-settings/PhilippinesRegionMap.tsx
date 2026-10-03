import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { FaMinus, FaPlus } from 'react-icons/fa6'
import { regionShortNames } from '../../lib/philippineRegions'
import type { PhilippineRegion } from '../../lib/philippineRegions'
import regionPaths from './map-data/region-paths.json'
import { useRegionMapViewport } from './useRegionMapViewport'

type PhilippinesRegionMapProps = {
  regions: PhilippineRegion[]
  selectedCode: string
  surchargeRegionNames: Set<string>
  onSelect: (code: string) => void
}

const controlClass = 'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-slate-300 px-2 text-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] disabled:cursor-default disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10'

export function PhilippinesRegionMap({ regions, selectedCode, surchargeRegionNames, onSelect }: PhilippinesRegionMapProps) {
  const instructionsId = useId()
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const viewport = useRegionMapViewport()
  const visibleCode = activeCode ?? selectedCode
  const visibleRegion = regions.find((region) => region.code === visibleCode)
  // Draw the selected boundary last so adjacent regions cannot cover its outline.
  const orderedRegions = [...regions.filter((region) => region.code !== selectedCode), ...regions.filter((region) => region.code === selectedCode)]

  function handleKeyDown(event: KeyboardEvent<SVGGElement>, code: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(code)
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[360px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{Math.round(viewport.zoom * 100)}%</span>
        <div aria-label="Map zoom" className="flex gap-2" role="group">
          <button aria-label="Zoom out map" className={controlClass} disabled={viewport.zoom === 1} onClick={viewport.zoomOut} type="button"><FaMinus aria-hidden="true" className="size-3" /></button>
          <button aria-label="Zoom in map" className={controlClass} disabled={viewport.zoom === 4} onClick={viewport.zoomIn} type="button"><FaPlus aria-hidden="true" className="size-3" /></button>
          <button className={controlClass} disabled={viewport.zoom === 1} onClick={viewport.reset} type="button">Reset</button>
        </div>
      </div>
      <svg
        {...viewport.handlers}
        aria-describedby={instructionsId}
        aria-label="Philippine destination regions"
        className={`mt-2 h-[300px] w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:h-[340px] lg:h-[360px] dark:border-white/10 dark:bg-white/[0.02] ${viewport.zoom > 1 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'}`}
        onMouseLeave={() => setActiveCode(null)}
        role="group"
        viewBox={viewport.viewBox}
      >
        <title>Choose a Philippine region to view or change its shipping surcharge</title>
        {orderedRegions.map((region) => {
          const selected = selectedCode === region.code
          const configured = surchargeRegionNames.has(region.name)
          return (
            <g
              aria-label={`${region.name}, ${configured ? 'surcharge configured' : 'no surcharge'}`}
              aria-pressed={selected}
              className="group cursor-pointer outline-none"
              key={region.code}
              onBlur={() => setActiveCode(null)}
              onClick={() => onSelect(region.code)}
              onFocus={(event) => {
                setActiveCode(region.code)
                viewport.revealRegion(event.currentTarget.getBBox())
              }}
              onKeyDown={(event) => handleKeyDown(event, region.code)}
              onMouseEnter={() => setActiveCode(region.code)}
              role="button"
              tabIndex={0}
            >
              <title>{region.name}{selected ? ' — selected' : ''}{configured ? ' — surcharge configured' : ' — no surcharge'}</title>
              <path
                className={`transition-colors duration-150 ${selected ? 'fill-[#E6007A] stroke-[#4C1268] dark:stroke-white' : configured ? 'fill-[#9b72ad] stroke-white/80 dark:fill-[#8a5ca0] dark:stroke-[#211529]' : 'fill-slate-300 stroke-slate-500 dark:fill-slate-500 dark:stroke-[#0b0d13]'} group-hover:stroke-[#4C1268] group-focus:stroke-[#4C1268] group-hover:[stroke-width:2] group-focus:[stroke-width:3] dark:group-hover:stroke-white dark:group-focus:stroke-white`}
                d={regionPaths[region.code as keyof typeof regionPaths]}
                fillRule="evenodd"
                strokeWidth={selected ? 1.5 : 0.6}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </svg>
      <p aria-live="polite" className="mt-2 min-h-5 text-center text-sm font-medium">
        {regionShortNames[visibleCode]}{visibleCode === selectedCode ? ' · Selected' : ''}
        {visibleRegion && surchargeRegionNames.has(visibleRegion.name) ? ' · With surcharge' : ' · No surcharge'}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 bg-[#E6007A]" />Selected</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 bg-[#9b72ad]" />With surcharge</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 bg-slate-300 dark:bg-slate-500" />No surcharge</span>
      </div>
      <p className="mt-2 text-center text-xs leading-5 text-slate-500 dark:text-slate-400" id={instructionsId}>Select a region or use the dropdown. Zoom in, then drag or use arrow keys to move the map.</p>
      <p className="mt-1 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
        Boundaries: <a className="underline underline-offset-2 hover:text-[#E6007A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A]" href="https://github.com/faeldon/philippines-json-maps" rel="noreferrer" target="_blank">faeldon/philippines-json-maps</a> (2023), grouped to current PSGC regions.
      </p>
    </div>
  )
}
