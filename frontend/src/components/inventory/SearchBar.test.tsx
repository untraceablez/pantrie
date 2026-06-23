import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SearchBar from './SearchBar'

afterEach(() => {
  vi.useRealTimers()
})

describe('SearchBar', () => {
  it('debounces onChange until the timer elapses', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} debounceMs={300} />)

    const input = screen.getByPlaceholderText(/search by name/i)
    fireEvent.change(input, { target: { value: 'milk' } })
    expect(onChange).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(300))
    expect(onChange).toHaveBeenCalledWith('milk')
  })

  it('shows a clear button that resets the field and emits an empty string', () => {
    const onChange = vi.fn()
    render(<SearchBar value="milk" onChange={onChange} />)

    const input = screen.getByPlaceholderText(/search by name/i) as HTMLInputElement
    expect(input.value).toBe('milk')

    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('')
    expect(input.value).toBe('')
  })

  it('syncs the local value when the value prop changes', () => {
    const { rerender } = render(<SearchBar value="a" onChange={() => {}} />)
    const input = screen.getByPlaceholderText(/search by name/i) as HTMLInputElement
    expect(input.value).toBe('a')

    rerender(<SearchBar value="b" onChange={() => {}} />)
    expect(input.value).toBe('b')
  })

  it('honors a custom placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Find stuff" />)
    expect(screen.getByPlaceholderText('Find stuff')).toBeInTheDocument()
  })
})
