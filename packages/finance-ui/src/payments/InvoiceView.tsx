import { useState } from 'react'
import { SelectField, TextField } from '@aisley/ui'
import { downloadPdf } from './client'
import { Button, date, EmptyState, Feedback, money, PaymentSection, PaymentShell, StatusText } from './common'
import { useFinanceRead, usePaymentAction, useUnsavedPaymentForm } from './hooks'
import type { Batch, Invoice, PaymentProps, SandboxResponse } from './types'
export function InvoiceView(props: PaymentProps & { invoiceId: string }) {
  const read = useFinanceRead<{ data: Invoice; batches: Batch[] }>(props, `/invoices/${props.invoiceId}`)
  const organizations = useFinanceRead<SandboxResponse>(props, props.role === 'admin' ? '/sandbox' : '/automation')
  const [organization, setOrganization] = useState('')
  const [reason, setReason] = useState('')
  const action = usePaymentAction()
  useUnsavedPaymentForm(!read.data?.data.logistics_organization_id && (reason.length > 0 || organization.length > 0))
  const invoice = read.data?.data
  return <PaymentShell
    title="COD invoice"
    description={invoice ? `Order ${invoice.order_reference}` : 'Delivery invoice details.'}
    actions={<>
      <Button variant="outline" onClick={read.reload}>Refresh</Button>
      {invoice && <Button
        variant="secondary"
        isLoading={action.busy}
        onClick={() => void action.act('pdf', () => downloadPdf(props.url(`${props.prefix}/invoices/${invoice.id}/pdf`), `${invoice.reference}.pdf`), 'Invoice downloaded.')}>
        Download invoice PDF
      </Button>}
    </>}>
    <Feedback loading={read.loading} error={read.error || action.error} message={action.message} retry={read.reload} />
    {invoice && <>
      <dl className="payment-summary">
        <div>
          <dt>Outstanding</dt>
          <dd>{money(invoice.remaining_cents, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Invoice total</dt>
          <dd>{money(invoice.total_cents, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusText value={invoice.status} />
          </dd>
        </div>
      </dl>
      {invoice.overdue && <p className="payment-notice payment-attention">This invoice is overdue. The outstanding balance remains payable.</p>}
      <PaymentSection title="Invoice details">
        <dl className="payment-details">
          <div>
            <dt>Invoice reference</dt>
            <dd>{invoice.reference}</dd>
          </div>
          <div>
            <dt>Order</dt>
            <dd>{invoice.order_reference}</dd>
          </div>
          <div>
            <dt>Collecting organization</dt>
            <dd>{invoice.collector_name ?? 'Requires evidence review'}</dd>
          </div>
        </dl>
      </PaymentSection>
      <PaymentSection
        title="Delivery and payment dates"
        description="All dates use Asia/Manila time. Eligibility still requires cleared COD and no holds.">
        <dl className="payment-details">
          <div>
            <dt>Delivered</dt>
            <dd>{date(invoice.delivered_at)}</dd>
          </div>
          <div>
            <dt>COD payment due</dt>
            <dd>{date(invoice.due_at)}</dd>
          </div>
          <div>
            <dt>Seller eligible after</dt>
            <dd>{date(invoice.seller_eligible_at)}</dd>
          </div>
          <div>
            <dt>Logistics eligible after</dt>
            <dd>{date(invoice.logistics_eligible_at)}</dd>
          </div>
        </dl>
      </PaymentSection>
      {props.role === 'admin' && props.canManage && !invoice.logistics_organization_id && <PaymentSection
        title="Review historical collector"
        description="Record the organization confirmed by the delivery evidence.">
        <p className="payment-notice">{invoice.review_reason}</p>
        <Feedback error={organizations.error} retry={organizations.reload} />
        <form
          className="payment-editor"
          onSubmit={(event) => {
            event.preventDefault()
            if (!window.confirm('Record this organization as the COD collector using the reviewed delivery evidence?')) return
            void action.act('collector', async () => {
              await read.client.write(`/invoices/${invoice.id}/collector`, { logistics_organization_id: organization, reason })
              read.reload()
            }, 'Collector recorded.')
          }}>
          <div className="payment-fields">
            <SelectField
              id="collector-organization"
              label="Collecting organization"
              required
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}>
              <option value="">Select organization</option>
              {organizations.data?.organizations?.map((org) => <option key={org.id} value={org.id}>{org.business_name}</option>)}
            </SelectField>
            <TextField
              id="collector-reason"
              label="Delivery evidence reviewed"
              required
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="payment-toolbar">
            <Button type="submit" isLoading={action.busy}>Record collector</Button>
          </div>
        </form>
      </PaymentSection>}
      <PaymentSection title="Remittance history">
        {read.data?.batches.length === 0 ? <EmptyState title="No payments yet." description="Payments allocated to this invoice will appear here." /> : <ul className="payment-list">
          {read.data?.batches.map((batch) => <li key={batch.id}>
            <div className="payment-row-heading">
              <div>
                <StatusText value={batch.status} />
                <p className="payment-reference">{batch.reference}</p>
              </div>
              <strong className="payment-amount">{money(batch.total_cents, batch.currency)}</strong>
            </div>
            <div className="payment-row-heading">
              <p className="payment-muted">{date(batch.submitted_at)}</p>
              <button
                className="payment-link"
                onClick={() => {
                  if (!invoice.logistics_organization_id && (reason || organization) && !window.confirm('Discard the unsaved collector review?')) return
                  props.openBatch?.(batch.id)
                }}>View payment</button>
            </div>
          </li>)}
        </ul>}
      </PaymentSection>
    </>}
  </PaymentShell>
}
