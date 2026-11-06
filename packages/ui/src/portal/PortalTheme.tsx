'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

export function readPortalTheme(storageKey: string): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function applyPortalTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

const ThemeContext = createContext<{
  preference: ThemePreference
  isDark: boolean
  setPreference: (value: ThemePreference) => void
} | null>(null)

export function PortalThemeProvider({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [preference, setPreferenceState] = useState(() => readPortalTheme(storageKey))
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = preference === 'dark' || (preference === 'system' && systemDark)
  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value)
    applyPortalTheme(value)
    try { localStorage.setItem(storageKey, value) } catch { /* Retain the session preference. */ }
  }, [storageKey])

  useEffect(() => {
    applyPortalTheme(preference)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const systemChanged = () => {
      setSystemDark(media.matches)
      if (preference === 'system') applyPortalTheme(preference)
    }
    const storageChanged = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setPreferenceState(readPortalTheme(storageKey))
    }
    media.addEventListener('change', systemChanged)
    window.addEventListener('storage', storageChanged)
    return () => {
      media.removeEventListener('change', systemChanged)
      window.removeEventListener('storage', storageChanged)
    }
  }, [preference, storageKey])

  return <ThemeContext.Provider value={{ preference, isDark, setPreference }}>{children}</ThemeContext.Provider>
}

export function usePortalTheme() {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('usePortalTheme requires PortalThemeProvider.')
  return theme
}
