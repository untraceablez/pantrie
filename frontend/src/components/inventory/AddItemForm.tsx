import { useState, useEffect, useRef } from 'react'
import { createItem } from '@/services/inventory'
import { lookupBarcode } from '@/services/barcode'
import { listHouseholds, createHousehold, type HouseholdWithRole } from '@/services/household'
import { listHouseholdLocations, type Location } from '@/services/location'
import { useAuthStore } from '@/store/authStore'
import BarcodeScanner from '@/components/barcode/BarcodeScanner'

interface AddItemFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function AddItemForm({ onSuccess, onCancel }: AddItemFormProps) {
  // Get today's date in YYYY-MM-DD format for the default purchase date
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [householdId, setHouseholdId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('box')
  const [categoryId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [purchaseDate, setPurchaseDate] = useState(getTodayDate())
  const [expirationDate, setExpirationDate] = useState('')
  const [barcode, setBarcode] = useState('')
  const [brand, setBrand] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [ingredients, setIngredients] = useState('')
  const [nutritionalInfo, setNutritionalInfo] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [productFound, setProductFound] = useState(false)
  const [households, setHouseholds] = useState<HouseholdWithRole[]>([])
  const [loadingHouseholds, setLoadingHouseholds] = useState(true)
  const [creatingHousehold, setCreatingHousehold] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])

