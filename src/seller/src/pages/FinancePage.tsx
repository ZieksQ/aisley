import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiAssetUrl, apiRequest } from '../lib/api'

export function FinancePage() {
  return <FinanceWorkspace csvUrl={apiAssetUrl('/api/v1/seller/finance/ledger.csv')} endpointPrefix="/api/v1/seller/finance" request={apiRequest} roleLabel="Seller" />
}
