import { useState } from 'react'
import { Button, TextField } from '@aisley/ui'
import { downloadPdf } from './client'
import { Attempts, date, Feedback, money, PaymentShell } from './common'
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
  return <PaymentShell title="Remittance payment">
    <Feedback
      loading={read.loading}
      error={read.error || action.error}
      message={action.message}
      retry={read.reload} />
    {batch && <>
      <dl className="payment-details">
        <dt>
          Reference
        </dt>
        <dd>
          {batch.reference}
        </dd>
        <dt>
          Total
        </dt>
        <dd>
          {money(batch.total_cents, batch.currency)}
        </dd>
        <dt>
          Status
        </dt>
        <dd>
          {batch.status}
        </dd>
        <dt>
          Method
        </dt>
        <dd>
          {batch.is_gateway ? 'Sandbox gateway' : 'Manual receipt'}
        </dd>
        <dt>
          Submitted
        </dt>
        <dd>
          {date(batch.submitted_at)}
        </dd>
        <dt>
          Cleared
        </dt>
        <dd>
          {date(batch.cleared_at)}
        </dd>
      </dl>{batch.rejection_reason && <p>
        Rejection/failure:
        {batch.rejection_reason}
      </p>}
      <div className="payment-toolbar">
        <Button variant="outline" onClick={read.reload}>
          Refresh status
        </Button>
        {batch.status === 'cleared' && <Button variant="outline" isLoading={action.busy} onClick={() => void action.act('receipt', () => downloadPdf(props.url(`${props.prefix}/remittances/${batch.id}/receipt`), `cod-payment-${batch.id}.pdf`), 'Receipt downloaded.')}>
          Download payment PDF
        </Button>}
      </div>
      <h3>
        Order allocations
      </h3><ul className="payment-list">
        {batch.allocations.map((item) => <li key={item.order_id}>
          {item.order_reference}
          ·
          {money(item.amount_cents, batch.currency)}
        </li>)}
      </ul><Attempts attempts={batch.attempts} />
      {props.role === 'admin' && props.canManage && !batch.is_gateway && batch.status === 'submitted' && <><h3>
        Manual receipt review
      </h3><Button isLoading={action.busy} onClick={() => review('clear')}>
          Clear receipt
        </Button><form onSubmit={(event) => { event.preventDefault(); review('reject') }}>
          <div className="payment-toolbar">
            <TextField
              id="reject-reason"
              label="Rejection reason"
              required
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)} />
            <Button variant="outline" type="submit" isLoading={action.busy}>
              Reject receipt
            </Button>
          </div>
        </form></>}
    </>}
  </PaymentShell>
}
