import { useState } from 'react'
import { Button, TextField } from '@aisley/ui'
import { date, Feedback, money, Paging, PaymentShell } from './common'
import { useFinanceRead, usePaymentAction } from './hooks'
import type { GatewayAccount, PaymentProps, SandboxResponse } from './types'

export function SandboxView(props: PaymentProps) {
  const [page, setPage] = useState(1)
  const read = useFinanceRead<SandboxResponse>(props, `/sandbox?page=${page}`)
  const [reference, setReference] = useState('')
  const [balance, setBalance] = useState('100000000')
  const [scenario, setScenario] = useState('success')
  const [active, setActive] = useState(true)
  const action = usePaymentAction()
  function edit(account: GatewayAccount) {
    setReference(account.reference)
    setBalance(String(account.balance_cents))
    setScenario(account.scenario)
    setActive(account.is_active)
  }
  return <PaymentShell title="Payment gateway sandbox">

    <p>
      Configure simulated balances and gateway outcomes. No real money moves.
    </p>

    <Feedback
      loading={read.loading}
      error={read.error || action.error}
      message={action.message}
      retry={read.reload} />

    {props.canManage && <form onSubmit={(event) => { event.preventDefault(); void action.act('account', async () => { await read.client.write('/sandbox/accounts', { reference, balance_cents: Number(balance), scenario, is_active: active }, 'PUT'); read.reload() }, 'Sandbox account saved.') }}>

      <h3>
        Account configuration
      </h3>
      <div className="payment-fields">

        <TextField
          id="gateway-account"
          label="Account reference"
          required
          maxLength={120}
          value={reference}
          onChange={(e) => setReference(e.target.value)} />

        <TextField
          id="gateway-balance"
          label="Simulated balance (centavos)"
          type="number"
          min="0"
          max="100000000000"
          required
          value={balance}
          onChange={(e) => setBalance(e.target.value)} />

        <label>
          Outcome
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
            {['success', 'failure', 'insufficient_funds', 'delay', 'duplicate_callback', 'lost_response'].map((value) => <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>)}
          </select>
        </label>

        <label>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Account active
        </label>

      </div>
      <div className="payment-toolbar">
        <Button type="submit" isLoading={action.busy}>
          Save account
        </Button>
      </div>

    </form>}

    <h3>
      Accounts
    </h3>
    <ul className="payment-list">
      {read.data?.accounts.map((account) => <li key={account.id}>
        <p>
          {account.reference}
          ·
          {money(account.balance_cents)}
          ·
          {account.scenario.replaceAll('_', ' ')}
          ·
          {account.is_active ? 'Active' : 'Inactive'}
        </p>
        {props.canManage && account.reference !== 'platform' && <Button variant="outline" onClick={() => edit(account)}>
          Edit account
        </Button>}
      </li>)}
    </ul>

    <h3>
      Gateway payments
    </h3>
    <Button variant="outline" onClick={read.reload}>
      Refresh
    </Button>

    {read.data && <><ul className="payment-list">
      {read.data.transactions.data.map((transaction) => <li key={transaction.id}>

        <strong>
          {transaction.direction}
          ·
          {money(transaction.amount_cents, transaction.currency)}
          ·
          {transaction.status}
        </strong>

        <p>
          {transaction.id}
          ·
          {transaction.account_reference}
          ·
          {date(transaction.created_at)}
        </p>
        <p>
          API request: amount_cents=
          {transaction.amount_cents}
          , currency=
          {transaction.currency}
          , attempt_id=
          {transaction.metadata.attempt_id}
        </p>

        {transaction.failure_code && <p>
          Response:
          {transaction.failure_code}
        </p>}

        {props.canManage && transaction.status === 'pending' && <div className="payment-toolbar">
          {['success', 'failure', 'insufficient_funds'].map((outcome) => <Button
            key={outcome}
            variant="outline"
            disabled={action.busy}
            onClick={() => { if (!window.confirm(`Resolve this simulated payment as ${outcome.replaceAll('_', ' ')}?`)) return; void action.act(`resolve:${transaction.id}`, async () => { await read.client.write(`/sandbox/payments/${transaction.id}/resolve`, { outcome }); read.reload() }, 'Gateway result queued for delivery.') }}>
            {outcome.replaceAll('_', ' ')}
          </Button>)}
        </div>}

      </li>)}
    </ul>{read.data.transactions.data.length === 0 && <p>
      No gateway payments yet.
    </p>}<Paging page={read.data.transactions} value={page} change={setPage} /></>}

    <h3>
      Webhook deliveries
    </h3>
    <ul className="payment-list">
      {read.data?.events.map((event) => <li key={event.id}>

        <p>
          {event.payload.type}
          ·
          {event.delivery_attempts}
          attempt(s) ·
          {event.delivered_at ? `Delivered ${date(event.delivered_at)}` : 'Awaiting delivery'}
        </p>

        <details>
          <summary>
            Event payload
          </summary>
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </details>

        {props.canManage && <Button variant="outline" disabled={action.busy} onClick={() => void action.act(`replay:${event.id}`, async () => { await read.client.write(`/sandbox/events/${event.id}/replay`, {}); read.reload() }, 'Signed webhook replay queued.')}>
          Replay webhook
        </Button>}

      </li>)}
    </ul>

  </PaymentShell>
}
