import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiUrl, request } from '../lib/api'

export function FinancePage() {
  return <FinanceWorkspace csvUrl={apiUrl('/api/v1/logistics/finance/ledger.csv')} endpointPrefix="/api/v1/logistics/finance" request={request} roleLabel="Logistics" />
}
