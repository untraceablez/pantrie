import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AllergenWarning from './AllergenWarning'

describe('AllergenWarning', () => {
  it('renders nothing when there are no matches', () => {
    const { container } = render(<AllergenWarning allergens={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists the matched allergens under a default label', () => {
    render(<AllergenWarning allergens={['milk', 'soy']} />)
    expect(screen.getByText('Allergen warning:')).toBeInTheDocument()
    expect(screen.getByText('milk, soy')).toBeInTheDocument()
  })

  it('accepts a custom label and extra classes', () => {
    const { container } = render(
      <AllergenWarning allergens={['milk']} label="whole milk" className="mt-2" />
    )
    expect(screen.getByText('whole milk:')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('mt-2')
  })

  it('announces itself only when asked to', () => {
    const { rerender } = render(<AllergenWarning allergens={['milk']} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    rerender(<AllergenWarning allergens={['milk']} live />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
