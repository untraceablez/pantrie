import { useState, useEffect } from 'react'
import { type InventoryItem } from '@/services/inventory'
import { listHouseholdAllergens, checkIngredientsForAllergens, type Allergen } from '@/services/allergen'

interface InventoryItemCardProps {
  item: InventoryItem
  onEdit?: (item: InventoryItem) => void
  onDelete?: (item: InventoryItem) => void
  onClick?: (item: InventoryItem) => void
}

export default function InventoryItemCard({ item, onEdit, onDelete, onClick }: InventoryItemCardProps) {
  const [showIngredients, setShowIngredients] = useState(false)
  const [showNutrition, setShowNutrition] = useState(false)
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

  // Debug logging
  console.log('Item card data:', item.name, {
    ingredients: item.ingredients,
    nutritional_info: item.nutritional_info,
  })

  // Format quantity to remove unnecessary decimals
  const formatQuantity = (quantity: number): string => {
    try {
      // Ensure we're working with a number
      const num = typeof quantity === 'string' ? parseFloat(quantity) : quantity
      if (isNaN(num)) return '0'

      // Check if the quantity is a whole number
      if (Number.isInteger(num)) {
        return num.toString()
      }
      // Otherwise, show up to 2 decimal places, removing trailing zeros
      return parseFloat(num.toFixed(2)).toString()
    } catch (err) {
      console.error('Error formatting quantity:', err)
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
        // Remove trailing 's' for common plural forms
        if (unit.endsWith('s') && unit.length > 1) {
          return unit.slice(0, -1)
        }
      }
      return unit
    } catch (err) {
      console.error('Error formatting unit:', err)
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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on edit/delete buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onClick?.(item)
  }

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow bg-white dark:bg-gray-800 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Item image or placeholder */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-40 object-cover rounded-md mb-4"
        />
      ) : (
        <div className="w-full h-40 bg-gray-100 dark:bg-gray-700 rounded-md mb-4 flex items-center justify-center">
          <svg
            className="w-16 h-16 text-gray-400 dark:text-gray-500"
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

      {/* Item details */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1 mr-2">{item.name}</h3>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                title="Edit item"
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
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(item)}
                className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                title="Delete item"
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
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {item.brand && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{item.brand}</p>
        )}

        {item.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-1">
            <span className="text-lg font-bold text-gray-900 dark:text-white">{formatQuantity(item.quantity)}</span>
            {item.unit && <span className="text-sm text-gray-600 dark:text-gray-400">{formatUnit(item.unit, item.quantity)}</span>}
          </div>

          {expirationStatus && (
            <span className={`px-2 py-1 text-xs font-medium rounded border ${expirationStatus.color}`}>
              {expirationStatus.text}
            </span>
          )}
        </div>

        {/* Additional info */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
          {item.expiration_date && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mr-1" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <span>Expires: {formatDate(item.expiration_date)}</span>
            </div>
          )}

          {item.purchase_date && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mr-1" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <span>Purchased: {formatDate(item.purchase_date)}</span>
            </div>
          )}

          {item.barcode && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mr-1" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 4v16m8-8H4"></path>
              </svg>
              <span>{item.barcode}</span>
            </div>
          )}
        </div>

        {item.notes && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-2">{item.notes}</p>
          </div>
        )}

        {/* Allergens Section - Show both Open Food Facts allergens and matched household allergens */}
        {(() => {
          let openFoodFactsAllergens = null
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
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="rounded bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 p-2">
                  <div className="flex items-start space-x-2">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-red-900 dark:text-red-200 mb-1">Allergen Warning</p>

                      {matchedAllergens.length > 0 && (
                        <div className="mb-1">
                          <p className="text-[10px] font-semibold text-red-700 dark:text-red-300">Household:</p>
                          <p className="text-xs font-bold text-red-900 dark:text-red-200 capitalize line-clamp-1">{matchedAllergens.join(', ')}</p>
                        </div>
                      )}

                      {openFoodFactsAllergens && (
                        <div>
                          <p className="text-[10px] font-semibold text-red-700 dark:text-red-300">Product:</p>
                          <p className="text-xs font-semibold text-red-800 dark:text-red-300 line-clamp-2">{openFoodFactsAllergens}</p>
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

        {/* Ingredients Section */}
        {item.ingredients && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowIngredients(!showIngredients)}
              className="w-full flex items-center justify-between text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <span>Ingredients</span>
              <svg
                className={`w-4 h-4 transition-transform ${showIngredients ? 'transform rotate-180' : ''}`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            {showIngredients && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {item.ingredients}
              </p>
            )}
          </div>
        )}

        {/* Nutritional Info Section */}
        {item.nutritional_info && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowNutrition(!showNutrition)}
              className="w-full flex items-center justify-between text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <span>Nutrition Info</span>
              <svg
                className={`w-4 h-4 transition-transform ${showNutrition ? 'transform rotate-180' : ''}`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            {showNutrition && (() => {
              try {
                const nutritionData = JSON.parse(item.nutritional_info)
                return (
                  <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    {nutritionData.nutrition_grade && (
                      <div className="flex items-center">
                        <span className="font-medium mr-2">Nutrition Grade:</span>
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
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
                      <div>
                        <span className="font-medium">Serving Size:</span> {nutritionData.serving_size}
                      </div>
                    )}
                    {nutritionData.allergens && (
                      <div>
                        <span className="font-medium">Allergens:</span> {nutritionData.allergens}
                      </div>
                    )}
                  </div>
                )
              } catch (e) {
                return <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Invalid nutrition data</p>
              }
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
