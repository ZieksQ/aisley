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
  return <div className="overflow-x-auto border-b border-[var(--portal-border)]">
    <div aria-label="Shipping rate sections" className="grid grid-cols-3 gap-2 sm:flex sm:gap-6" role="tablist">
      {sections.map((section, index) => <button
        aria-controls={`shipping-rates-panel-${section.id}`}
        aria-selected={active === section.id}
        className={`min-h-11 border-b-2 px-1 py-3 text-sm font-medium ${active === section.id ? 'border-[var(--brand-primary)] text-[var(--portal-accent)]' : 'border-transparent text-[var(--portal-muted)] hover:text-[var(--portal-text)]'}`}
        id={`shipping-rates-tab-${section.id}`}
        key={section.id}
        onClick={() => onChange(section.id)}
        onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : null
          if (next !== null) {
            event.preventDefault()
            onChange(sections[next].id)
            document.getElementById(`shipping-rates-tab-${sections[next].id}`)?.focus()
          }
        }}
        role="tab"
        tabIndex={active === section.id ? 0 : -1}
        type="button">{section.label}</button>)}
    </div>
  </div>
}
