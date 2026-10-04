import { useState } from 'react'
import { Button, TextField } from '@aisley/ui'
import { date, Feedback, money, Paging, PaymentShell } from './common'
import { useFinanceRead, usePaymentAction } from './hooks'
import type { Attempt, Batch, Invoice, Page, PaymentProps, SettingsResponse } from './types'

export function RemittancesView(props: PaymentProps) {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'invoices' | 'history'>('invoices')
  const [selected, setSelected] = useState<string[]>([])
  const invoices = useFinanceRead<Page<Invoice>>(props, `/invoices?page=${page}&status=${status}&search=${encodeURIComponent(query)}`)
  const batches = useFinanceRead<Page<Batch>>(props, `/remittances?page=${page}`)
  const settings = useFinanceRead<SettingsResponse>(props, '/automation')
  const action = usePaymentAction()
  const payable = invoices.data?.data.filter((invoice) => selected.includes(invoice.id) && invoice.status === 'outstanding') ?? []
  const total = payable.reduce((sum, invoice) => sum + invoice.remaining_cents, 0)
  function reset() { setPage(1); setSelected([]) }
  function pay() {
    if (!window.confirm(`Pay ${money(total)} for ${payable.length} COD invoice(s) through the sandbox gateway?`)) return
    void action.act(JSON.stringify(payable.map((i) => i.id).sort()), async (key) => {
      const response = await invoices.client.write<{ data: Attempt }>('/invoice-payments', { invoice_ids: payable.map((i) => i.id), idempotency_key: key })
      setSelected([])
      invoices.reload()
      batches.reload()
      if (response.data.cod_remittance_batch_id) props.openBatch?.(response.data.cod_remittance_batch_id)
    }, 'Payment queued. Gateway confirmation will update its status.')
  }
  const displayed = tab === 'invoices' ? invoices : batches
  return <PaymentShell title="COD remittances">

    <p>
      Invoices issue on confirmed delivery. Times shown are Asia/Manila. Payments use simulated money.
    </p>

    {invoices.data?.summary && <p>Outstanding COD: {money(invoices.data.summary.outstanding_cents, invoices.data.summary.currency)} · Overdue: {money(invoices.data.summary.overdue_cents, invoices.data.summary.currency)}</p>}
    {props.role === 'logistics' && settings.data && <p>
      Daily collection:
      {settings.data.data.collection?.collection_time ?? '09:00'}
      · Next run:
      {date(settings.data.data.next_collection_at)}
      · Deadline:
      {settings.data.data.platform.cod_deadline_hours}
      hours after delivery
      {!settings.data.data.platform.collection_enabled && ' · Automatic collection is paused'}
    </p>}

    <div className="payment-toolbar">
      <Button variant={tab === 'invoices' ? 'secondary' : 'outline'} onClick={() => { setTab('invoices'); reset() }}>
        Invoices
      </Button>
      <Button variant={tab === 'history' ? 'secondary' : 'outline'} onClick={() => { setTab('history'); reset() }}>
        Payment history
      </Button>
      <Button variant="outline" onClick={() => { invoices.reload(); batches.reload(); setSelected([]) }}>
        Refresh
      </Button>
    </div>

    {tab === 'invoices' && <form className="payment-toolbar" onSubmit={(event) => { event.preventDefault(); setQuery(search); reset() }}>
      <TextField
        id="invoice-search"
        label="Search Order, invoice, or organization"
        value={search}
        onChange={(event) => setSearch(event.target.value)} />
      <label>
        Status
        <select value={status} onChange={(event) => { setStatus(event.target.value); reset() }}>
          <option value="">
            All
          </option>
          {['outstanding', 'processing', 'paid', 'overdue', ...(props.role === 'admin' ? ['review'] : [])].map((value) => <option key={value} value={value}>
            {value}
          </option>)}
        </select>
      </label>
      <Button variant="outline" type="submit">
        Search
      </Button>
    </form>}

    <Feedback
      loading={displayed.loading}
      error={displayed.error || action.error || settings.error}
      message={action.message}
      retry={displayed.reload} />

    {tab === 'invoices' && invoices.data && <><div
      className="payment-table"
      role="region"
      aria-label="COD invoices"
      tabIndex={0}>
      <table>
        <thead>
          <tr>
            {props.role === 'logistics' && <th>
              Select
            </th>}
            <th>
              Order
            </th>
            {props.role === 'admin' && <th>
              Collector
            </th>}
            <th>
              Outstanding
            </th>
            <th>
              Due
            </th>
            <th>
              Status
            </th>
            <th>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.data.data.map((invoice) => <tr key={invoice.id}>
            {props.role === 'logistics' && <td>
              <input
                type="checkbox"
                aria-label={`Select ${invoice.order_reference}`}
                checked={selected.includes(invoice.id)}
                disabled={action.busy || invoice.status !== 'outstanding'}
                onChange={(event) => setSelected(event.target.checked ? [...selected, invoice.id] : selected.filter((id) => id !== invoice.id))} />
            </td>}
            <td>
              {invoice.order_reference}
            </td>
            {props.role === 'admin' && <td>
              {invoice.collector_name ?? 'Requires review'}
            </td>}
            <td>
              {money(invoice.remaining_cents, invoice.currency)}
            </td>
            <td>
              {date(invoice.due_at)}
            </td>
            <td>
              {invoice.status}
              {invoice.overdue ? ' · overdue' : ''}
            </td>
            <td>
              <button className="payment-link" onClick={() => props.openInvoice?.(invoice.id)}>
                View invoice
              </button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>{invoices.data.data.length === 0 && <p>
      No invoices match these filters.
    </p>}{props.role === 'logistics' && <div className="payment-toolbar">
      <span>
        {payable.length}
        selected ·
        {money(total)}
      </span>
      <Button disabled={payable.length === 0 || !settings.data?.data.gateway_enabled} isLoading={action.busy} onClick={pay}>
        Pay now
      </Button>
    </div>}<Paging page={invoices.data} value={page} change={(value) => { setPage(value); setSelected([]) }} /></>}

    {tab === 'history' && batches.data && <><div
      className="payment-table"
      role="region"
      aria-label="Remittance history"
      tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th>
              Submitted
            </th>
            <th>
              Reference
            </th>
            {props.role === 'admin' && <th>
              Collector
            </th>}
            <th>
              Amount
            </th>
            <th>
              Status
            </th>
            <th>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {batches.data.data.map((batch) => <tr key={batch.id}>
            <td>
              {date(batch.submitted_at)}
            </td>
            <td>
              {batch.reference}
            </td>
            {props.role === 'admin' && <td>
              {batch.collector_name ?? 'Unknown collector'}
            </td>}
            <td>
              {money(batch.total_cents, batch.currency)}
            </td>
            <td>
              {batch.status}
            </td>
            <td>
              <button className="payment-link" onClick={() => props.openBatch?.(batch.id)}>
                View payment
              </button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>{batches.data.data.length === 0 && <p>
      No remittance payments yet.
    </p>}<Paging page={batches.data} value={page} change={setPage} /></>}

  </PaymentShell>
}
