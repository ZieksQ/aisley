import { useSearchParams } from 'react-router-dom'

const tabs = [
  { id: 'tariff', label: 'Platform tariff' },
  { id: 'coverage', label: 'Service coverage' },
  { id: 'rate-cards', label: 'Rate cards' },
] as const

export type SettingsTab = (typeof tabs)[number]['id']

export function useSettingsTab(): [SettingsTab, (tab: SettingsTab) => void] {
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const active = tabs.some((tab) => tab.id === requested) ? requested as SettingsTab : 'tariff'

  return [active, (tab) => setParams(tab === 'tariff' ? {} : { view: tab })]
}

export function ShippingSettingsTabs({ active, onChange }: { active: SettingsTab; onChange: (tab: SettingsTab) => void }) {
  return <div className="overflow-x-auto border-b border-zinc-200 dark:border-white/10"><div aria-label="Shipping settings sections" className="flex min-w-max gap-6" role="tablist">{tabs.map((tab) => <button aria-controls={`settings-panel-${tab.id}`} aria-selected={active === tab.id} className={`border-b-2 px-0.5 pb-3 pt-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] ${active === tab.id ? 'border-[#4C1268] text-[#4C1268] dark:border-purple-300 dark:text-purple-300' : 'border-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white'}`} id={`settings-tab-${tab.id}`} key={tab.id} onClick={() => onChange(tab.id)} role="tab" type="button">{tab.label}</button>)}</div></div>
}

