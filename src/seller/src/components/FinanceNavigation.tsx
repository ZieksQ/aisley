import { NavLink } from 'react-router-dom'

export function FinanceNavigation() {
  const items = [["Overview", "/finance"], ["Payouts", "/finance/payouts"], ["Payment settings", "/finance/payment-settings"]] as const
  return (
    <nav aria-label="Finance pages" className="flex flex-wrap gap-4 border-b border-zinc-200 px-5 py-3 text-sm dark:border-white/10">

      {items.map(([label, path]) => (
        <NavLink
          key={path}
          end={path === '/finance'}
          to={path}
          className={({ isActive }) => `py-2 font-medium focus-visible:outline-2 focus-visible:outline-[#E6007A] ${isActive ? 'text-[#4C1268] underline underline-offset-8 dark:text-purple-300' : 'text-zinc-600 dark:text-zinc-300'}`}>

          {label}

        </NavLink>
      ))}

    </nav>
  )
}
