import { usePortalTheme } from '@aisley/ui/portal'
import { FaMoon, FaSun } from 'react-icons/fa6'

export function ThemeToggle() {
  const { isDark, setPreference } = usePortalTheme()
  return (
    <button
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      type="button"
    >
      {isDark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
    </button>
  )
}
