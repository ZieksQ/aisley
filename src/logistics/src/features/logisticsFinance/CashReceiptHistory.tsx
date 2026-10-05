import { date, money } from './presentation'
import type { CashReceipt } from './api'

export function CashReceiptHistory({ receipts }: { receipts: CashReceipt[] }) {
  if (!receipts.length) return <p className="py-8 text-sm">No Courier cash receipts yet.</p>
  return <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">
    {receipts.map((receipt) => <li key={receipt.id} className="py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>
          {receipt.courier_name}
        </strong>
        <strong className="tabular-nums">
          {money(receipt.total_cents, receipt.currency)}
        </strong>
      </div>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{date(receipt.received_at)} · Cash received · Simulated account credit {receipt.simulation_credit}</p>
      <details className="mt-3">
        <summary className="cursor-pointer font-medium">View receipt and Orders</summary>
        <p className="mt-2 break-all text-zinc-500 dark:text-zinc-400">Receipt {receipt.id}</p>
        <ul className="mt-2 space-y-2">
          {receipt.orders.map((order) => <li key={order.reference} className="flex flex-wrap justify-between gap-2">
            <span className="break-all">
              {order.reference}
            </span>
            <span className="tabular-nums">
              {money(order.amount_cents, receipt.currency)}
            </span>
          </li>)}
        </ul>
      </details>
    </li>)}
  </ul>
}
