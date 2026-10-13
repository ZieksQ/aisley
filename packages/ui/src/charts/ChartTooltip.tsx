import type { ReactNode } from 'react'

type TooltipEntry = { name?: ReactNode; value?: unknown; color?: string }
type Props = { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number; formatValue?: (value: number) => string }

/** Inactive content stays empty so a hidden tooltip cannot widen a narrow page. */
export function ChartTooltip({ active, payload = [], label, formatValue = (value) => value.toLocaleString() }: Props) {
  if (!active || !payload.length) return null
  return <div className="dashboard-chart-tooltip">
    <strong>{label ?? payload[0]?.name}</strong>
    <ul>
      {payload.map((item, index) => <li key={index}>
        <span className="dashboard-legend-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
        <span>{item.name}</span>
        <b>{typeof item.value === 'number' ? formatValue(item.value) : 'Unavailable'}</b>
      </li>)}
    </ul>
  </div>
}
