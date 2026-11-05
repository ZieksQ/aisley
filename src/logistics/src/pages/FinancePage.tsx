import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FinanceNavigation } from '../components/FinanceNavigation'
import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiUrl, request } from '../lib/api'

export function FinancePage() {
  const [params, setParams] = useSearchParams()
  const { logistics } = useAuth()
  return <><FinanceNavigation /><FinanceWorkspace key={`${logistics?.id}:${logistics?.organization?.id}`}
    filters={{ params, setParams }}
    csvUrl={apiUrl('/api/v1/logistics/finance/ledger.csv')}
    endpointPrefix="/api/v1/logistics/finance"
    request={request}
    roleLabel="Logistics" /></>
}
