import { PayoutsView, SettingsView, RemittancesView, InvoiceView, BatchView, SandboxView, type PaymentProps } from '@aisley/finance-ui'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { apiRequest, apiUrl } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { FinanceNavigation } from '../components/FinanceNavigation'

export function FinancePaymentsPage() {
  const location = useLocation()
  const { invoiceId, batchId } = useParams()
  const navigate = useNavigate()
  const { admin } = useAuth()
  const canManage = admin?.permissions.includes('finance.manage') ?? false
  const props: PaymentProps = { role: 'admin', prefix: '/api/v1/admin/finance', request: apiRequest, url: apiUrl, canManage, openInvoice: (id: string) => navigate(`/finance/remittances/invoices/${id}`), openBatch: (id: string) => navigate(`/finance/remittances/${id}`) }
  const view = location.pathname.endsWith('/payouts') ? <PayoutsView {...props} />
    : location.pathname.endsWith('/sandbox') ? <SandboxView {...props} />
      : invoiceId ? <InvoiceView {...props} invoiceId={invoiceId} />
        : batchId ? <BatchView {...props} batchId={batchId} />
          : location.pathname.endsWith('/remittances') ? <RemittancesView {...props} />
            : <SettingsView {...props} />
  return <><FinanceNavigation />{view}</>
}
