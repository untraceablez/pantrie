import { useState, useEffect } from 'react'
import { type InventoryItem } from '@/services/inventory'
import { listHouseholdAllergens, checkIngredientsForAllergens, type Allergen } from '@/services/allergen'
import NutritionFactsLabel from './NutritionFactsLabel'

interface ItemDetailModalProps {
  item: InventoryItem
  onClose: () => void
  onEdit?: (item: InventoryItem) => void
  onDelete?: (item: InventoryItem) => void
}

export default function ItemDetailModal({ item, onClose, onEdit, onDelete }: ItemDetailModalProps) {
  const [householdAllergens, setHouseholdAllergens] = useState<Allergen[]>([])
  const [matchedAllergens, setMatchedAllergens] = useState<string[]>([])

  // Fetch household allergens and check for matches
  useEffect(() => {
    const fetchAndCheckAllergens = async () => {
      try {
        const allergens = await listHouseholdAllergens(item.household_id)
        setHouseholdAllergens(allergens)

        // Check if any household allergens match the ingredients
        const matches = checkIngredientsForAllergens(item.ingredients, allergens)
        setMatchedAllergens(matches)
      } catch (err) {
        console.error('Error fetching household allergens:', err)
      }
    }

    fetchAndCheckAllergens()
  }, [item.household_id, item.ingredients])
  // Format quantity to remove unnecessary decimals
  const formatQuantity = (quantity: number): string => {
    try {
      const num = typeof quantity === 'string' ? parseFloat(quantity) : quantity
      if (isNaN(num)) return '0'
      if (Number.isInteger(num)) {
        return num.toString()
      }
      return parseFloat(num.toFixed(2)).toString()
    } catch (err) {
      return String(quantity)
    }
  }

  // Make unit singular when quantity is 1
  const formatUnit = (unit: string | null, quantity: number): string | null => {
    try {
      if (!unit) return null
      const num = typeof quantity === 'string' ? parseFloat(quantity) : quantity
      if (isNaN(num)) return unit
      if (num === 1) {
        if (unit.endsWith('s') && unit.length > 1) {
          return unit.slice(0, -1)
        }
      }
      return unit
    } catch (err) {
      return unit
    }
  }

  // Calculate days until expiration
  const getDaysUntilExpiration = () => {
    if (!item.expiration_date) return null
    const today = new Date()
    const expirationDate = new Date(item.expiration_date)
    const diffTime = expirationDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilExpiration = getDaysUntilExpiration()

  // Determine expiration status and styling
  const getExpirationStatus = () => {
    if (daysUntilExpiration === null) return null

    if (daysUntilExpiration < 0) {
      return { text: 'Expired', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' }
    } else if (daysUntilExpiration === 0) {
      return { text: 'Expires today', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' }
    } else if (daysUntilExpiration <= 3) {
      return { text: `Expires in ${daysUntilExpiration}d`, color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' }
    } else if (daysUntilExpiration <= 7) {
      return { text: `Expires in ${daysUntilExpiration}d`, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' }
    } else {
      return { text: `Expires in ${daysUntilExpiration}d`, color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' }
    }
  }

  const expirationStatus = getExpirationStatus()

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Item Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full max-h-96 object-contain rounded-lg bg-gray-100 dark:bg-gray-700"
            />
          ) : (
            <div className="w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <svg
                className="w-24 h-24 text-gray-400 dark:text-gray-500"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{item.name}</h3>
            {item.brand && (
              <p className="text-lg text-gray-600 dark:text-gray-400">{item.brand}</p>
            )}
            {item.description && (
              <p className="text-gray-700 dark:text-gray-300">{item.description}</p>
            )}
          </div>

          {/* Quantity and Expiration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Quantity</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{formatQuantity(item.quantity)}</span>
                {item.unit && <span className="text-xl text-gray-600 dark:text-gray-400">{formatUnit(item.unit, item.quantity)}</span>}
              </div>
            </div>

            {expirationStatus && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Expiration Status</p>
                <span className={`inline-block px-3 py-1.5 text-sm font-medium rounded border ${expirationStatus.color}`}>
                  {expirationStatus.text}
                </span>
              </div>
            )}
          </div>

          {/* Dates and Barcode */}
          <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            {item.expiration_date && (
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span className="font-medium mr-2">Expires:</span>
                <span>{formatDate(item.expiration_date)}</span>
              </div>
            )}

            {item.purchase_date && (
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <span className="font-medium mr-2">Purchased:</span>
                <span>{formatDate(item.purchase_date)}</span>
              </div>
            )}

            {item.barcode && (
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 4v16m8-8H4"></path>
                </svg>
                <span className="font-medium mr-2">Barcode:</span>
                <span className="font-mono">{item.barcode}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">{item.notes}</p>
            </div>
          )}

          {/* Allergens - Show both Open Food Facts allergens and matched household allergens */}
          {(() => {
            let openFoodFactsAllergens = null

            // Check if allergens are in the nutritional_info JSON
            if (item.nutritional_info) {
              try {
                const nutritionData = JSON.parse(item.nutritional_info)
                openFoodFactsAllergens = nutritionData.allergens
              } catch (e) {
                // Ignore parsing errors
              }
            }

            const hasAllergens = openFoodFactsAllergens || matchedAllergens.length > 0

            if (hasAllergens) {
              return (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 p-4">
                    <div className="flex items-start space-x-3">
                      <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-red-900 dark:text-red-200 mb-1">Allergen Warning</h4>

                        {matchedAllergens.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Household Allergens Detected:</p>
                            <p className="text-sm font-bold text-red-900 dark:text-red-200 capitalize">{matchedAllergens.join(', ')}</p>
                          </div>
                        )}

                        {openFoodFactsAllergens && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Product Allergens:</p>
                            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{openFoodFactsAllergens}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Ingredients */}
          {item.ingredients && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ingredients</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.ingredients}</p>
            </div>
          )}

          {/* Nutritional Info */}
          {item.nutritional_info && (() => {
            try {
              const nutritionData = JSON.parse(item.nutritional_info)

              // If we have detailed nutrition facts, show the FDA-style label
              if (nutritionData.nutrition_facts) {
                return (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Nutritional Information</h4>

                    {/* Nutrition Grade (allergens shown separately above) */}
                    {nutritionData.nutrition_grade && (
                      <div className="flex items-center mb-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400 mr-3">Nutrition Grade:</span>
                        <span className={`px-3 py-1 rounded font-bold uppercase text-sm ${
                          nutritionData.nutrition_grade === 'a' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          nutritionData.nutrition_grade === 'b' ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-300' :
                          nutritionData.nutrition_grade === 'c' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                          nutritionData.nutrition_grade === 'd' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                          'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}>
                          {nutritionData.nutrition_grade}
                        </span>
                      </div>
                    )}

                    {/* FDA-style Nutrition Facts Label */}
                    <div className="flex justify-center">
                      <NutritionFactsLabel nutritionFacts={nutritionData.nutrition_facts} />
                    </div>
                  </div>
                )
              }

              // Otherwise, show the simple format (allergens shown separately above)
              return (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Nutritional Information</h4>
                  <div className="space-y-3">
                    {nutritionData.nutrition_grade && (
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400 w-32">Nutrition Grade:</span>
                        <span className={`px-3 py-1 rounded font-bold uppercase text-sm ${
                          nutritionData.nutrition_grade === 'a' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          nutritionData.nutrition_grade === 'b' ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-300' :
                          nutritionData.nutrition_grade === 'c' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                          nutritionData.nutrition_grade === 'd' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                          'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}>
                          {nutritionData.nutrition_grade}
                        </span>
                      </div>
                    )}
                    {nutritionData.serving_size && (
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400 w-32">Serving Size:</span>
                        <span className="text-sm text-gray-900 dark:text-white">{nutritionData.serving_size}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            } catch (e) {
              return null
            }
          })()}
        </div>

        {/* Footer with actions */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end space-x-3">
          {onDelete && (
            <button
              onClick={() => onDelete(item)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors"
            >
              Delete
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
