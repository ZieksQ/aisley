import type { FinanceWorkspaceData, FinanceWorkspaceProps } from '../types'
import { amount } from '../formatters'

type SummaryProps = {
  roleLabel: FinanceWorkspaceProps['roleLabel']
  summary: FinanceWorkspaceData['summary']
}

const revenueLabels: Record<FinanceWorkspaceProps['roleLabel'], string> = {
  Platform: 'Commission revenue',
  Seller: 'Recognized proceeds',
  Logistics: 'Service revenue',
}

export function FinanceSummaryCards({ roleLabel, summary }: SummaryProps) {
  const cards = [
    { label: revenueLabels[roleLabel], value: summary.revenueCents, note: 'Recognized to date' },
    { label: 'Recorded costs', value: summary.costsCents, note: 'Expenses and allocations' },
    {
      label: 'Operating profit',
      value: summary.profitCents,
      note: summary.profitState === 'actual' ? 'Closed accounting period' : 'Open period · costs may change',
    },
    { label: 'Available balance', value: summary.availableBalanceCents, note: 'Eligible ledger balance' },
  ]

  return (
    <section aria-label="Finance summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]" key={card.label}>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{card.label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{amount(card.value)}</p>
          <p className="mt-1 text-xs text-zinc-500">{card.note}</p>
        </article>
      ))}
    </section>
  )
}
