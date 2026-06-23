import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

const reset = () =>
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  })

describe('authStore', () => {
  beforeEach(reset)

  it('starts unauthenticated', () => {
    const s = useAuthStore.getState()
    expect(s.user).toBeNull()
    expect(s.isAuthenticated).toBe(false)
  })

  it('setAuth populates user/tokens and flips isAuthenticated', () => {
    useAuthStore.getState().setAuth({ id: 1, email: 'a@b.c' } as never, 'tok', 'ref')
    const s = useAuthStore.getState()
    expect(s.user).toEqual({ id: 1, email: 'a@b.c' })
    expect(s.token).toBe('tok')
    expect(s.refreshToken).toBe('ref')
    expect(s.isAuthenticated).toBe(true)
    expect(s.isLoading).toBe(false)
  })

  it('logout clears everything', () => {
    useAuthStore.getState().setAuth({ id: 1 } as never, 'tok', 'ref')
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.user).toBeNull()
    expect(s.token).toBeNull()
    expect(s.refreshToken).toBeNull()
    expect(s.isAuthenticated).toBe(false)
  })

  it('setLoading toggles the loading flag', () => {
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('updateUser replaces only the user', () => {
    useAuthStore.getState().setAuth({ id: 1 } as never, 'tok', 'ref')
    useAuthStore.getState().updateUser({ id: 1, username: 'renamed' } as never)
    const s = useAuthStore.getState()
    expect(s.user).toEqual({ id: 1, username: 'renamed' })
    expect(s.token).toBe('tok') // untouched
  })
})
