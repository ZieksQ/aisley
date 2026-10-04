import { useState } from 'react'
import { SelectField, TextField } from '@aisley/ui'
import { Button, date, EmptyState, Feedback, label, money, Paging, PaymentShell, PaymentTable, StatusText } from './common'
import { useFinanceRead, usePaymentAction, useUnsavedPaymentForm } from './hooks'
import type { GatewayAccount, PaymentProps, SandboxResponse } from './types'
export function SandboxView(props: PaymentProps) {
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'accounts' | 'payments' | 'webhooks'>('accounts')
  const [editor, setEditor] = useState<GatewayAccount | 'new' | null>(null)
  const read = useFinanceRead<SandboxResponse>(props, `/sandbox?page=${page}`)
  const action = usePaymentAction()
  const [message, setMessage] = useState('')
  return <PaymentShell
    title="Payment gateway sandbox"
    description="Test account balances and payment outcomes. No real money moves."
    actions={<Button variant="outline" onClick={read.reload}>Refresh</Button>}>
    <Feedback loading={read.loading} error={read.error || action.error} message={action.message || message} retry={read.reload} />
    <div>
      <div className="payment-tabs" role="group" aria-label="Sandbox view">
        {(['accounts', 'payments', 'webhooks'] as const).map((value) => <button
          key={value}
          className="payment-tab"
          aria-pressed={tab === value}
          onClick={() => {
            if (editor && !window.confirm('Close the account form and discard unsaved changes?')) return
            setEditor(null); setTab(value)
          }}>{value === 'webhooks' ? 'Webhook deliveries' : label(value)}</button>)}
      </div>
      {tab === 'accounts' && <>
        {props.canManage && <div className="payment-toolbar">
          <Button
            variant="secondary"
            onClick={() => {
              if (editor && !window.confirm('Discard the current account changes?')) return
              setEditor('new')
            }}>Add account</Button>
        </div>}
        {read.data && (read.data.accounts.length ? <PaymentTable caption="Sandbox accounts">
          <thead>
            <tr>
              <th scope="col">Account reference</th>
              <th scope="col" className="payment-numeric">Balance</th>
              <th scope="col">Simulated outcome</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>{read.data.accounts.map((account) => <tr key={account.id}>
            <td className="payment-reference">{account.reference}</td>
            <td className="payment-numeric">{money(account.balance_cents)}</td>
            <td>{label(account.scenario)}</td>
            <td>
              <StatusText value={account.is_active ? 'active' : 'inactive'} />
            </td>
            <td>{props.canManage && account.reference !== 'platform' && <Button
              variant="outline"
              onClick={() => {
                if (editor && !window.confirm('Discard the current account changes?')) return
                setEditor(account)
              }}>Edit account</Button>}</td>
          </tr>)}</tbody>
        </PaymentTable> : <EmptyState title="No sandbox accounts." description="Accounts are provisioned when a payment is reserved." />)}
        {editor && <AccountEditor
          key={editor === 'new' ? 'new' : editor.id}
          {...props}
          account={editor === 'new' ? null : editor}
          cancel={() => setEditor(null)}
          saved={() => { setMessage('Sandbox account saved.'); setEditor(null); read.reload() }} />}
      </>}
      {tab === 'payments' && read.data && <>
        {read.data.transactions.data.length ? <ul className="payment-list">
          {read.data.transactions.data.map((transaction) => <li key={transaction.id}>
            <div className="payment-row-heading">
              <div>
                <strong>{label(transaction.direction)}</strong>
                <p className="payment-muted">{transaction.account_reference}</p>
              </div>
              <div>
                <strong className="payment-amount">{money(transaction.amount_cents, transaction.currency)}</strong>{' · '}
                <StatusText value={transaction.status} />
              </div>
            </div>
            <p className="payment-muted">{date(transaction.created_at)}</p>
            {transaction.failure_code && <p className="payment-attention">{label(transaction.failure_code)}</p>}
            <details>
              <summary>Transaction details</summary>
              <dl className="payment-details">
                <div>
                  <dt>Transaction ID</dt>
                  <dd>{transaction.id}</dd>
                </div>
                <div>
                  <dt>Payment attempt</dt>
                  <dd>{transaction.metadata.attempt_id}</dd>
                </div>
                <div>
                  <dt>Amount in centavos</dt>
                  <dd>{transaction.amount_cents}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{transaction.currency}</dd>
                </div>
              </dl>
            </details>
            {props.canManage && transaction.status === 'pending' && <div className="payment-toolbar">
              {['success', 'failure', 'insufficient_funds'].map((outcome) => <Button
                key={outcome}
                variant="outline"
                disabled={action.busy}
                onClick={() => {
                  if (!window.confirm(`Resolve this simulated payment as ${outcome.replaceAll('_', ' ')}?`)) return
                  void action.act(`resolve:${transaction.id}`, async () => {
                    await read.client.write(`/sandbox/payments/${transaction.id}/resolve`, { outcome }); read.reload()
                  }, 'Gateway result queued for delivery.')
                }}>{label(outcome)}</Button>)}
            </div>}
          </li>)}
        </ul> : <EmptyState title="No gateway payments yet." description="Submit a COD payment or payout to test an outcome." />}
        <Paging page={read.data.transactions} value={page} change={setPage} />
      </>}
      {tab === 'webhooks' && read.data && (read.data.events.length ? <ul className="payment-list">
        {read.data.events.map((event) => <li key={event.id}>
          <div className="payment-row-heading">
            <strong>{event.payload.type}</strong>
            <StatusText value={event.delivered_at ? 'delivered' : 'awaiting delivery'} />
          </div>
          <p className="payment-muted">{event.delivery_attempts} {event.delivery_attempts === 1 ? 'attempt' : 'attempts'}{event.delivered_at ? ` · Delivered ${date(event.delivered_at)}` : ''}</p>
          <details>
            <summary>Event payload</summary>
            <pre className="payment-code">{JSON.stringify(event.payload, null, 2)}</pre>
          </details>
          {props.canManage && <div className="payment-toolbar">
            <Button
              variant="outline"
              disabled={action.busy}
              onClick={() => void action.act(`replay:${event.id}`, async () => { await read.client.write(`/sandbox/events/${event.id}/replay`, {}); read.reload() }, 'Signed webhook replay queued.')}>Replay webhook</Button>
          </div>}
        </li>)}
      </ul> : <EmptyState title="No webhook deliveries." description="Completed gateway payments generate signed events." />)}
    </div>
  </PaymentShell>
}
function AccountEditor(props: PaymentProps & { account: GatewayAccount | null; cancel: () => void; saved: () => void }) {
  const [reference, setReference] = useState(props.account?.reference ?? '')
  const [balance, setBalance] = useState(String((props.account?.balance_cents ?? 100000000) / 100))
  const [scenario, setScenario] = useState(props.account?.scenario ?? 'success')
  const [active, setActive] = useState(props.account?.is_active ?? true)
  const action = usePaymentAction()
  const dirty = reference !== (props.account?.reference ?? '') || Number(balance) * 100 !== (props.account?.balance_cents ?? 100000000)
    || scenario !== (props.account?.scenario ?? 'success') || active !== (props.account?.is_active ?? true)
  useUnsavedPaymentForm(dirty)
  return <form
    className="payment-editor"
    onSubmit={(event) => {
      event.preventDefault()
      void action.act('account', async () => {
        await props.request(`${props.prefix}/sandbox/accounts`, { method: 'PUT', body: JSON.stringify({ reference, balance_cents: Math.round(Number(balance) * 100), scenario, is_active: active }) })
        props.saved()
      }, 'Sandbox account saved.')
    }}>
    <h3>{props.account ? 'Edit sandbox account' : 'Add sandbox account'}</h3>
    <Feedback error={action.error} />
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
        label="Simulated balance (PHP)"
        type="number"
        min="0"
        max="1000000000"
        step="0.01"
        required
        value={balance}
        onChange={(e) => setBalance(e.target.value)} />
      <SelectField
        id="gateway-outcome"
        label="Simulated outcome"
        value={scenario}
        onChange={(e) => setScenario(e.target.value)}>
        {['success', 'failure', 'insufficient_funds', 'delay', 'duplicate_callback', 'lost_response'].map((value) => <option key={value} value={value}>{label(value)}</option>)}
      </SelectField>
      <label className="payment-checkbox">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Account active
      </label>
    </div>
    <div className="payment-toolbar">
      <Button type="submit" isLoading={action.busy}>Save account</Button>
      <Button
        variant="outline"
        disabled={action.busy}
        onClick={() => { if (!dirty || window.confirm('Discard unsaved account changes?')) props.cancel() }}>Cancel</Button>
    </div>
  </form>
}
