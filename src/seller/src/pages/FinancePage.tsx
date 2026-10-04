import { FinanceNavigation } from '../components/FinanceNavigation'
import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiAssetUrl, apiRequest } from '../lib/api'

export function FinancePage() {
  return <><FinanceNavigation /><FinanceWorkspace
    csvUrl={apiAssetUrl('/api/v1/seller/finance/ledger.csv')}
    endpointPrefix="/api/v1/seller/finance"
    request={apiRequest}
    roleLabel="Seller" /></>
}
