export type FinanceWorkspaceData = {
  currency: 'PHP'
  timezone: 'Asia/Manila'
  generatedAt: string
  summary: { revenueCents: number; costsCents: number; profitCents: number; availableBalanceCents: number; profitState: 'actual' | 'provisional' }
  series: { date: string; actualRevenueCents: number; actualProfitCents: number }[]
  waterfall: { label: string; amountCents: number }[]
  revenueBreakdown: { label: string; amountCents: number }[]
  remittanceAging: { submittedCents: number; clearedCents: number; oldestSubmittedAt: string | null }
  payoutSchedule: { id: string; amountCents: number; currency: string; status: string; eligibleThrough: string; isSandbox: boolean }[]
  forecast: { state: 'available' | 'insufficient_history'; usableWeeks: number; requiredWeeks: number; profitSuppressed: boolean; series: { date: string; forecastLowRevenueCents: number; forecastRevenueCents: number; forecastHighRevenueCents: number; forecastVariableCostsCents: number; scheduledRecurringCostsCents: number }[]; scenarios: { label: string; activityPercent: number; revenueCents: number; variableCostsCents: number; scheduledRecurringCostsCents: number; profitCents: number | null }[] }
  moneyFlow: { nodes: { id: string; label: string }[]; edges: { id: string; source: string; target: string; label: string }[]; scope: string }
}

export type FinanceWorkspaceProps = {
  roleLabel: 'Platform' | 'Seller' | 'Logistics'
  endpointPrefix: string
  csvUrl: string
  request: <T>(path: string, options?: RequestInit) => Promise<T>
}

export type LedgerRow = {
  id: string
  effective_at: string
  event_type: string
  memo: string | null
  currency: string
  order: { id: string; reference: string } | null
  lines: { id: string; account_code: string; debit_cents: number; credit_cents: number }[]
}

export type LedgerPage = { data: LedgerRow[]; current_page: number; last_page: number; total: number }
