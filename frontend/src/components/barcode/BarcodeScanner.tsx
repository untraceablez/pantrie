import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>('')

  useEffect(() => {
    // Get available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const cameraList = devices.map((device) => ({
            id: device.id,
            label: device.label || `Camera ${device.id}`,
          }))
          setCameras(cameraList)
          // Prefer back camera on mobile devices
          const backCamera = devices.find((device) =>
            device.label?.toLowerCase().includes('back')
          )
          setSelectedCamera(backCamera?.id || devices[0].id)
        } else {
          setError('No cameras found on this device')
        }
      })
      .catch((err) => {
        console.error('Error getting cameras:', err)
        setError('Unable to access camera. Please check permissions.')
      })

    return () => {
      stopScanning()
    }
  }, [])

  const startScanning = async () => {
    if (!selectedCamera) {
      setError('No camera selected')
      return
    }

    try {
      const scanner = new Html5Qrcode('barcode-reader')
      scannerRef.current = scanner

      await scanner.start(
        selectedCamera,
        {
          fps: 10, // Frames per second to process
          qrbox: { width: 250, height: 250 }, // Scanning box size
        },
        (decodedText) => {
          // Successfully scanned
          onScan(decodedText)
          stopScanning()
        },
        (errorMessage) => {
          // Scanning error (usually just "no code found" - ignore)
          // Only log if it's not the common "No MultiFormat Readers were able to detect the code" message
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.debug('Scan error:', errorMessage)
          }
        }
      )

      setIsScanning(true)
      setError(null)
    } catch (err: any) {
      console.error('Error starting scanner:', err)
      setError(err.message || 'Failed to start camera')
    }
  }

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current = null
          setIsScanning(false)
        })
        .catch((err) => {
          console.error('Error stopping scanner:', err)
        })
    }
  }

  const handleClose = () => {
    stopScanning()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Scan Barcode</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {cameras.length > 0 && !isScanning && (
          <div className="mb-4">
            <label
              htmlFor="camera-select"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Camera
            </label>
            <select
              id="camera-select"
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          id="barcode-reader"
          className="mb-4 rounded-lg overflow-hidden"
          style={{ minHeight: '250px' }}
        ></div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          {!isScanning && cameras.length > 0 && (
            <button
              onClick={startScanning}
              disabled={!selectedCamera}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Scanning
            </button>
          )}
          {isScanning && (
            <button
              onClick={stopScanning}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              Stop Scanning
            </button>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p>Position the barcode within the scanning area.</p>
          <p>Supported formats: UPC, EAN, Code 128, Code 39, QR Code, and more.</p>
        </div>
      </div>
    </div>
  )
}
