import { PayoutsView, SettingsView, RemittancesView, InvoiceView, BatchView, type PaymentProps } from '@aisley/finance-ui'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { request, apiUrl } from '../lib/api'

import { FinanceNavigation } from '../components/FinanceNavigation'

export function FinancePaymentsPage() {
  const location = useLocation()
  const { invoiceId, batchId } = useParams()
  const navigate = useNavigate()
  const canManage = true
  const props: PaymentProps = { role: 'logistics', prefix: '/api/v1/logistics/finance', request: request, url: apiUrl, canManage, openInvoice: (id: string) => navigate(`/finance/remittances/invoices/${id}`), openBatch: (id: string) => navigate(`/finance/remittances/${id}`) }
  const view = location.pathname.endsWith('/payouts') ? <PayoutsView {...props} />
    : invoiceId ? <InvoiceView {...props} invoiceId={invoiceId} />
      : batchId ? <BatchView {...props} batchId={batchId} />
        : location.pathname.endsWith('/remittances') ? <RemittancesView {...props} />
          : <SettingsView {...props} />
  return <><FinanceNavigation />{view}</>
}
