import { FinanceNavigation } from '../components/FinanceNavigation'
import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiUrl, request } from '../lib/api'

export function FinancePage() {
  return <><FinanceNavigation /><FinanceWorkspace
    csvUrl={apiUrl('/api/v1/logistics/finance/ledger.csv')}
    endpointPrefix="/api/v1/logistics/finance"
    request={request}
    roleLabel="Logistics" /></>
}
