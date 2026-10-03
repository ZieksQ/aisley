import { FaTrashCan } from 'react-icons/fa6'
import { philippineRegions, regionShortNames } from '../../lib/philippineRegions'
import { PhilippinesRegionMap } from './PhilippinesRegionMap'
import { inputClass } from './ui'

type RegionSurchargeEditorProps = {
  readOnly?: boolean
  selectedCode: string
  values: Record<string, string>
  onSelect: (code: string) => void
  onValuesChange?: (values: Record<string, string>) => void
}

export function RegionSurchargeEditor({ readOnly = false, selectedCode, values, onSelect, onValuesChange }: RegionSurchargeEditorProps) {
  const selected = philippineRegions.find((region) => region.code === selectedCode) ?? philippineRegions[0]
  const configuredNames = new Set(Object.entries(values).filter(([, amount]) => amount !== '').map(([name]) => name))
  const amount = values[selected.name] ?? ''

  function updateAmount(nextAmount: string) {
    if (!onValuesChange) return
    onValuesChange({ ...values, [selected.name]: nextAmount })
  }

  function clearAmount() {
    if (!onValuesChange) return
    const next = { ...values }
    delete next[selected.name]
    onValuesChange(next)
  }

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] md:items-center">
      <PhilippinesRegionMap onSelect={onSelect} regions={philippineRegions} selectedCode={selected.code} surchargeRegionNames={configuredNames} />
      <div className="min-w-0">
        <label className="block text-sm font-semibold" htmlFor="pricing-region">Destination region</label>
        <select className={`${inputClass} mt-2`} id="pricing-region" onChange={(event) => onSelect(event.target.value)} value={selected.code}>
          {philippineRegions.map((region) => <option key={region.code} value={region.code}>{regionShortNames[region.code]} — {region.name}</option>)}
        </select>

        <div className="mt-5 border-l-2 border-[#4C1268] pl-4 dark:border-[#d597ed]">
          <p className="font-semibold">{selected.name}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Applied to the Customer shipping total for deliveries to this region.</p>
          <label className="mt-4 block text-sm font-semibold" htmlFor="region-surcharge">Surcharge (PHP)</label>
          <div className="mt-2 flex items-start gap-2">
            <div className="relative min-w-0 flex-1">
              <span aria-hidden="true" className="absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">₱</span>
              <input
                className={`${inputClass} pl-8`}
                disabled={readOnly}
                id="region-surcharge"
                inputMode="decimal"
                min="0"
                onChange={(event) => updateAmount(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={amount}
              />
            </div>
            {!readOnly && amount !== '' ? (
              <button aria-label={`Clear surcharge for ${selected.name}`} className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] dark:border-white/15 dark:hover:bg-white/5 dark:hover:text-rose-300" onClick={clearAmount} type="button">
                <FaTrashCan aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {!readOnly ? <p className="mt-2 text-xs leading-5 text-slate-400">Leave blank to use only the base fee. A value of ₱0.00 records an explicit zero surcharge.</p> : null}
        </div>
      </div>
    </div>
  )
}
