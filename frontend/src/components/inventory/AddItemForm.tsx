import { useState, useEffect } from 'react'
import { createItem } from '@/services/inventory'
import { lookupBarcode } from '@/services/barcode'
import { useAuthStore } from '@/store/authStore'
import BarcodeScanner from '@/components/barcode/BarcodeScanner'

interface AddItemFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function AddItemForm({ onSuccess, onCancel }: AddItemFormProps) {
  const [householdId, setHouseholdId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('pieces')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [barcode, setBarcode] = useState('')
  const [brand, setBrand] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [productFound, setProductFound] = useState(false)

  const { user } = useAuthStore()

  // For now, use a placeholder household ID
  // In a real app, this would come from a household selection
  useEffect(() => {
    if (user) {
      setHouseholdId(1) // TODO: Get from household context or selection
    }
  }, [user])

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    setShowScanner(false)
    setBarcode(scannedBarcode)
    setLookingUp(true)
    setError('')
    setProductFound(false)

    try {
      const productInfo = await lookupBarcode(scannedBarcode)

      // Populate form fields with product information
      setName(productInfo.name || '')
      setDescription(productInfo.description || '')
      setBrand(productInfo.brand || '')

      // Show success message
      setProductFound(true)
      setTimeout(() => setProductFound(false), 3000)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(
          'Product not found in database. Please enter details manually.'
        )
      } else {
        setError('Failed to lookup product. Please enter details manually.')
      }
    } finally {
      setLookingUp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!householdId) {
      setError('Please select a household')
      return
    }

    if (Number(quantity) <= 0) {
      setError('Quantity must be greater than 0')
      return
    }

    setLoading(true)

    try {
      await createItem({
        household_id: householdId,
        name,
        description: description || null,
        quantity: Number(quantity),
        unit: unit || null,
        category_id: categoryId,
        location_id: locationId,
        purchase_date: purchaseDate || null,
        expiration_date: expirationDate || null,
        barcode: barcode || null,
        brand: brand || null,
        notes: notes || null,
      })

      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create item. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Barcode Scanner Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-900">
                Scan Barcode (Optional)
              </h3>
              <p className="text-xs text-blue-700 mt-1">
                Scan a product barcode to automatically fill in details
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              disabled={lookingUp}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
              </svg>
              <span>{lookingUp ? 'Looking up...' : 'Scan Barcode'}</span>
            </button>
          </div>
        </div>

        {productFound && (
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">
              ✓ Product found! Details have been filled in. Review and adjust as needed.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Item Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Item Name *
        </label>
        <input
          id="name"
          type="text"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Quantity and Unit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
            Quantity *
          </label>
          <input
            id="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
            Unit
          </label>
          <select
            id="unit"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="pieces">Pieces</option>
            <option value="kg">Kilograms</option>
            <option value="g">Grams</option>
            <option value="lbs">Pounds</option>
            <option value="oz">Ounces</option>
            <option value="L">Liters</option>
            <option value="mL">Milliliters</option>
            <option value="gal">Gallons</option>
            <option value="cups">Cups</option>
            <option value="tbsp">Tablespoons</option>
            <option value="tsp">Teaspoons</option>
          </select>
        </div>
      </div>

      {/* Brand */}
      <div>
        <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
          Brand
        </label>
        <input
          id="brand"
          type="text"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">
            Purchase Date
          </label>
          <input
            id="purchaseDate"
            type="date"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700">
            Expiration Date
          </label>
          <input
            id="expirationDate"
            type="date"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </div>
      </div>

      {/* Barcode */}
      <div>
        <label htmlFor="barcode" className="block text-sm font-medium text-gray-700">
          Barcode
        </label>
        <input
          id="barcode"
          type="text"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add Item'}
        </button>
      </div>
    </form>
    </>
  )
}
