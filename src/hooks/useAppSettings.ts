import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { AppSettings } from '../types'

const STORAGE_KEY = 'twm_app_settings'

const DEFAULT_SETTINGS: AppSettings = {
  defaultRestTimeSecs: 10,
  defaultUseBeeps: true,
  theme: 'dark',
}

export const ThemeContext = createContext<'dark' | 'light'>('dark')
export const useTheme = () => useContext(ThemeContext)

function applyTheme(theme: 'dark' | 'light') {
  const isDark = theme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  document.body.style.backgroundColor = isDark ? '#111827' : '#ffffff'
  document.body.style.color = isDark ? '#f9fafb' : '#111827'
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, updateSettings }
}
