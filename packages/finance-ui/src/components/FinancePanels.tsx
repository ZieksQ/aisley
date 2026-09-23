import { useMemo } from 'react'
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { FinanceWorkspaceData, LedgerPage } from '../types'
import { amount } from '../formatters'

export function SettlementPanel({ data }: { data: FinanceWorkspaceData }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]">
      <h3 className="font-semibold">Remittance and payouts</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border-l-2 border-amber-500 pl-3">
          <dt className="text-xs text-zinc-500">Submitted COD</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{amount(data.remittanceAging.submittedCents)}</dd>
        </div>
        <div className="border-l-2 border-emerald-600 pl-3">
          <dt className="text-xs text-zinc-500">Cleared COD</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{amount(data.remittanceAging.clearedCents)}</dd>
        </div>
      </dl>
      <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 text-sm dark:divide-white/5 dark:border-white/5">
        {data.payoutSchedule.length ? data.payoutSchedule.slice(0, 6).map((payout) => (
          <div className="flex items-center justify-between gap-3 py-2.5" key={payout.id}>
            <div>
              <p className="font-medium tabular-nums">{amount(payout.amountCents)}</p>
              <p className="text-xs capitalize text-zinc-500">{payout.status.replaceAll('_', ' ')}</p>
            </div>
            <p className="text-xs text-zinc-500">{payout.isSandbox ? 'Sandbox' : new Date(payout.eligibleThrough).toLocaleDateString('en-PH')}</p>
          </div>
        )) : <p className="py-4 text-zinc-500">No payouts scheduled.</p>}
      </div>
    </section>
  )
}

export function RevenueBreakdownPanel({ rows }: { rows: FinanceWorkspaceData['revenueBreakdown'] }) {
  const largest = Math.max(...rows.map((row) => Math.abs(row.amountCents)), 1)

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]">
      <h3 className="font-semibold">Revenue breakdown</h3>
      <p className="mt-1 text-xs text-zinc-500">Recognized credits grouped by ledger account.</p>
      <div className="mt-4 space-y-4">
        {rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between gap-4 text-sm">
              <p>{row.label}</p>
              <p className="font-medium tabular-nums">{amount(row.amountCents)}</p>
            </div>
            <div className="mt-2 h-1.5 bg-zinc-100 dark:bg-white/10" aria-hidden="true">
              <div className="h-full bg-[#4C1268] dark:bg-[#a855f7]" style={{ width: `${Math.max(2, (Math.abs(row.amountCents) / largest) * 100)}%` }} />
            </div>
          </div>
        )) : <p className="py-4 text-sm text-zinc-500">No recognized revenue yet.</p>}
      </div>
    </section>
  )
}

export function MoneyFlowPanel({ data }: { data: FinanceWorkspaceData['moneyFlow'] }) {
  const positions: Record<string, { x: number; y: number }> = {
    customer: { x: 0, y: 80 },
    platform: { x: 220, y: 80 },
    seller: { x: 480, y: 0 },
    logistics: { x: 480, y: 90 },
    commission: { x: 480, y: 180 },
  }
  const nodes: Node[] = useMemo(() => data.nodes.map((node) => ({
    id: node.id,
    position: positions[node.id] ?? { x: 0, y: 0 },
    data: { label: node.label },
    draggable: false,
    style: { borderRadius: 6, border: '1px solid #a1a1aa', padding: 10, fontSize: 12 },
  })), [data.nodes])
  const edges: Edge[] = useMemo(() => data.edges.map((edge) => ({
    ...edge,
    label: edge.label,
    animated: false,
    style: { stroke: '#4C1268' },
  })), [data.edges])

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]">
      <h3 className="font-semibold">Money flow</h3>
      <p className="mt-1 text-xs text-zinc-500">Read-only {data.scope} view. Beneficiary details remain tenant-scoped.</p>
      <div className="mt-3 h-64" aria-label="Customer COD flows to Aisley clearing, then to Seller, Logistics, and platform commission">
        <ReactFlow edges={edges} elementsSelectable={false} fitView nodes={nodes} nodesConnectable={false} nodesDraggable={false} panOnDrag={false} zoomOnScroll={false}>
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  )
}

type LedgerPanelProps = {
  csvUrl: string
  ledger: LedgerPage | null
  onSearch: (query?: string) => Promise<void>
  search: string
  setSearch: (value: string) => void
}

export function LedgerPanel({ csvUrl, ledger, onSearch, search, setSearch }: LedgerPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="ledger-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 p-4 dark:border-white/10">
        <div>
          <h3 className="font-semibold" id="ledger-heading">Transaction ledger</h3>
          <p className="mt-1 text-xs text-zinc-500">Append-only journal entries in integer centavos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void onSearch(search) }}>
            <label className="sr-only" htmlFor="finance-search">Search ledger</label>
            <input className="h-9 w-48 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-white/15" id="finance-search" onChange={(event) => setSearch(event.target.value)} placeholder="Order or event" value={search} />
            <button className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-white/15" type="submit">Search</button>
          </form>
          <a className="inline-flex h-9 items-center rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-white/15" href={csvUrl}>Export CSV</a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-white/10"><tr><th className="px-4 py-2">Date</th><th>Event</th><th>Order</th><th>Account</th><th className="text-right">Debit</th><th className="pr-4 text-right">Credit</th></tr></thead>
          <tbody>{ledger?.data.flatMap((journal) => journal.lines.map((line) => (
            <tr className="border-b border-zinc-100 dark:border-white/5" key={line.id}>
              <td className="whitespace-nowrap px-4 py-2">{new Date(journal.effective_at).toLocaleDateString('en-PH')}</td>
              <td>{journal.event_type.replaceAll('_', ' ')}</td>
              <td>{journal.order?.reference ?? '—'}</td>
              <td>{line.account_code.replaceAll('_', ' ')}</td>
              <td className="text-right tabular-nums">{line.debit_cents ? amount(line.debit_cents) : '—'}</td>
              <td className="pr-4 text-right tabular-nums">{line.credit_cents ? amount(line.credit_cents) : '—'}</td>
            </tr>
          )))}</tbody>
        </table>
        {!ledger?.data.length ? <p className="p-6 text-center text-sm text-zinc-500">No ledger entries match this view.</p> : null}
      </div>
    </section>
  )
}
