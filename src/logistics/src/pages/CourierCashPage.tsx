import { Button } from '@aisley/ui'
import { FinanceNavigation } from '../components/FinanceNavigation'
import { ErrorNotice, field } from '../components/PickupUi'
import { CashReceiptHistory } from '../features/logisticsFinance/CashReceiptHistory'
import { useCourierCash } from '../features/logisticsFinance/useCourierCash'
import { date, money, workflowButton, workspace } from '../features/logisticsFinance/presentation'

export function CourierCashPage() {
  const state = useCourierCash()
  const rows = state.data?.data ?? []
  const selectedRows = state.attempt?.selection ?? rows.filter((row) => state.selected.includes(row.id))
  const total = selectedRows.reduce((sum, row) => sum + row.amount_cents, 0)
  const balances = state.data?.balances ?? []
  const totals = balances.reduce<Record<string, number>>((result, item) => ({ ...result, [item.currency]: (result[item.currency] ?? 0) + item.outstanding_cents }), {})
  const lastPage = (state.view === 'outstanding' ? state.data : state.history)?.meta.last_page ?? 1
  return <>
    <FinanceNavigation />
    <main className={workspace}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
        <div>
          <h2 className="text-xl font-semibold">Courier cash remittance</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Record COD cash received from Couriers after delivery approval.</p>
        </div>
        <Button variant="outline" className={workflowButton} disabled={state.busy || state.loading} onClick={state.reload}>Refresh</Button>
      </header>
      <nav className="mt-4 flex gap-5 border-b border-zinc-200 dark:border-white/10" aria-label="Courier cash views">
        {(['outstanding', 'history'] as const).map((view) => <button
          key={view}
          type="button"
          disabled={state.locked}
          aria-current={state.view === view ? 'page' : undefined}
          className="border-b-2 border-transparent py-3 text-sm font-medium aria-[current=page]:border-[#4C1268] aria-[current=page]:text-[#4C1268] disabled:opacity-50 dark:aria-[current=page]:border-purple-300 dark:aria-[current=page]:text-purple-300"
          onClick={() => state.changeView(view)}
        >
          {view === 'outstanding' ? 'Outstanding cash' : 'Receipt history'}
        </button>)}
      </nav>
      {state.error && <div className="mt-4">
        <ErrorNotice message={state.error} retry={state.reload} />
      </div>}
      {state.notice && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
        {state.notice}
      </p>}
      {state.loading ? <p role="status" className="py-8 text-sm">Loading Courier cash…</p> : state.view === 'history' ? <div className="mt-4">
        {state.history && <CashReceiptHistory receipts={state.history.data} />}
      </div> : <>
        {state.data && <p className="my-5 text-sm">Unremitted cash: <strong className="tabular-nums">
          {Object.entries(totals).map(([code, amount]) => money(amount, code)).join(' · ') || money(0)}
        </strong></p>}
        <label className="block max-w-lg text-sm font-medium">Courier and currency
          <select
            className={`${field} mt-2`}
            disabled={state.locked}
            value={state.courier ? `${state.courier}:${state.currency}` : ''}
            onChange={(event) => {
              const [id, code] = event.target.value.split(':');
              state.filter(id ?? '', code ?? '')
            }}
          >
            <option value="">All Couriers</option>
            {balances.map((balance) => <option key={`${balance.courier_id}:${balance.currency}`} value={`${balance.courier_id}:${balance.currency}`}>{balance.courier_name} — {money(balance.outstanding_cents, balance.currency)} ({balance.order_count} Orders)</option>)}
          </select>
        </label>
        {rows.length ? <div
          className="mt-5 overflow-x-auto border-y border-zinc-200 dark:border-white/10"
          role="region"
          aria-label="Outstanding Courier cash Orders"
          tabIndex={0}
        >
          <table className="w-full min-w-[620px] text-sm">
            <caption className="sr-only">COD cash remaining with Couriers</caption>
            <thead className="border-b border-zinc-200 dark:border-white/10">
              <tr>
                {['Select', 'Order', 'Courier', 'Delivery approved', 'Cash due'].map((title) => <th key={title} scope="col" className={`px-3 py-3 font-medium ${title === 'Cash due' ? 'text-right' : 'text-left'}`}>
                  {title}
                </th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {rows.map((row) => {
                const incompatible = selectedRows.length > 0 && (row.courier_id !== selectedRows[0].courier_id || row.currency !== selectedRows[0].currency)
                return <tr key={row.id}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#4C1268]"
                      aria-label={`Select ${row.order_reference}`}
                      disabled={state.locked || incompatible}
                      checked={state.selected.includes(row.id)}
                      onChange={(event) => state.setSelected(event.target.checked ? [...state.selected, row.id] : state.selected.filter((id) => id !== row.id))}
                    />
                  </td>
                  <th scope="row" className="px-3 py-3 text-left font-medium">
                    {row.order_reference}
                  </th>
                  <td className="px-3 py-3">
                    {row.courier_name}
                  </td>
                  <td className="px-3 py-3">
                    {date(row.delivered_at)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(row.amount_cents, row.currency)}
                  </td>
                </tr>
              })}
            </tbody>
          </table>
        </div> : !state.error && <p className="py-8 text-sm">No unremitted COD cash for this selection.</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <p>{selectedRows.length} Orders selected · <strong className="tabular-nums">
              {money(total, selectedRows[0]?.currency)}
            </strong></p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">Select one Courier and currency. This records physical cash received and funds the simulated account.</p>
          </div>
          <Button
            variant="secondary"
            className={workflowButton}
            isLoading={state.busy}
            disabled={!state.attempt && !selectedRows.length}
            onClick={() => void state.receive()}
          >
            {state.attempt ? 'Retry same receipt' : 'Record cash received'}
          </Button>
        </div>
        {state.attempt && !state.busy && <p role="status" className="mt-3 text-sm text-amber-800 dark:text-amber-300">The receipt result is uncertain. Retry uses the same selection and receipt key.</p>}
      </>}
      <nav
        aria-label="Courier cash pagination"
        className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-white/10"
      >
        <Button
          variant="outline"
          className={workflowButton}
          disabled={state.locked || state.loading || state.page <= 1}
          onClick={() => state.changePage(state.page - 1)}
        >Previous</Button>
        <span className="text-sm">Page {state.page} of {lastPage}</span>
        <Button
          variant="outline"
          className={workflowButton}
          disabled={state.locked || state.loading || state.page >= lastPage}
          onClick={() => state.changePage(state.page + 1)}
        >Next</Button>
      </nav>
    </main>
  </>
}
