import { regionShortNames } from '../../lib/philippineRegions'
import type { PhilippineRegion } from '../../lib/philippineRegions'

const regionPaths: Record<string, string> = {
  '0100000000': 'M86 42 L105 29 L115 57 L111 104 L101 142 L87 163 L80 134 L85 94 Z',
  '0200000000': 'M111 30 L145 17 L177 29 L190 58 L180 96 L158 130 L128 122 L111 104 L115 57 Z',
  '1400000000': 'M111 104 L128 78 L158 78 L158 130 L139 150 L105 142 Z',
  '0300000000': 'M87 163 L105 142 L139 150 L158 130 L176 151 L161 191 L128 207 L96 193 Z',
  '1300000000': 'M119 201 L130 198 L137 209 L128 219 L117 214 Z',
  '0400000000': 'M128 207 L161 191 L184 205 L177 234 L148 251 L122 236 L117 214 Z',
  '0500000000': 'M177 205 L205 221 L235 254 L229 279 L205 269 L181 242 L148 251 L177 234 Z',
  '1700000000': 'M106 228 L116 244 L104 275 L92 309 L83 340 L71 329 L77 298 L88 266 L89 240 Z',
  '0600000000': 'M96 294 L119 283 L132 304 L126 338 L105 354 L91 330 Z',
  '1800000000': 'M126 307 L143 300 L151 332 L143 373 L132 390 L122 360 Z',
  '0700000000': 'M151 307 L169 303 L177 329 L170 367 L153 385 L143 373 L151 332 Z',
  '0800000000': 'M181 289 L202 297 L211 325 L204 359 L181 380 L170 367 L177 329 Z',
  '0900000000': 'M64 405 L94 393 L126 401 L133 420 L106 437 L76 432 L54 419 Z',
  '1000000000': 'M126 389 L166 382 L188 397 L181 427 L145 438 L133 420 L126 401 Z',
  '1600000000': 'M188 382 L220 393 L235 417 L218 442 L181 427 L188 397 Z',
  '1900000000': 'M106 437 L133 420 L145 438 L151 465 L133 491 L103 469 L82 449 Z',
  '1200000000': 'M145 438 L181 427 L198 451 L187 487 L160 503 L133 491 L151 465 Z',
  '1100000000': 'M181 427 L218 442 L237 468 L219 499 L187 487 L198 451 Z',
}

type PhilippinesRegionMapProps = {
  regions: PhilippineRegion[]
  selectedCode: string
  surchargeRegionNames: Set<string>
  onSelect: (code: string) => void
}

export function PhilippinesRegionMap({ regions, selectedCode, surchargeRegionNames, onSelect }: PhilippinesRegionMapProps) {
  function handleKeyDown(event: React.KeyboardEvent<SVGGElement>, code: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(code)
  }

  return (
    <div className="mx-auto w-full max-w-xs">
      <svg aria-label="Schematic map of Philippine regions" className="h-auto w-full" role="img" viewBox="35 0 220 520">
        <title>Choose a Philippine region to view or change its shipping surcharge</title>
        {regions.map((region) => {
          const selected = selectedCode === region.code
          const configured = surchargeRegionNames.has(region.name)
          return (
            <g
              aria-label={`${region.name}${configured ? ', surcharge configured' : ', no surcharge'}`}
              className="group cursor-pointer outline-none"
              key={region.code}
              onClick={() => onSelect(region.code)}
              onKeyDown={(event) => handleKeyDown(event, region.code)}
              role="button"
              tabIndex={0}
            >
              <title>{region.name}</title>
              <path
                className={`transition-colors duration-150 ${selected ? 'fill-[#E6007A] stroke-[#4C1268] dark:stroke-white' : configured ? 'fill-[#9b72ad] stroke-white/80 dark:fill-[#8a5ca0] dark:stroke-[#211529]' : 'fill-slate-200 stroke-white dark:fill-white/10 dark:stroke-[#0b0d13]'} group-focus:stroke-[#E6007A]`}
                d={regionPaths[region.code]}
                strokeWidth={selected ? 3 : 2}
              />
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 bg-[#9b72ad]" />With surcharge</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 bg-slate-200 dark:bg-white/10" />No surcharge</span>
      </div>
      <p className="mt-3 text-center text-xs leading-5 text-slate-400">Schematic selector, not a legal-boundary or delivery-coverage map.</p>
      <p className="sr-only">Selected region: {regionShortNames[selectedCode]}</p>
    </div>
  )
}
