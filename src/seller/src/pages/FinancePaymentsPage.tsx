import { PayoutsView, SettingsView, type PaymentProps } from '@aisley/finance-ui'
import { useLocation } from 'react-router-dom'
import { apiRequest, apiAssetUrl } from '../lib/api'

import { FinanceNavigation } from '../components/FinanceNavigation'

export function FinancePaymentsPage() {
  const location = useLocation()
  const canManage = false
  const props: PaymentProps = { role: 'seller', prefix: '/api/v1/seller/finance', request: apiRequest, url: apiAssetUrl, canManage }
  const view = location.pathname.endsWith('/payouts') ? <PayoutsView {...props} />
    : <SettingsView {...props} />
  return <><FinanceNavigation />{view}</>
}
