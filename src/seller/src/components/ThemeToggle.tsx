import { usePortalTheme } from '@aisley/ui/portal'
import { FaMoon, FaSun } from 'react-icons/fa6'

export function ThemeToggle() {
  const { isDark, setPreference } = usePortalTheme()
  return (
    <button
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="grid size-10 place-items-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] dark:border-white/15 dark:bg-[#1b1b1e] dark:text-zinc-300 dark:hover:bg-[#242428] dark:hover:text-white"
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      type="button"
    >
      {isDark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
    </button>
  )
}
