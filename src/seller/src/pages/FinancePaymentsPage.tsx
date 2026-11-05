import { useAuth } from '../auth/useAuth'
import { PayoutsView, SettingsView, type PaymentProps } from '@aisley/finance-ui'
import { useSearchParams, useLocation } from 'react-router-dom'
import { apiRequest, apiAssetUrl } from '../lib/api'

import { FinanceNavigation } from '../components/FinanceNavigation'

export function FinancePaymentsPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const { seller } = useAuth()
  const canManage = false
  const props: PaymentProps = { filters: { params, setParams }, role: 'seller', prefix: '/api/v1/seller/finance', request: apiRequest, url: apiAssetUrl, canManage }
  const view = location.pathname.endsWith('/payouts') ? <PayoutsView {...props} />
    : <SettingsView {...props} />
  return <div key={`${seller?.id}:${seller?.shop?.id}`}><FinanceNavigation />{view}</div>
}
