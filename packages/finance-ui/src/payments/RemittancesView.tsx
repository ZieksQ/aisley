import { DateRangePicker, useReportPeriod } from '@aisley/ui/date-range'
import { useEffect, useState } from 'react'
import { SelectField, TextField } from '@aisley/ui'
import { Button, date, EmptyState, Feedback, label, money, Paging, PaymentShell, PaymentTable, StatusText } from './common'
import { useFinanceRead, usePaymentAction } from './hooks'
import type { Attempt, Batch, Invoice, Page, PaymentProps, SettingsResponse } from './types'
export function RemittancesView(props: PaymentProps) {
  const period = useReportPeriod(props.filters)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'invoices' | 'history'>('invoices')
  const [selected, setSelected] = useState<string[]>([])
  const invoices = useFinanceRead<Page<Invoice>>(props, `/invoices?page=${page}&status=${status}&search=${encodeURIComponent(query)}&${period.query}`)
  const batches = useFinanceRead<Page<Batch>>(props, `/remittances?page=${page}&${period.query}`)
  const settings = useFinanceRead<SettingsResponse>(props, '/automation')
  const action = usePaymentAction()
  useEffect(() => { if (!action.busy && !action.uncertain) setSelected([]) }, [period.query, action.busy, action.uncertain])
  const payable = invoices.data?.data.filter((invoice) => selected.includes(invoice.id) && invoice.status === 'outstanding') ?? []
  const total = payable.reduce((sum, invoice) => sum + invoice.remaining_cents, 0)
  function reset() { setPage(1); setSelected([]) }
  function refresh() { invoices.reload(); batches.reload(); setSelected([]) }
  function pay() {
    if (!window.confirm(`Pay ${money(total, payable[0]?.currency)} for ${payable.length} COD invoice(s) through the sandbox gateway?`)) return
    void action.act(JSON.stringify(payable.map((i) => i.id).sort()), async (key) => {
      const response = await invoices.client.write<{ data: Attempt }>('/invoice-payments', { invoice_ids: payable.map((i) => i.id), idempotency_key: key })
      refresh()
      if (response.data.cod_remittance_batch_id) props.openBatch?.(response.data.cod_remittance_batch_id)
    }, 'Payment queued. Gateway confirmation will update its status.')
  }
  const displayed = tab === 'invoices' ? invoices : batches
  const policy = settings.data?.data
  return <PaymentShell
    title="COD remittances"
    description="Review delivery invoices and track payments to Aisley."
    actions={<Button variant="outline" disabled={action.busy || action.uncertain} onClick={refresh}>Refresh</Button>}>
    {invoices.data?.summary && <dl className="payment-summary">
      <div>
        <dt>Current outstanding COD · all dates</dt>
        <dd>{money(invoices.data.summary.outstanding_cents, invoices.data.summary.currency)}</dd>
      </div>
      <div>
        <dt>Current overdue · all dates</dt>
        <dd>{money(invoices.data.summary.overdue_cents, invoices.data.summary.currency)}</dd>
      </div>
    </dl>}
    {props.role === 'logistics' && policy && <p className="payment-notice">
      {'Daily collection at '}
      <strong>{policy.collection?.collection_time ?? '09:00'}</strong>{' · Next run: '}{date(policy.next_collection_at)}.
      {` Payment is due ${policy.platform.cod_deadline_hours} hours after delivery.`}
      {!policy.platform.collection_enabled && ' Automatic collection is paused.'}
    </p>}
    <div>
      <div className="payment-tabs" role="group" aria-label="Remittance view">
        <button className="payment-tab" disabled={action.busy || action.uncertain} aria-pressed={tab === 'invoices'} onClick={() => { setTab('invoices'); reset() }}>Invoices</button>
        <button className="payment-tab" disabled={action.busy || action.uncertain} aria-pressed={tab === 'history'} onClick={() => { setTab('history'); reset() }}>Payment history</button>
      </div>
      <DateRangePicker label={tab === 'invoices' ? 'Invoice delivery date' : 'Remittance submission date'} value={period.period} disabled={action.busy || action.uncertain} onApply={(value) => { period.apply(value); reset() }} />
      {tab === 'invoices' && <form
        className="payment-filters"
        role="search"
        onSubmit={(event) => { event.preventDefault(); setQuery(search); reset() }}>
        <TextField
          id="invoice-search"
          disabled={action.busy || action.uncertain}
          label="Search invoices"
          type="search"
          placeholder="Order, invoice, or organization"
          value={search}
          onChange={(event) => setSearch(event.target.value)} />
        <SelectField
          id="invoice-status"
          disabled={action.busy || action.uncertain}
          label="Status"
          value={status}
          onChange={(event) => { setStatus(event.target.value); reset() }}>
          <option value="">All statuses</option>
          {['outstanding', 'processing', 'paid', 'overdue', ...(props.role === 'admin' ? ['review'] : [])].map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </SelectField>
        <Button variant="secondary" disabled={action.busy || action.uncertain} type="submit">Search</Button>
      </form>}
      <Feedback
        loading={displayed.loading}
        error={displayed.error || action.error || settings.error}
        message={action.message}
        retry={displayed.reload} />
      {tab === 'invoices' && invoices.data && <>
        {invoices.data.data.length > 0 ? <PaymentTable caption="COD invoices">
          <thead>
            <tr>
              {props.role === 'logistics' && <th scope="col">Select</th>}
              <th scope="col">Order / invoice</th>
              {props.role === 'admin' && <th scope="col">Collector</th>}
              <th scope="col" className="payment-numeric">Outstanding</th>
              <th scope="col">Due · Manila time</th>
              <th scope="col">Status</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>{invoices.data.data.map((invoice) => <tr key={invoice.id}>
            {props.role === 'logistics' && <td>
              <input
                type="checkbox"
                aria-label={`Select ${invoice.order_reference}`}
                checked={selected.includes(invoice.id)}
                disabled={action.busy || action.uncertain || invoice.status !== 'outstanding' || (payable.length > 0 && payable[0].currency !== invoice.currency)}
                onChange={(event) => setSelected(event.target.checked ? [...selected, invoice.id] : selected.filter((id) => id !== invoice.id))} />
            </td>}
            <td>
              <span>{invoice.order_reference}</span>
              <p className="payment-reference">{invoice.reference}</p>
            </td>
            {props.role === 'admin' && <td>{invoice.collector_name ?? 'Requires review'}</td>}
            <td className="payment-numeric">{money(invoice.remaining_cents, invoice.currency)}</td>
            <td className="payment-date">{date(invoice.due_at)}</td>
            <td>
              <StatusText value={invoice.status} />
              {invoice.overdue && <p className="payment-attention">Overdue</p>}
            </td>
            <td>
              <button
                className="payment-link"
                onClick={() => props.openInvoice?.(invoice.id)}
                aria-label={`View invoice for ${invoice.order_reference}`}>View invoice</button>
            </td>
          </tr>)}</tbody>
        </PaymentTable> : <EmptyState title="No invoices match these filters." description="Try another search or choose a different status." />}
        {props.role === 'logistics' && <div className="payment-selection">
          <div>
            <p>
              {`${payable.length} ${payable.length === 1 ? 'invoice' : 'invoices'} selected`}{' '}
              <strong className="payment-amount">· {money(total, payable[0]?.currency)}</strong>
            </p>
            <p className="payment-muted">Pays the full remaining balance through the sandbox gateway.</p>
          </div>
          <Button disabled={payable.length === 0 || !policy?.gateway_enabled} isLoading={action.busy} onClick={pay}>Pay now</Button>
        </div>}
        <Paging disabled={action.busy || action.uncertain} page={invoices.data} value={page} change={(value) => { setPage(value); setSelected([]) }} />
      </>}
      {tab === 'history' && batches.data && <>
        {batches.data.data.length > 0 ? <PaymentTable caption="Remittance history">
          <thead>
            <tr>
              <th scope="col">Submitted · Manila time</th>
              <th scope="col">Reference</th>
              {props.role === 'admin' && <th scope="col">Collector</th>}
              <th scope="col" className="payment-numeric">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>{batches.data.data.map((batch) => <tr key={batch.id}>
            <td className="payment-date">{date(batch.submitted_at)}</td>
            <td className="payment-reference">{batch.reference}</td>
            {props.role === 'admin' && <td>{batch.collector_name ?? 'Unknown collector'}</td>}
            <td className="payment-numeric">{money(batch.total_cents, batch.currency)}</td>
            <td>
              <StatusText value={batch.status} />
            </td>
            <td>
              <button
                className="payment-link"
                onClick={() => props.openBatch?.(batch.id)}
                aria-label={`View payment ${batch.reference}`}>View payment</button>
            </td>
          </tr>)}</tbody>
        </PaymentTable> : <EmptyState title="No remittance payments yet." description="Payments will appear here after invoices are submitted." />}
        <Paging disabled={action.busy || action.uncertain} page={batches.data} value={page} change={setPage} />
      </>}
    </div>
    <p className="payment-muted">All dates and schedules use Asia/Manila time. Sandbox payments use simulated money.</p>
  </PaymentShell>
}
