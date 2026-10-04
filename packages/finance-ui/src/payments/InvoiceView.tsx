import { useState } from 'react'
import { Button, TextField } from '@aisley/ui'
import { downloadPdf } from './client'
import { date, Feedback, money, PaymentShell } from './common'
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
  return <PaymentShell title="COD invoice">
    <Feedback
      loading={read.loading}
      error={read.error || action.error}
      message={action.message}
      retry={read.reload} />
    {invoice && <>
      <dl className="payment-details">
        <dt>
          Invoice
        </dt>
        <dd>
          {invoice.reference}
        </dd>
        <dt>
          Order
        </dt>
        <dd>
          {invoice.order_reference}
        </dd>
        <dt>
          Collector
        </dt>
        <dd>
          {invoice.collector_name ?? 'Requires evidence review'}
        </dd>
        <dt>
          Total
        </dt>
        <dd>
          {money(invoice.total_cents, invoice.currency)}
        </dd>
        <dt>
          Outstanding
        </dt>
        <dd>
          {money(invoice.remaining_cents, invoice.currency)}
        </dd>
        <dt>
          Status
        </dt>
        <dd>
          {invoice.status}
          {invoice.overdue && ' · overdue'}
        </dd>
        <dt>
          Delivered
        </dt>
        <dd>
          {date(invoice.delivered_at)}
        </dd>
        <dt>
          COD deadline
        </dt>
        <dd>
          {date(invoice.due_at)}
        </dd>
        <dt>
          Seller eligible after
        </dt>
        <dd>
          {date(invoice.seller_eligible_at)}
        </dd>
        <dt>
          Logistics eligible after
        </dt>
        <dd>
          {date(invoice.logistics_eligible_at)}
        </dd>
      </dl>
      <div className="payment-toolbar">
        <Button variant="outline" isLoading={action.busy} onClick={() => void action.act('pdf', () => downloadPdf(props.url(`${props.prefix}/invoices/${invoice.id}/pdf`), `${invoice.reference}.pdf`), 'Invoice downloaded.')}>
          Download invoice PDF
        </Button>
        <Button variant="outline" onClick={read.reload}>
          Refresh
        </Button>
      </div>
      {props.role === 'admin' && props.canManage && !invoice.logistics_organization_id && <form onSubmit={(event) => { event.preventDefault(); if (!window.confirm('Record this organization as the COD collector using the reviewed delivery evidence?')) return; void action.act('collector', async () => { await read.client.write(`/invoices/${invoice.id}/collector`, { logistics_organization_id: organization, reason }); read.reload() }, 'Collector recorded.') }}>
        <h3>
          Review historical collector
        </h3>
        <p>
          {invoice.review_reason}
        </p>
        <div className="payment-fields">
          <label>
            Collecting organization
            <select required value={organization} onChange={(event) => setOrganization(event.target.value)}>
              <option value="">
                Select organization
              </option>
              {organizations.data?.organizations?.map((org) => <option key={org.id} value={org.id}>
                {org.business_name}
              </option>)}
            </select>
          </label>
          <TextField
            id="collector-reason"
            label="Delivery evidence reviewed"
            required
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="payment-toolbar">
          <Button type="submit" isLoading={action.busy}>
            Record collector
          </Button>
        </div>
      </form>}
      <h3>
        Remittance history
      </h3>{read.data?.batches.length === 0 && <p>
        No payments yet.
      </p>}<ul className="payment-list">
        {read.data?.batches.map((batch) => <li key={batch.id}>
          <p>
            {batch.status}
            ·
            {money(batch.total_cents, batch.currency)}
            ·
            {date(batch.submitted_at)}
          </p>
          <button className="payment-link" onClick={() => props.openBatch?.(batch.id)}>
            View payment
          </button>
        </li>)}
      </ul>
    </>}
  </PaymentShell>
}
