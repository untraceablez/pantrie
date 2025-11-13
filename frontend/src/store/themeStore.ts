import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  initializeTheme: () => void
}

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

const applyTheme = (theme: ResolvedTheme) => {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedTheme: 'light',

      setMode: (mode: ThemeMode) => {
        const resolved = resolveTheme(mode)
        applyTheme(resolved)
        set({ mode, resolvedTheme: resolved })
      },

      initializeTheme: () => {
        const { mode } = get()
        const resolved = resolveTheme(mode)
        applyTheme(resolved)
        set({ resolvedTheme: resolved })

        // Listen for system theme changes
        if (typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
          const handleChange = (e: MediaQueryListEvent) => {
            const currentMode = get().mode
            if (currentMode === 'system') {
              const newResolved = e.matches ? 'dark' : 'light'
              applyTheme(newResolved)
              set({ resolvedTheme: newResolved })
            }
          }
          mediaQuery.addEventListener('change', handleChange)
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
)
