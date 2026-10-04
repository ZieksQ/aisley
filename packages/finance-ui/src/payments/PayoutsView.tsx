import { useState } from 'react'
import { Button } from '@aisley/ui'
import { downloadPdf } from './client'
import { date, Feedback, money, Paging, PaymentShell } from './common'
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
  function send() {
    const first = items[0]
    if (!first || !window.confirm(`Send ${money(total, first.currency)} to ${first.beneficiary_name}${early ? ' before the configured waiting period' : ''} through the sandbox gateway?`)) return
    void action.act(JSON.stringify([type, early, selected.slice().sort()]), async (key) => {
      await read.client.write('/payout-send', { beneficiary_type: type, beneficiary_id: first.beneficiary_id, order_ids: items.map((item) => item.order_id), early, idempotency_key: key })
      setSelected([])
      read.reload()
      history.reload()
    }, 'Payout queued. Check payment history for gateway confirmation.')
  }
  return <PaymentShell title="Payouts">

    <p>
      Sandbox payments · Eligibility requires cleared COD and no financial holds. Times shown are Asia/Manila.
    </p>

    {props.role === 'admin' && <div className="payment-toolbar">

      <label>
        Beneficiary
        <select value={type} onChange={(event) => { setType(event.target.value); setEarly(false); setSelected([]); setPage(1) }}>
          <option value="seller">
            Sellers
          </option>
          <option value="logistics">
            Logistics
          </option>
        </select>
      </label>

      {type === 'logistics' && props.canManage && <label>
        <input type="checkbox" checked={early} onChange={(event) => { setEarly(event.target.checked); setSelected([]) }} />
        Allow early manual Logistics payout
      </label>}

    </div>}

    <Feedback
      loading={read.loading}
      error={read.error || history.error || action.error}
      message={action.message}
      retry={() => { read.reload(); history.reload(); setSelected([]) }} />

    <h3>
      Unpaid obligations
    </h3>

    {read.data && <><div
      className="payment-table"
      role="region"
      aria-label="Unpaid payout obligations"
      tabIndex={0}>
      <table>

        <thead>
          <tr>
            {props.role === 'admin' && props.canManage && <th>
              Select
            </th>}
            <th>
              Order
            </th>
            <th>
              Beneficiary
            </th>
            <th>
              Amount
            </th>
            <th>
              Eligible after
            </th>
            <th>
              Blocking conditions
            </th>
          </tr>
        </thead>

        <tbody>
          {read.data.data.map((item) => {
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

              <td>
                {item.order_reference}
              </td>
              <td>
                {item.beneficiary_name}
              </td>
              <td>
                {money(item.amount_cents, item.currency)}
              </td>
              <td>
                {date(item.eligible_at)}
              </td>
              <td>
                {item.blocked.join(', ') || (early ? 'Ready for manual payout' : 'Ready')}
              </td>

            </tr>
          })}
        </tbody>

      </table>
    </div>{read.data.data.length === 0 && <p>
      No unpaid obligations.
    </p>}<Paging page={read.data} value={page} change={(value) => { setPage(value); setSelected([]) }} /></>}

    {props.role === 'admin' && props.canManage && <div className="payment-toolbar">
      <span>
        {items.length}
        selected ·
        {money(total)}
      </span>
      <Button disabled={items.length === 0} isLoading={action.busy} onClick={send}>
        Send payout
      </Button>
    </div>}

    <h3>
      Payment history
    </h3>
    <Button variant="outline" onClick={history.reload}>
      Refresh payments
    </Button>

    {history.data && <><div
      className="payment-table"
      role="region"
      aria-label="Payout history"
      tabIndex={0}>
      <table>

        <thead>
          <tr>
            <th>
              Submitted
            </th>
            <th>
              Beneficiary
            </th>
            <th>
              Amount
            </th>
            <th>
              Status
            </th>
            <th>
              Gateway reference
            </th>
            <th>
              Receipt
            </th>
          </tr>
        </thead>

        <tbody>
          {history.data.data.map((payout) => <tr key={payout.id}>
            <td>
              {date(payout.submitted_at)}
            </td>
            <td>
              {payout.beneficiary_name ?? payout.beneficiary_type}
            </td>
            <td>
              {money(payout.amount_cents, payout.currency)}
            </td>
            <td>
              {payout.status}
              {payout.attempts.some((a) => a.status === 'unknown') && ' · verifying outcome'}
            </td>
            <td>
              {payout.provider_reference ?? 'Pending reference'}
            </td>
            <td>
              {payout.status === 'succeeded' ? <Button variant="outline" disabled={action.busy} onClick={() => void action.act(`pdf:${payout.id}`, () => downloadPdf(props.url(`${props.prefix}/payout-history/${payout.id}/receipt`), `payout-${payout.id}.pdf`), 'Payment receipt downloaded.')}>
                Download PDF
              </Button> : 'Available after success'}
            </td>
          </tr>)}
        </tbody>

      </table>
    </div>{history.data.data.length === 0 && <p>
      No payouts yet.
    </p>}<Paging page={history.data} value={historyPage} change={setHistoryPage} /></>}

  </PaymentShell>
}
