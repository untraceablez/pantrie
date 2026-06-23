import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AdministrationSettings from './AdministrationSettings'
import { useAuthStore } from '@/store/authStore'

vi.mock('@/components/SiteSettings', () => ({ default: () => <div>SITE SETTINGS</div> }))
vi.mock('@/components/UserManagement', () => ({ default: () => <div>USER MGMT</div> }))
vi.mock('@/components/HouseholdManagement', () => ({ default: () => <div>HOUSEHOLD MGMT</div> }))

const setUser = (site_role: string | null) =>
  useAuthStore.setState({
    user: site_role ? ({ id: 1, site_role } as never) : null,
    isAuthenticated: !!site_role,
  })

describe('AdministrationSettings', () => {
  beforeEach(() => setUser(null))

  it('blocks non-site-admins (and no user)', () => {
    render(<AdministrationSettings />)
    expect(
      screen.getByText('You need site administrator privileges to access this section.')
    ).toBeInTheDocument()
  })

  it('renders tabs for site admins and switches across all three', () => {
    setUser('site_administrator')
    render(<AdministrationSettings />)

    expect(screen.getByText('Site Administration')).toBeInTheDocument()
    expect(screen.getByText('SITE SETTINGS')).toBeInTheDocument() // smtp default

    fireEvent.click(screen.getByText('User Management'))
    expect(screen.getByText('USER MGMT')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Household Management'))
    expect(screen.getByText('HOUSEHOLD MGMT')).toBeInTheDocument()
  })
})
