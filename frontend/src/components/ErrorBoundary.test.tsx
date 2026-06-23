import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

const Boom = (): JSX.Element => {
  throw new Error('kaboom')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('safe content')).toBeInTheDocument()
  })

  it('renders the fallback (with the error text) when a child throws', () => {
    // React logs the error to console.error; silence it and cover componentDidCatch.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/kaboom/)).toBeInTheDocument()
  })

  it('the reload button calls window.location.reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    const original = window.location
    // @ts-expect-error override read-only location for the test
    delete window.location
    // @ts-expect-error minimal location stub
    window.location = { reload }

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: /reload page/i }))
    expect(reload).toHaveBeenCalled()

    // @ts-expect-error restore
    window.location = original
  })
})
