import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { applyTheme, readTheme, type ThemePreference } from './theme'

export const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readTheme)
  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value)
    applyTheme(value)
    try { localStorage.setItem('logistics-theme', value) } catch { /* Keep the preference for this session. */ }
  }, [])

  useEffect(() => {
    applyTheme(preference)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const systemChanged = () => { if (preference === 'system') applyTheme(preference) }
    const storageChanged = (event: StorageEvent) => {
      if (event.key === 'logistics-theme' || event.key === null) setPreferenceState(readTheme())
    }
    media.addEventListener('change', systemChanged)
    window.addEventListener('storage', storageChanged)
    return () => {
      media.removeEventListener('change', systemChanged)
      window.removeEventListener('storage', storageChanged)
    }
  }, [preference])

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
}
