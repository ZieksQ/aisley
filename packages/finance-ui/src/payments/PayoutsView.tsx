import { useState } from 'react'
import { SelectField } from '@aisley/ui'
import { downloadPdf } from './client'
import { Button, date, EmptyState, Feedback, money, Paging, PaymentSection, PaymentShell, PaymentTable, StatusText } from './common'
import { useFinanceRead, usePaymentAction } from './hooks'
import type { Obligation, Page, PaymentProps, Payout } from './types'
export function PayoutsView(props: PaymentProps) {
  const [type, setType] = useState(props.role === 'seller' ? 'seller' : 'logistics')
  const [early, setEarly] = useState(false)
  const [page, setPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const read = useFinanceRead<Page<Obligation>>(props, `/payout-obligations?beneficiary_type=${type}&early=${early ? 1 : 0}&page=${page}`)
  const history = useFinanceRead<Page<Payout>>(props, `/payout-history?page=${historyPage}`)
  const action = usePaymentAction()
  const items = read.data?.data.filter((item) => selected.includes(`${item.beneficiary_id}:${item.order_id}`) && item.blocked.length === 0) ?? []
  const total = items.reduce((sum, item) => sum + item.amount_cents, 0)
  function refresh() { read.reload(); history.reload(); setSelected([]) }
  function send() {
    const first = items[0]
    if (!first || !window.confirm(`Send ${money(total, first.currency)} to ${first.beneficiary_name}${early ? ' before the configured waiting period' : ''} through the sandbox gateway?`)) return
    void action.act(JSON.stringify([type, early, selected.slice().sort()]), async (key) => {
      await read.client.write('/payout-send', { beneficiary_type: type, beneficiary_id: first.beneficiary_id, order_ids: items.map((item) => item.order_id), early, idempotency_key: key })
      refresh()
    }, 'Payout queued. Check payment history for gateway confirmation.')
  }
  return <PaymentShell
    title="Payouts"
    description="Track amounts awaiting payment and download completed payment receipts."
    actions={<Button variant="outline" onClick={refresh}>Refresh</Button>}>
    <Feedback error={action.error} message={action.message} />
    <PaymentSection
      title="Unpaid obligations"
      description="Payouts require cleared COD, no financial holds, and an eligible delivery date.">
      {props.role === 'admin' && <div className="payment-filters">
        <SelectField
          id="payout-beneficiary"
          label="Beneficiary type"
          value={type}
          onChange={(event) => { setType(event.target.value); setEarly(false); setSelected([]); setPage(1) }}>
          <option value="seller">Sellers</option>
          <option value="logistics">Logistics</option>
        </SelectField>
        {type === 'logistics' && props.canManage && <label className="payment-checkbox">
          <input type="checkbox" checked={early} onChange={(event) => { setEarly(event.target.checked); setSelected([]) }} />
          Include early Logistics payouts
        </label>}
      </div>}
      <Feedback loading={read.loading} error={read.error} retry={read.reload} />
      {read.data && <>
        {read.data.data.length > 0 ? <PaymentTable caption="Unpaid payout obligations">
          <thead>
            <tr>
              {props.role === 'admin' && props.canManage && <th scope="col">Select</th>}
              <th scope="col">Order</th>
              <th scope="col">Beneficiary</th>
              <th scope="col" className="payment-numeric">Amount</th>
              <th scope="col">Eligible after · Manila time</th>
              <th scope="col">Eligibility</th>
            </tr>
          </thead>
          <tbody>{read.data.data.map((item) => {
            const identity = `${item.beneficiary_id}:${item.order_id}`
            const otherBeneficiary = items.length > 0 && (items[0].beneficiary_id !== item.beneficiary_id || items[0].currency !== item.currency)
            return <tr key={identity}>
              {props.role === 'admin' && props.canManage && <td>
                <input
                  type="checkbox"
                  aria-label={`Select payout for ${item.order_reference} to ${item.beneficiary_name}`}
                  checked={selected.includes(identity)}
                  disabled={action.busy || otherBeneficiary || item.blocked.length > 0}
                  onChange={(event) => setSelected(event.target.checked ? [...selected, identity] : selected.filter((id) => id !== identity))} />
              </td>}
              <td>{item.order_reference}</td>
              <td>{item.beneficiary_name}</td>
              <td className="payment-numeric">{money(item.amount_cents, item.currency)}</td>
              <td className="payment-date">{date(item.eligible_at)}</td>
              <td>{item.blocked.length ? <span className="payment-attention">{item.blocked.join(', ')}</span> : <StatusText value={early ? 'ready for manual payout' : 'ready'} />}</td>
            </tr>
          })}</tbody>
        </PaymentTable> : <EmptyState title="No unpaid obligations." description="New eligible delivery amounts will appear here." />}
        {props.role === 'admin' && props.canManage && <div className="payment-selection">
          <div>
            <p>
              {`${items.length} ${items.length === 1 ? 'order' : 'orders'} selected`}{' '}
              <strong className="payment-amount">· {money(total, items[0]?.currency)}</strong>
            </p>
            <p className="payment-muted">{items[0] ? `Paying ${items[0].beneficiary_name}.` : 'Select orders for one beneficiary and currency.'}{early && ' The Logistics waiting period will be bypassed.'}</p>
          </div>
          <Button disabled={items.length === 0} isLoading={action.busy} onClick={send}>Send payout</Button>
        </div>}
        <Paging page={read.data} value={page} change={(value) => { setPage(value); setSelected([]) }} />
      </>}
    </PaymentSection>
    <PaymentSection title="Payment history" description="Receipts are available after successful payment.">
      <Feedback loading={history.loading} error={history.error} retry={history.reload} />
      {history.data && <>
        {history.data.data.length > 0 ? <PaymentTable caption="Payout history">
          <thead>
            <tr>
              <th scope="col">Submitted · Manila time</th>
              <th scope="col">Beneficiary</th>
              <th scope="col" className="payment-numeric">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Gateway reference</th>
              <th scope="col">Receipt</th>
            </tr>
          </thead>
          <tbody>{history.data.data.map((payout) => <tr key={payout.id}>
            <td className="payment-date">{date(payout.submitted_at)}</td>
            <td>{payout.beneficiary_name ?? payout.beneficiary_type}</td>
            <td className="payment-numeric">{money(payout.amount_cents, payout.currency)}</td>
            <td>
              <StatusText value={payout.status} />
              {payout.attempts.some((a) => a.status === 'unknown') && <p className="payment-muted">Verifying outcome</p>}
            </td>
            <td className="payment-reference">{payout.provider_reference ?? 'Awaiting reference'}</td>
            <td>{payout.status === 'succeeded' ? <Button
              variant="outline"
              disabled={action.busy}
              aria-label={`Download PDF receipt for payout ${payout.provider_reference ?? payout.id}`}
              onClick={() => void action.act(`pdf:${payout.id}`, () => downloadPdf(props.url(`${props.prefix}/payout-history/${payout.id}/receipt`), `payout-${payout.id}.pdf`), 'Payment receipt downloaded.')}>
              Download PDF
            </Button> : <span className="payment-muted">Not yet available</span>}</td>
          </tr>)}</tbody>
        </PaymentTable> : <EmptyState title="No payouts yet." description="Submitted payments will appear here with their current status." />}
        <Paging page={history.data} value={historyPage} change={setHistoryPage} />
      </>}
    </PaymentSection>
    <p className="payment-muted">All dates use Asia/Manila time. Sandbox payments use simulated money.</p>
  </PaymentShell>
}
