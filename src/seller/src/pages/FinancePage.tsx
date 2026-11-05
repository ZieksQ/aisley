import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FinanceNavigation } from '../components/FinanceNavigation'
import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiAssetUrl, apiRequest } from '../lib/api'

export function FinancePage() {
  const [params, setParams] = useSearchParams()
  const { seller } = useAuth()
  return <><FinanceNavigation /><FinanceWorkspace key={`${seller?.id}:${seller?.shop?.id}`}
    filters={{ params, setParams }}
    csvUrl={apiAssetUrl('/api/v1/seller/finance/ledger.csv')}
    endpointPrefix="/api/v1/seller/finance"
    request={apiRequest}
    roleLabel="Seller" /></>
}
