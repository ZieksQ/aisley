import { FaArrowLeft, FaCreditCard, FaFileContract, FaPalette, FaUserGear } from 'react-icons/fa6'
import { Link, NavLink } from 'react-router-dom'

const links = [
  { path: '/settings/account', label: 'Account', icon: FaUserGear },
  { path: '/settings/terms', label: 'Terms and conditions', icon: FaFileContract },
  { path: '/settings/billing', label: 'Billing', icon: FaCreditCard },
  { path: '/settings/appearance', label: 'Appearance', icon: FaPalette },
]
const item = 'flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]'

export function SettingsSidebarNav({ onNavigate }: { onNavigate: () => void }) {
  return <nav aria-label="Settings" className="mt-6 min-h-0 flex-1 overflow-y-auto">
    <Link className={`${item} mb-5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5`} onClick={onNavigate} to="/dashboard"><FaArrowLeft aria-hidden="true" />Back to workspace</Link>
    <h2 className="mb-2 px-3 text-base font-semibold">Settings</h2>
    {links.map(({ path, label, icon: Icon }) => <NavLink className={({ isActive }) => `${item} ${isActive ? 'bg-zinc-100 font-semibold text-[#4C1268] dark:bg-white/10 dark:text-purple-200' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5'}`} key={path} onClick={onNavigate} to={path}><Icon aria-hidden="true" className="size-4 shrink-0" />{label}</NavLink>)}
  </nav>
}
