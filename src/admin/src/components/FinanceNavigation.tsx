import { NavLink } from 'react-router-dom'

export function FinanceNavigation() {
  const items = [["Overview", "/finance"], ["Remittances", "/finance/remittances"], ["Payouts", "/finance/payouts"], ["Automation", "/finance/automation"], ["Sandbox", "/finance/sandbox"]] as const
  return (
    <nav aria-label="Finance pages" className="finance-workspace finance-navigation">
      <div>
        {items.map(([label, path]) => (
          <NavLink key={path} end={path === '/finance'} to={path}>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
