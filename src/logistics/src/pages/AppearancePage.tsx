import { useContext, useEffect } from 'react'
import { AppearanceSettings } from '@aisley/ui/portal'
import { ThemeContext } from '../features/appearance/ThemeProvider'

export function AppearancePage() {
  const theme = useContext(ThemeContext)
  useEffect(() => { document.title = 'Appearance | AISLEY Logistics' }, [])
  return theme ? <AppearanceSettings controlId="logistics-theme" workspace="Logistics" preference={theme.preference} onChange={theme.setPreference} /> : null
}
