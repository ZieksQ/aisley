import { DashboardMetricCard } from '@aisley/ui/portal'
import { FinanceMetricIcon } from '@aisley/ui/portal'
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
    { label: revenueLabels[roleLabel], value: summary.revenueCents, note: 'Recognized in selected period', icon: <FinanceMetricIcon kind="revenue" /> },
    { label: 'Recorded costs', value: summary.costsCents, note: 'Selected period · recorded expenses', icon: <FinanceMetricIcon kind="costs" /> },
    {
      label: summary.profitState === 'actual' ? 'Operating profit' : 'Provisional operating profit',
      value: summary.profitCents,
      icon: <FinanceMetricIcon kind="profit" />,
      note: summary.profitState === 'actual' ? 'Closed accounting period' : 'Selected period · costs may be incomplete',
    },
    { label: 'Current ledger balance', value: summary.availableBalanceCents, note: 'Current · subject to settlement eligibility', icon: <FinanceMetricIcon kind="balance" /> },
  ]

  return (
    <section aria-label="Finance summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <DashboardMetricCard key={card.label} label={card.label} value={amount(card.value)} icon={card.icon} detail={card.note} />)}
    </section>
  )
}
