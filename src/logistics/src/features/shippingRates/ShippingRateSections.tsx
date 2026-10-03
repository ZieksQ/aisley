import { useSearchParams } from 'react-router-dom'

const sections = [
  { id: 'tariff', label: 'Platform tariff' },
  { id: 'coverage', label: 'Service coverage' },
  { id: 'rate-cards', label: 'Rate cards' },
] as const

export type ShippingRateSection = (typeof sections)[number]['id']

export function useShippingRateSection(): [ShippingRateSection, (section: ShippingRateSection) => void] {
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const active = sections.some((section) => section.id === requested) ? requested as ShippingRateSection : 'tariff'

  return [active, (section) => setParams(section === 'tariff' ? {} : { view: section })]
}

export function ShippingRateSections({ active, onChange }: { active: ShippingRateSection; onChange: (section: ShippingRateSection) => void }) {
  return <div className="overflow-x-auto border-b border-zinc-200 dark:border-white/10"><div aria-label="Shipping rate sections" className="flex min-w-max gap-6" role="tablist">{sections.map((section) => <button aria-controls={`shipping-rates-panel-${section.id}`} aria-selected={active === section.id} className={`border-b-2 px-0.5 pb-3 pt-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] ${active === section.id ? 'border-[#4C1268] text-[#4C1268] dark:border-purple-300 dark:text-purple-300' : 'border-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white'}`} id={`shipping-rates-tab-${section.id}`} key={section.id} onClick={() => onChange(section.id)} role="tab" type="button">{section.label}</button>)}</div></div>
}
