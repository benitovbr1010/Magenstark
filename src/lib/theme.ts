import { useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'

function getInitialTheme(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function useTheme(): [boolean, (dark: boolean) => void] {
  const [dark, setDark] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  }, [dark])

  return [dark, setDark]
}
