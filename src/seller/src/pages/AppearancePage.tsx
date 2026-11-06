import { useEffect } from 'react'
import { AppearanceSettings, usePortalTheme } from '@aisley/ui/portal'

export function AppearancePage() {
  const theme = usePortalTheme()
  useEffect(() => { document.title = 'Appearance | AISLEY Seller' }, [])
  return <AppearanceSettings workspace="Seller" preference={theme.preference} onChange={theme.setPreference} />
}
