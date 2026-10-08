import { useContext, useEffect, useState } from 'react'
import { SelectField } from '@aisley/ui'
import { ThemeContext } from '../features/appearance/ThemeProvider'
import type { ThemePreference } from '../features/appearance/theme'

export function AppearancePage() {
  const theme = useContext(ThemeContext)
  const [saved, setSaved] = useState(false)
  useEffect(() => { document.title = 'Appearance | Aisley Logistics' }, [])
  if (!theme) return null

  return <section className="max-w-3xl p-5 sm:p-7">
    <header className="border-b border-zinc-200 pb-5 dark:border-white/10">
      <h2 className="text-xl font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Choose how your Logistics workspace looks on this browser.</p>
    </header>
    <div className="grid gap-4 border-b border-zinc-200 py-6 dark:border-white/10 sm:grid-cols-[1fr_15rem] sm:items-start">
      <div>
        <h3 className="text-sm font-semibold">Color theme</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" id="theme-description">System follows your device’s appearance and updates automatically.</p>
      </div>
      <SelectField aria-describedby="theme-description" className="rounded-md dark:border-white/20 dark:bg-[#18181b] dark:text-zinc-100" id="logistics-theme" label="Theme" onChange={(event) => { theme.setPreference(event.target.value as ThemePreference); setSaved(true) }} value={theme.preference}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </SelectField>
    </div>
    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400" role="status">{saved ? 'Theme preference saved.' : 'Changes apply immediately.'}</p>
  </section>
}
