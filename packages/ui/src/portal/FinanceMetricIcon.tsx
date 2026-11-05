import { LuChartNoAxesCombined, LuReceipt, LuScale, LuWallet } from 'react-icons/lu'

export function FinanceMetricIcon({ kind }: { kind: 'revenue' | 'costs' | 'profit' | 'balance' }) {
  const Icon = { revenue: LuChartNoAxesCombined, costs: LuReceipt, profit: LuScale, balance: LuWallet }[kind]
  return <Icon />
}
