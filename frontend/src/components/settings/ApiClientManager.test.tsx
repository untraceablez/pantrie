import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ApiClientManager from './ApiClientManager'

describe('ApiClientManager', () => {
  it('shows an admin-only notice to non-admins (no data fetch)', () => {
    render(<ApiClientManager householdId={1} isAdmin={false} />)
    expect(screen.getByText('API Clients')).toBeInTheDocument()
    expect(
      screen.getByText('Only household admins can manage API clients.')
    ).toBeInTheDocument()
  })
})
