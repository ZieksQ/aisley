import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FinanceNavigation } from '../components/FinanceNavigation'
import { FinanceWorkspace } from '@aisley/finance-ui'
import { apiRequest, apiUrl } from '../lib/api'

export function FinancePage() {
  const [params, setParams] = useSearchParams()
  const { admin } = useAuth()
  return <><FinanceNavigation /><FinanceWorkspace key={`${admin?.id}:${admin?.permissions.join(',')}`}
    filters={{ params, setParams }}
    csvUrl={apiUrl('/api/v1/admin/finance/ledger.csv')}
    endpointPrefix="/api/v1/admin/finance"
    request={apiRequest}
    roleLabel="Platform" /></>
}
