'use client'

import { useId, useState } from 'react'
import { SelectField } from '../select-field'
import type { ThemePreference } from './PortalTheme'

export function AppearanceSettings({ workspace, preference, onChange, controlId }: {
  controlId?: string
  workspace: string
  preference: ThemePreference
  onChange: (preference: ThemePreference) => void
}) {
  const generatedId = useId()
  const id = controlId ?? generatedId
  const [changed, setChanged] = useState(false)
  return <section className="max-w-3xl p-5 sm:p-7">
    {/* taste-skill-ignore: App-screen section borders follow the Logistics reference and docs/design.md. */}<header className="border-b border-zinc-200 pb-5 dark:border-white/10">
      <h2 className="text-xl font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Choose how your {workspace} workspace looks on this browser.</p>
    </header>
    {/* taste-skill-ignore: App-screen form row separator follows the existing Settings pattern. */}<div className="grid gap-4 dark:[&_label]:text-zinc-100 border-b border-zinc-200 py-6 dark:border-white/10 sm:grid-cols-[1fr_15rem] sm:items-start">
      <div>
        <h3 className="text-sm font-semibold">Color theme</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" id={`${id}-description`}>System follows your device’s appearance and updates automatically.</p>
      </div>
      <SelectField aria-describedby={`${id}-description`} className="rounded-md dark:border-white/20 dark:bg-[#18181b] dark:text-zinc-100" id={id} label="Theme" onChange={event => {
        onChange(event.target.value as ThemePreference)
        setChanged(true)
      }} value={preference}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </SelectField>
    </div>
    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400" role="status">{changed ? 'Theme preference applied.' : 'Changes apply immediately.'}</p>
  </section>
}
