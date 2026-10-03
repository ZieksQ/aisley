import { useEffect } from 'react'
import { FaBox, FaPercent } from 'react-icons/fa6'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CommissionSettingsPanel } from '../components/pricing-settings/CommissionSettingsPanel'
import { ShippingTariffPanel } from '../components/pricing-settings/ShippingTariffPanel'

type Section = 'shipping' | 'commissions'

function tabClass(active: boolean) {
  return `border-b-2 px-1 pb-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] ${active ? 'border-[#E6007A] text-[#4C1268] dark:text-pink-300' : 'border-transparent text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`
}

export function PricingSettingsPage() {
  const { admin } = useAuth()
  const [params, setParams] = useSearchParams()
  const section: Section = params.get('section') === 'commissions' ? 'commissions' : 'shipping'
  const canManage = admin?.permissions.includes('finance.manage') ?? false

  useEffect(() => { document.title = 'Pricing & fees | Aisley Admin' }, [])

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="border-b border-slate-200 pb-5 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight">Pricing & fees</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Configure checkout shipping charges, parcel limits, and the platform commissions applied to Seller and Logistics proceeds.</p>
      </div>

      <div aria-label="Pricing and fee sections" className="mt-6 flex gap-6 border-b border-slate-200 dark:border-white/10" role="tablist">
        <button aria-selected={section === 'shipping'} className={tabClass(section === 'shipping')} onClick={() => setParams({ section: 'shipping' })} role="tab" type="button"><span className="inline-flex items-center gap-2"><FaBox aria-hidden="true" />Shipping</span></button>
        <button aria-selected={section === 'commissions'} className={tabClass(section === 'commissions')} onClick={() => setParams({ section: 'commissions' })} role="tab" type="button"><span className="inline-flex items-center gap-2"><FaPercent aria-hidden="true" />Commissions</span></button>
      </div>

      {!canManage ? <p className="mt-5 border-l-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">You have read-only Finance access. An Admin with Finance management permission must create or publish changes.</p> : null}
      {section === 'shipping' ? <ShippingTariffPanel canManage={canManage} /> : <CommissionSettingsPanel canManage={canManage} />}
    </div>
  )
}
