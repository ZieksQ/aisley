import { useEffect } from 'react'
import { AppearanceSettings, usePortalTheme } from '@aisley/ui/portal'

export function AppearancePage() {
  const theme = usePortalTheme()
  useEffect(() => { document.title = 'Appearance | AISLEY Admin' }, [])
  return <AppearanceSettings workspace="Admin" preference={theme.preference} onChange={theme.setPreference} />
}
