import { useState } from 'react'
import { TextField } from '@aisley/ui'
import { downloadPdf } from './client'
import { Attempts, Button, date, Feedback, money, PaymentSection, PaymentShell, PaymentTable, StatusText } from './common'
import { useFinanceRead, usePaymentAction, useUnsavedPaymentForm } from './hooks'
import type { Batch, PaymentProps } from './types'
export function BatchView(props: PaymentProps & { batchId: string }) {
  const read = useFinanceRead<{ data: Batch }>(props, `/remittances/${props.batchId}`)
  const [reason, setReason] = useState('')
  const action = usePaymentAction()
  useUnsavedPaymentForm(reason.length > 0 && read.data?.data.status === 'submitted')
  const batch = read.data?.data
  function review(outcome: 'clear' | 'reject') {
    if (outcome === 'reject' && !reason.trim()) return
    if (!window.confirm(outcome === 'clear' ? 'Confirm receipt of this manual remittance and fund its Orders?' : 'Reject this manual remittance and release its invoice reservations?')) return
    void action.act(outcome, async () => {
      await read.client.write(`/remittances/${props.batchId}/${outcome}`, outcome === 'reject' ? { reason } : {})
      read.reload()
    }, outcome === 'clear' ? 'Remittance cleared.' : 'Remittance rejected.')
  }
  return <PaymentShell
    title="Remittance payment"
    description={batch?.reference ?? 'Payment details and order allocations.'}
    actions={<>
      <Button variant="outline" onClick={read.reload}>Refresh status</Button>
      {batch?.status === 'cleared' && <Button
        variant="secondary"
        isLoading={action.busy}
        onClick={() => void action.act('receipt', () => downloadPdf(props.url(`${props.prefix}/remittances/${batch.id}/receipt`), `cod-payment-${batch.id}.pdf`), 'Receipt downloaded.')}>
        Download payment PDF
      </Button>}
    </>}>
    <Feedback loading={read.loading} error={read.error || action.error} message={action.message} retry={read.reload} />
    {batch && <>
      <dl className="payment-summary">
        <div>
          <dt>Payment total</dt>
          <dd>{money(batch.total_cents, batch.currency)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusText value={batch.status} />
          </dd>
        </div>
      </dl>
      <PaymentSection title="Payment details" description="All dates use Asia/Manila time.">
        <dl className="payment-details">
          <div>
            <dt>Reference</dt>
            <dd>{batch.reference}</dd>
          </div>
          <div>
            <dt>Collecting organization</dt>
            <dd>{batch.collector_name ?? 'Unknown collector'}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{batch.is_gateway ? 'Sandbox gateway' : 'Manual receipt'}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{date(batch.submitted_at)}</dd>
          </div>
          <div>
            <dt>Cleared</dt>
            <dd>{date(batch.cleared_at)}</dd>
          </div>
        </dl>
        {batch.rejection_reason && <p className="payment-notice payment-attention">Rejection or failure: {batch.rejection_reason}</p>}
      </PaymentSection>
      <PaymentSection title="Order allocations">
        <PaymentTable caption="Order allocations">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col" className="payment-numeric">Allocated amount</th>
            </tr>
          </thead>
          <tbody>{batch.allocations.map((item) => <tr key={item.order_id}>
            <td>{item.order_reference}</td>
            <td className="payment-numeric">{money(item.amount_cents, batch.currency)}</td>
          </tr>)}</tbody>
        </PaymentTable>
      </PaymentSection>
      <Attempts attempts={batch.attempts} />
      {props.role === 'admin' && props.canManage && !batch.is_gateway && batch.status === 'submitted' && <PaymentSection
        title="Manual receipt review"
        description="Clear a verified receipt or reject it to release the invoice reservations.">
        <div className="payment-toolbar">
          <Button isLoading={action.busy} onClick={() => review('clear')}>Clear receipt</Button>
        </div>
        <form className="payment-editor" onSubmit={(event) => { event.preventDefault(); review('reject') }}>
          <div className="payment-fields">
            <TextField
              id="reject-reason"
              label="Rejection reason"
              required
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="payment-toolbar">
            <Button variant="outline" type="submit" isLoading={action.busy}>Reject receipt</Button>
          </div>
        </form>
      </PaymentSection>}
    </>}
  </PaymentShell>
}
