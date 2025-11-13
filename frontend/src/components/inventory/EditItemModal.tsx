import { useState, useEffect } from 'react'
import { updateItem, type InventoryItem, type UpdateInventoryItemData } from '@/services/inventory'
import { listHouseholdLocations, type Location } from '@/services/location'

interface EditItemModalProps {
  item: InventoryItem
  onClose: () => void
  onSuccess: () => void
}

export default function EditItemModal({ item, onClose, onSuccess }: EditItemModalProps) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description || '')
  const [quantity, setQuantity] = useState(item.quantity.toString())
  const [unit, setUnit] = useState(item.unit || 'box')
  const [locationId, setLocationId] = useState<number | null>(item.location_id)
  const [purchaseDate, setPurchaseDate] = useState(item.purchase_date || '')
  const [expirationDate, setExpirationDate] = useState(item.expiration_date || '')
  const [brand, setBrand] = useState(item.brand || '')
  const [imageUrl, setImageUrl] = useState(item.image_url || '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(item.image_url || '')
  const [ingredients, setIngredients] = useState(item.ingredients || '')
  const [nutritionalInfo, setNutritionalInfo] = useState(item.nutritional_info || '')
  const [notes, setNotes] = useState(item.notes || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])

  // Fetch locations for the household
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const householdLocations = await listHouseholdLocations(item.household_id)
        setLocations(householdLocations)
      } catch (err) {
        console.error('Error fetching locations:', err)
      }
    }

    fetchLocations()
  }, [item.household_id])

  // Reset form when item changes
  useEffect(() => {
    setName(item.name)
    setDescription(item.description || '')
    setQuantity(item.quantity.toString())
    setUnit(item.unit || 'box')
    setLocationId(item.location_id)
    setPurchaseDate(item.purchase_date || '')
    setExpirationDate(item.expiration_date || '')
    setBrand(item.brand || '')
    setImageUrl(item.image_url || '')
    setImagePreview(item.image_url || '')
    setImageFile(null)
    setIngredients(item.ingredients || '')
    setNutritionalInfo(item.nutritional_info || '')
    setNotes(item.notes || '')
  }, [item])

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Image size must be less than 10MB')
      return
    }

    setImageFile(file)
    setImageUrl('')

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageUrlChange = (url: string) => {
    setImageUrl(url)
    if (url.trim()) {
      setImagePreview(url)
      setImageFile(null)
    } else {
      if (!imageFile) {
        setImagePreview('')
      }
    }
  }

  const handleRemoveImage = () => {
    setImageUrl('')
    setImageFile(null)
    setImagePreview('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate required fields
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Quantity must be greater than 0')
      return
    }

    // No date validation - allow any dates (warning shown in UI)

    setLoading(true)

    try {
      // Determine which image to use
      let finalImageUrl = imageUrl || null

      // If user uploaded a file, convert to base64
      if (imageFile) {
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
      }

      const updateData: UpdateInventoryItemData = {
        name: name.trim(),
        description: description.trim() || null,
        quantity: parseFloat(quantity),
        unit: unit || null,
        location_id: locationId,
        purchase_date: purchaseDate || null,
        expiration_date: expirationDate || null,
        brand: brand.trim() || null,
        image_url: finalImageUrl,
        notes: notes.trim() || null,
        ingredients: ingredients.trim() || null,
        nutritional_info: nutritionalInfo.trim() || null,
      }

      await updateItem(item.id, updateData)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error updating item:', err)
      setError(err.response?.data?.error || 'Failed to update item. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Item</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            disabled={loading}
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

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                required
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                disabled={loading}
              />
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  step="0.01"
                  min="0.01"
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit
                </label>
                <select
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                  disabled={loading}
                >
                  <option value="box">Box</option>
                  <option value="can">Can</option>
                  <option value="package">Package</option>
                  <option value="bottle">Bottle</option>
                  <option value="jar">Jar</option>
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
              <label htmlFor="brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Brand
              </label>
              <input
                type="text"
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                disabled={loading}
              />
            </div>

            {/* Image Upload/URL */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Item Image
              </label>

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    title="Remove image"
                  >
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              )}

              {/* Image Input Options */}
              <div className="space-y-2">
                {/* File Upload */}
                <div>
                  <label className="flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                    <svg className="w-4 h-4 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                      <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    {imageFile ? 'Change Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageFileChange}
                      disabled={loading}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* URL Input */}
                <div>
                  <input
                    type="url"
                    placeholder="Or enter image URL"
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-xs"
                    value={imageUrl}
                    onChange={(e) => handleImageUrlChange(e.target.value)}
                    disabled={!!imageFile || loading}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <select
                id="location"
                value={locationId || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setLocationId(value ? Number(value) : null)
                }}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                disabled={loading}
              >
                <option value="">None</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.icon && `${location.icon} `}{location.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="purchase-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  id="purchase-date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="expiration-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  id="expiration-date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="Any additional notes about this item..."
                disabled={loading}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