  const { user } = useAuthStore()
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus barcode input on mount
  useEffect(() => {
    // Small delay to ensure the component is fully rendered
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Fetch user's households on mount
  useEffect(() => {
    const fetchHouseholds = async () => {
      if (!user) return

      try {
        setLoadingHouseholds(true)
        const userHouseholds = await listHouseholds()
        setHouseholds(userHouseholds)

        // If user has households, set the first one as default
        if (userHouseholds.length > 0) {
          setHouseholdId(userHouseholds[0].id)
        }
      } catch (err) {
        console.error('Error fetching households:', err)
        setError('Failed to load households')
      } finally {
        setLoadingHouseholds(false)
      }
    }

    fetchHouseholds()
  }, [user])

  // Fetch locations when household changes
  useEffect(() => {
    const fetchLocations = async () => {
      if (!householdId) {
        setLocations([])
        return
      }

      try {
        const householdLocations = await listHouseholdLocations(householdId)
        setLocations(householdLocations)
      } catch (err) {
        console.error('Error fetching locations:', err)
        // Don't show error to user, just log it
      }
    }

    fetchLocations()
  }, [householdId])

  // Check for expired items when dates change
  useEffect(() => {
    if (expirationDate && purchaseDate) {
      const expiration = new Date(expirationDate)
      const purchase = new Date(purchaseDate)
      const today = new Date()

      if (expiration < purchase) {
        setWarning('⚠️ Warning: The expiration date is before the purchase date. This item may already be expired!')
      } else if (expiration < today) {
        setWarning('⚠️ Warning: This item is expired!')
      } else {
        setWarning('')
      }
    } else if (expirationDate) {
      const expiration = new Date(expirationDate)
      const today = new Date()

      if (expiration < today) {
        setWarning('⚠️ Warning: This item is expired!')
      } else {
        setWarning('')
      }
    } else {
      setWarning('')
    }
  }, [expirationDate, purchaseDate])

  const handleCreateDefaultHousehold = async () => {
    console.log('Creating household...')
    setCreatingHousehold(true)
    setError('')

    try {
      console.log('Calling createHousehold API...')
      const newHousehold = await createHousehold({
        name: 'My Household',
        description: 'Default household',
      })
      console.log('Household created:', newHousehold)

      // Refresh households list
      console.log('Fetching households list...')
      const userHouseholds = await listHouseholds()
      console.log('Households:', userHouseholds)
      setHouseholds(userHouseholds)
      setHouseholdId(newHousehold.id)
    } catch (err: any) {
      console.error('Error creating household:', err)
      setError(err.response?.data?.error || err.message || 'Failed to create household')
    } finally {
      setCreatingHousehold(false)
    }
  }

  const lookupBarcodeData = async (scannedBarcode: string) => {
    setLookingUp(true)
    setError('')
    setProductFound(false)

    try {
      const productInfo = await lookupBarcode(scannedBarcode)

      // Debug logging
      console.log('Barcode lookup response:', productInfo)
      console.log('Ingredients:', productInfo.ingredients)
      console.log('Nutrition grade:', productInfo.nutrition_grade)
      console.log('Serving size:', productInfo.serving_size)
      console.log('Allergens:', productInfo.allergens)

      // Populate form fields with product information
      setName(productInfo.name || '')
      setDescription(productInfo.description || '')
      setBrand(productInfo.brand || '')

      // Set image URL if available from external database
      if (productInfo.image_url) {
        setImageUrl(productInfo.image_url)
        setImagePreview(productInfo.image_url)
        // Clear any uploaded file since we have an external URL
        setImageFile(null)
      }

      // Set ingredients if available
      if (productInfo.ingredients) {
        console.log('Setting ingredients:', productInfo.ingredients)
        setIngredients(productInfo.ingredients)
      }

      // Set nutritional info if available (store as JSON string)
      if (productInfo.nutrition_grade || productInfo.serving_size || productInfo.nutrition_facts) {
        const nutritionData = {
          nutrition_grade: productInfo.nutrition_grade,
          serving_size: productInfo.serving_size,
          allergens: productInfo.allergens,
          nutrition_facts: productInfo.nutrition_facts,
        }
        console.log('Setting nutritional info:', nutritionData)
        setNutritionalInfo(JSON.stringify(nutritionData))
      }

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

  const handleBarcodeScanned = async (scannedBarcode: string) => {
    setShowScanner(false)
    setBarcode(scannedBarcode)
    await lookupBarcodeData(scannedBarcode)
  }

  const handleManualBarcodeLookup = async () => {
    if (barcode.trim()) {
      await lookupBarcodeData(barcode.trim())
    }
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Image size must be less than 10MB')
      return
    }

    setImageFile(file)
    // Clear external URL since we're using a file
    setImageUrl('')

    // Create preview
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
      // Clear file since we're using a URL
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

      const itemData = {
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
        image_url: finalImageUrl,
        notes: notes || null,
        ingredients: ingredients || null,
        nutritional_info: nutritionalInfo || null,
      }

      console.log('Creating item with data:', itemData)
      console.log('Ingredients being sent:', ingredients)
      console.log('Nutritional info being sent:', nutritionalInfo)

      await createItem(itemData)

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
        {/* Loading State */}
        {loadingHouseholds && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Loading households...</p>
          </div>
        )}

        {/* No Household Message */}
        {!loadingHouseholds && households.length === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
              No Household Found
            </h3>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
              You need to create a household before adding inventory items.
            </p>
            <button
              type="button"
              onClick={handleCreateDefaultHousehold}
              disabled={creatingHousehold}
              className="px-4 py-2 bg-yellow-600 dark:bg-yellow-700 text-white rounded-md hover:bg-yellow-700 dark:hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingHousehold ? 'Creating...' : 'Create My Household'}
            </button>
          </div>
        )}

        {/* Household Selection (if multiple) */}
        {households.length > 1 && (
          <div>
            <label htmlFor="household" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Household *
            </label>
            <select
              id="household"
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              value={householdId || ''}
              onChange={(e) => setHouseholdId(Number(e.target.value))}
              required
            >
              <option value="">Select a household</option>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name} ({household.user_role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Barcode Scanner Section */}
        {households.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Scan or Enter Barcode (Optional)
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Scan with camera or use a USB/Bluetooth barcode scanner to automatically fill in details
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Manual Barcode Input */}
            <div className="flex-1 flex gap-2">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Enter or scan barcode here"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleManualBarcodeLookup()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleManualBarcodeLookup}
                disabled={!barcode.trim() || lookingUp}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Lookup
              </button>
            </div>

            {/* Camera Scan Button */}
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              disabled={lookingUp}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span>Camera</span>
            </button>
          </div>

          <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
            💡 Tip: USB/Bluetooth scanners will automatically type the barcode into the field
          </p>
        </div>
        )}

        {households.length > 0 && (
        <>
          {productFound && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-3">
                ✓ Product found! Details have been filled in.
              </p>
              {/* Data availability indicators */}
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className={`flex items-center space-x-2 text-xs ${
                  ingredients ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {ingredients ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>Ingredients</span>
                </div>
                <div className={`flex items-center space-x-2 text-xs ${
                  nutritionalInfo && JSON.parse(nutritionalInfo).nutrition_grade !== 'unknown'
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {nutritionalInfo && JSON.parse(nutritionalInfo).nutrition_grade !== 'unknown' ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>Nutrition Grade</span>
                </div>
                <div className={`flex items-center space-x-2 text-xs ${
                  nutritionalInfo && JSON.parse(nutritionalInfo).serving_size
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {nutritionalInfo && JSON.parse(nutritionalInfo).serving_size ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>Serving Size</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {warning && (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{warning}</p>
            </div>
          )}

        {/* Item Name */}
        <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Item Name *
        </label>
        <input
          id="name"
          type="text"
          required
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Quantity and Unit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Quantity *
          </label>
          <input
            id="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Unit
          </label>
          <select
            id="unit"
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
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
        <label htmlFor="brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Brand
        </label>
        <input
          id="brand"
          type="text"
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </div>

      {/* Image Upload/URL */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Item Image (Optional)
        </label>

        {/* Image Preview */}
        {imagePreview && (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-40 w-40 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              title="Remove image"
            >
              <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        )}

        {/* Image Input Options */}
        <div className="space-y-3">
          {/* File Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Upload Photo
            </label>
            <div className="flex items-center space-x-2">
              <label className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                <svg className="w-5 h-5 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                {imageFile ? imageFile.name : 'Choose or Take Photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFileChange}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Click to select from gallery or take a photo (max 10MB)
            </p>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Or Enter Image URL
            </label>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              value={imageUrl}
              onChange={(e) => handleImageUrlChange(e.target.value)}
              disabled={!!imageFile}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              External image URLs (from barcode lookup or manual entry)
            </p>
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Location
        </label>
        <select
          id="location"
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={locationId || ''}
          onChange={(e) => {
            const value = e.target.value
            setLocationId(value ? Number(value) : null)
          }}
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
          <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Purchase Date
          </label>
          <input
            id="purchaseDate"
            type="date"
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Expiration Date
          </label>
          <input
            id="expirationDate"
            type="date"
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

        {/* Form Actions for when household exists */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !householdId || loadingHouseholds}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add Item'}
          </button>
        </div>
        </>
        )}

        {/* Cancel button for when no household exists */}
        {!loadingHouseholds && households.length === 0 && (
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Cancel
            </button>
          </div>
        )}
    </form>
    </>
  )
}
