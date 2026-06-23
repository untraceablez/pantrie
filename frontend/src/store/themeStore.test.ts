import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useThemeStore } from './themeStore'

type ChangeHandler = (e: { matches: boolean }) => void

// Swap window.matchMedia for one we control, capturing any registered
// 'change' handlers so tests can simulate a system theme switch.
const installMatchMedia = (matches: boolean, sink: ChangeHandler[] = []) => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_event: string, cb: ChangeHandler) => sink.push(cb),
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as typeof window.matchMedia
}

describe('themeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'system', resolvedTheme: 'light' })
    document.documentElement.className = ''
  })

  it('setMode("dark") applies the dark class and stores the resolved theme', () => {
    useThemeStore.getState().setMode('dark')
    const s = useThemeStore.getState()
    expect(s.mode).toBe('dark')
    expect(s.resolvedTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setMode("light") applies the light class', () => {
    useThemeStore.getState().setMode('light')
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('setMode("system") resolves from matchMedia', () => {
    installMatchMedia(true)
    useThemeStore.getState().setMode('system')
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')

    installMatchMedia(false)
    useThemeStore.getState().setMode('system')
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })

  it('initializeTheme resolves the theme and reacts to system changes while in system mode', () => {
    const handlers: ChangeHandler[] = []
    installMatchMedia(true, handlers)
    useThemeStore.setState({ mode: 'system' })

    useThemeStore.getState().initializeTheme()
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
    expect(handlers).toHaveLength(1)

    // System flips to light -> store follows because mode is 'system'
    handlers[0]({ matches: false })
    expect(useThemeStore.getState().resolvedTheme).toBe('light')

    // ...and back to dark
    handlers[0]({ matches: true })
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })

  it('the system-change handler is a no-op when mode is not "system"', () => {
    const handlers: ChangeHandler[] = []
    installMatchMedia(false, handlers)
    useThemeStore.setState({ mode: 'system' })
    useThemeStore.getState().initializeTheme()

    // User pins a fixed theme; a later system change must not override it.
    useThemeStore.setState({ mode: 'light', resolvedTheme: 'light' })
    handlers[0]({ matches: true })
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })
})
