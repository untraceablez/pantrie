import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The async findBy*/waitFor default (1000ms) is too tight when the whole suite
// runs with file parallelism on a busy machine — data-fetching components that
// load → click → re-render can exceed it under CPU contention, causing flaky
// timeouts. Raise it generously so async assertions stay reliable as the suite
// grows (was 5000ms; bumped as the test count climbed past 400).
configure({ asyncUtilTimeout: 15000 })

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})
