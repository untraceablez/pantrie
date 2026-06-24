import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { apiClient } from './api'
import { useAuthStore } from '@/store/authStore'

vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: vi.fn() },
}))

const mockGetState = vi.mocked(useAuthStore.getState)
const mockLogout = vi.fn()

// Pull the registered interceptor handlers off the axios instance so we can
// invoke them directly (axios stores them on the manager's `handlers` array).
const reqHandlers = (apiClient.interceptors.request as unknown as {
  handlers: { fulfilled: (c: InternalAxiosRequestConfig) => InternalAxiosRequestConfig; rejected: (e: unknown) => unknown }[]
}).handlers[0]
const resHandlers = (apiClient.interceptors.response as unknown as {
  handlers: { fulfilled: (r: unknown) => unknown; rejected: (e: unknown) => unknown }[]
}).handlers[0]

const makeConfig = (headers: Record<string, string> | undefined = {}) =>
  ({ headers }) as unknown as InternalAxiosRequestConfig

describe('api client interceptors', () => {
  let originalLocation: Location

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({ token: null, logout: mockLogout } as unknown as ReturnType<typeof useAuthStore.getState>)
    originalLocation = window.location
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { href: '' } })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation })
  })

  it('uses the /api/v1 base URL by default', () => {
    expect(apiClient.defaults.baseURL).toBe('/api/v1')
  })

  describe('request interceptor', () => {
    it('adds the Authorization header when a token is present', () => {
      mockGetState.mockReturnValue({ token: 'tok-123', logout: mockLogout } as never)
      const config = reqHandlers.fulfilled(makeConfig({}))
      expect(config.headers.Authorization).toBe('Bearer tok-123')
    })

    it('leaves headers untouched when there is no token', () => {
      mockGetState.mockReturnValue({ token: null, logout: mockLogout } as never)
      const config = reqHandlers.fulfilled(makeConfig({}))
      expect(config.headers.Authorization).toBeUndefined()
    })

    it('does nothing when a token exists but config has no headers', () => {
      mockGetState.mockReturnValue({ token: 'tok-123', logout: mockLogout } as never)
      const config = reqHandlers.fulfilled({ headers: undefined } as unknown as InternalAxiosRequestConfig)
      expect(config.headers).toBeUndefined()
    })

    it('rejects on a request error', async () => {
      const err = new Error('req fail')
      await expect(reqHandlers.rejected(err)).rejects.toBe(err)
    })
  })

  describe('response interceptor', () => {
    it('passes successful responses through unchanged', () => {
      const response = { data: 'ok' }
      expect(resHandlers.fulfilled(response)).toBe(response)
    })

    it('logs out and redirects on a 401', async () => {
      const err = { response: { status: 401 } } as AxiosError
      await expect(resHandlers.rejected(err)).rejects.toBe(err)
      expect(mockLogout).toHaveBeenCalled()
      expect(window.location.href).toBe('/login')
    })

    it('rejects other errors without logging out', async () => {
      const err = { response: { status: 500 } } as AxiosError
      await expect(resHandlers.rejected(err)).rejects.toBe(err)
      expect(mockLogout).not.toHaveBeenCalled()
      expect(window.location.href).toBe('')
    })

    it('rejects errors with no response without logging out', async () => {
      const err = { message: 'network' } as AxiosError
      await expect(resHandlers.rejected(err)).rejects.toBe(err)
      expect(mockLogout).not.toHaveBeenCalled()
    })
  })

  describe('base URL from environment', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    it('prefixes VITE_API_URL when it is set', async () => {
      vi.resetModules()
      vi.stubEnv('VITE_API_URL', 'https://api.example.com')
      const { apiClient: freshClient } = await import('./api')
      expect(freshClient.defaults.baseURL).toBe('https://api.example.com/api/v1')
    })
  })
})
