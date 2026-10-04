import { FinanceNavigation } from '../components/FinanceNavigation'
import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiRequest, apiUrl } from '../lib/api'

export function FinancePage() {
  return <><FinanceNavigation /><FinanceWorkspace
    csvUrl={apiUrl('/api/v1/admin/finance/ledger.csv')}
    endpointPrefix="/api/v1/admin/finance"
    request={apiRequest}
    roleLabel="Platform" /></>
}
