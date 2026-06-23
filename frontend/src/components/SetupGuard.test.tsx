import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SetupGuard from './SetupGuard'
import { setupService } from '../services/setupService'

vi.mock('../services/setupService', () => ({
  setupService: { checkSetupStatus: vi.fn() },
}))

const mockCheck = vi.mocked(setupService.checkSetupStatus)

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <SetupGuard>
              <div>PROTECTED</div>
            </SetupGuard>
          }
        />
        <Route
          path="/setup"
          element={
            <SetupGuard>
              <div>SETUP CHILD</div>
            </SetupGuard>
          }
        />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('SetupGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows a loading state before the status resolves', () => {
    mockCheck.mockReturnValue(new Promise(() => {})) // never resolves
    renderAt('/')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to /setup when setup is incomplete', async () => {
    mockCheck.mockResolvedValue({ setup_complete: false, message: '' })
    renderAt('/')
    // /setup mounts another guard which, being on /setup, renders its child
    expect(await screen.findByText('SETUP CHILD')).toBeInTheDocument()
  })

  it('renders the protected content when setup is complete', async () => {
    mockCheck.mockResolvedValue({ setup_complete: true, message: '' })
    renderAt('/')
    expect(await screen.findByText('PROTECTED')).toBeInTheDocument()
  })

  it('redirects away from /setup to /login when setup is already complete', async () => {
    mockCheck.mockResolvedValue({ setup_complete: true, message: '' })
    renderAt('/setup')
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument()
  })

  it('treats a status-check failure as "setup incomplete"', async () => {
    mockCheck.mockRejectedValue(new Error('network'))
    renderAt('/')
    expect(await screen.findByText('SETUP CHILD')).toBeInTheDocument()
  })
})
