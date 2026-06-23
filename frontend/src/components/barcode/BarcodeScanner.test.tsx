import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BarcodeScanner from './BarcodeScanner'

// Shared mocks for the html5-qrcode dependency.
const h = vi.hoisted(() => {
  let onScanCb: ((text: string) => void) | null = null
  let onErrorCb: ((msg: string) => void) | null = null
  return {
    getCameras: vi.fn(),
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    setCbs: (scan: ((t: string) => void) | null, err: ((m: string) => void) | null) => {
      onScanCb = scan
      onErrorCb = err
    },
    fireScan: (text: string) => onScanCb?.(text),
    fireScanError: (msg: string) => onErrorCb?.(msg),
  }
})

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    static getCameras = h.getCameras
    start = (...args: any[]) => {
      h.setCbs(args[2], args[3]) // capture success + error callbacks
      return h.start(...args)
    }
    stop = h.stop
  },
}))

const cameras = [{ id: 'cam-front', label: 'Front Camera' }]

describe('BarcodeScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    h.start.mockResolvedValue(undefined)
    h.stop.mockResolvedValue(undefined)
  })

  it('lists cameras and offers Start Scanning', async () => {
    h.getCameras.mockResolvedValue(cameras)
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByLabelText('Select Camera')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Scanning' })).toBeInTheDocument()
  })

  it('shows an error when no cameras are found', async () => {
    h.getCameras.mockResolvedValue([])
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText('No cameras found on this device')).toBeInTheDocument()
  })

  it('shows an error when camera access fails', async () => {
    h.getCameras.mockRejectedValue(new Error('denied'))
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    expect(
      await screen.findByText('Unable to access camera. Please check permissions.')
    ).toBeInTheDocument()
  })

  it('prefers a back-facing camera when available', async () => {
    h.getCameras.mockResolvedValue([
      { id: 'front', label: 'Front Camera' },
      { id: 'rear', label: 'Back Camera' },
    ])
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    const select = (await screen.findByLabelText('Select Camera')) as HTMLSelectElement
    expect(select.value).toBe('rear')
  })

  it('starts scanning and reports a decoded barcode', async () => {
    h.getCameras.mockResolvedValue(cameras)
    const onScan = vi.fn()
    render(<BarcodeScanner onScan={onScan} onClose={vi.fn()} />)
    await screen.findByRole('button', { name: 'Start Scanning' })

    fireEvent.click(screen.getByRole('button', { name: 'Start Scanning' }))
    await waitFor(() => expect(h.start).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Stop Scanning' })).toBeInTheDocument()

    // Per-frame scan errors are swallowed (NotFound) or logged (real errors).
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    h.fireScanError('NotFoundException: no code')
    h.fireScanError('some real failure')
    expect(debugSpy).toHaveBeenCalledTimes(1)

    // Simulate a successful decode via the captured callback.
    h.fireScan('0123456789')
    expect(onScan).toHaveBeenCalledWith('0123456789')
  })

  it('logs but tolerates a stop() failure', async () => {
    h.getCameras.mockResolvedValue(cameras)
    h.stop.mockRejectedValueOnce(new Error('stop failed'))
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    await screen.findByRole('button', { name: 'Start Scanning' })

    fireEvent.click(screen.getByRole('button', { name: 'Start Scanning' }))
    await screen.findByRole('button', { name: 'Stop Scanning' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop Scanning' }))
    await waitFor(() => expect(h.stop).toHaveBeenCalled())
  })

  it('surfaces a start error', async () => {
    h.getCameras.mockResolvedValue(cameras)
    h.start.mockRejectedValue(new Error('camera busy'))
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    await screen.findByRole('button', { name: 'Start Scanning' })

    fireEvent.click(screen.getByRole('button', { name: 'Start Scanning' }))
    expect(await screen.findByText('camera busy')).toBeInTheDocument()
  })

  it('changes the selected camera', async () => {
    h.getCameras.mockResolvedValue([
      { id: 'front', label: 'Front Camera' },
      { id: 'rear', label: 'Back Camera' },
    ])
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    const select = (await screen.findByLabelText('Select Camera')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'front' } })
    expect(select.value).toBe('front')
  })

  it('closes via Cancel', async () => {
    h.getCameras.mockResolvedValue(cameras)
    const onClose = vi.fn()
    render(<BarcodeScanner onScan={vi.fn()} onClose={onClose} />)
    await screen.findByRole('button', { name: 'Start Scanning' })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
