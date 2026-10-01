import { useEffect, useRef, useState } from 'react'
import { updateThemePreference } from './profile'
import { supabase } from './supabaseClient'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isThemeMode(stored) ? stored : 'system'
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches
  return mode === 'dark'
}

export function useTheme(userId?: string): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)
  const syncedRef = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolveDark(mode))
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => document.documentElement.classList.toggle('dark', resolveDark('system'))
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [mode])

  useEffect(() => {
    if (!userId || syncedRef.current) return
    syncedRef.current = true
    const hadStored = isThemeMode(localStorage.getItem(STORAGE_KEY))
    if (hadStored) return
    supabase
      .from('profiles')
      .select('theme_preference')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (isThemeMode(data?.theme_preference)) setModeState(data.theme_preference)
      })
  }, [userId])

  function setMode(next: ThemeMode) {
    setModeState(next)
    if (userId) updateThemePreference(userId, next)
  }

  return [mode, setMode]
}
