import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MealieConnectionSettings from './MealieConnectionSettings'

describe('MealieConnectionSettings', () => {
  it('shows an admin-only notice to non-admins (no data fetch)', () => {
    render(<MealieConnectionSettings householdId={1} isAdmin={false} />)
    expect(screen.getByText('Mealie Connection')).toBeInTheDocument()
    expect(
      screen.getByText('Only household admins can configure the Mealie connection.')
    ).toBeInTheDocument()
  })
})
