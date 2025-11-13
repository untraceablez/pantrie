interface NutritionFacts {
  serving_size?: string
  servings_per_container?: string | number
  calories?: number
  total_fat?: number
  saturated_fat?: number
  trans_fat?: number
  cholesterol?: number
  sodium?: number
  total_carbohydrate?: number
  dietary_fiber?: number
  total_sugars?: number
  added_sugars?: number
  protein?: number
  vitamin_d?: number
  calcium?: number
  iron?: number
  potassium?: number
  vitamin_a?: number
  vitamin_c?: number
}

interface NutritionFactsLabelProps {
  nutritionFacts: NutritionFacts
}

export default function NutritionFactsLabel({ nutritionFacts }: NutritionFactsLabelProps) {
  // Helper function to calculate % Daily Value
  const calculateDV = (value: number | undefined, dailyValue: number): string => {
    if (!value || value === 0) return '0%'
    const percentage = Math.round((value / dailyValue) * 100)
    return `${percentage}%`
  }

  // Daily Values based on a 2,000 calorie diet
  const dailyValues = {
    total_fat: 78, // grams
    saturated_fat: 20, // grams
    cholesterol: 300, // mg
    sodium: 2300, // mg
    total_carbohydrate: 275, // grams
    dietary_fiber: 28, // grams
    added_sugars: 50, // grams
    protein: 50, // grams
    vitamin_d: 20, // mcg
    calcium: 1300, // mg
    iron: 18, // mg
    potassium: 4700, // mg
  }

  // Format number to remove unnecessary decimals
  const formatValue = (value: number | undefined): string => {
    if (!value) return '0'
    // Round to nearest whole number for most values
    return Math.round(value).toString()
  }

  // Format calories (always round to nearest 5 or 10 for values over 50)
  const formatCalories = (value: number | undefined): string => {
    if (!value) return '0'
    // For FDA labels, round to nearest 5 calories for values between 50-100
    // and to nearest 10 for values over 100
    if (value >= 100) {
      return (Math.round(value / 10) * 10).toString()
    } else if (value >= 50) {
      return (Math.round(value / 5) * 5).toString()
    } else {
      // Under 50, can round to nearest whole number
      return Math.round(value).toString()
    }
  }

  // Convert mg to g for sodium display
  const formatSodium = (mg: number | undefined): string => {
    if (!mg) return '0mg'
    // Display in mg
    return `${Math.round(mg * 1000)}mg`
  }

  return (
    <div className="border-4 border-black dark:border-gray-200 bg-white dark:bg-gray-800 p-2 font-sans max-w-sm">
      {/* Header */}
      <div className="border-b-8 border-black dark:border-gray-200 pb-1">
        <h2 className="text-3xl font-black text-black dark:text-white">Nutrition Facts</h2>
        {nutritionFacts.servings_per_container && (
          <p className="text-xs text-black dark:text-gray-200 mt-1">
            {typeof nutritionFacts.servings_per_container === 'number'
              ? `${nutritionFacts.servings_per_container} servings per container`
              : nutritionFacts.servings_per_container}
          </p>
        )}
        <div className="border-b-4 border-black dark:border-gray-200 mt-1 pb-1">
          <p className="text-xs font-bold text-black dark:text-gray-200">Serving size</p>
          <p className="text-xs text-black dark:text-gray-200">
            {nutritionFacts.serving_size || 'Not specified'}
          </p>
        </div>
      </div>

      {/* Calories */}
      <div className="border-b-8 border-black dark:border-gray-200 py-1">
        <div className="flex justify-between items-end">
          <p className="text-xs font-bold text-black dark:text-gray-200">
            Amount per serving
          </p>
        </div>
        <div className="flex justify-between items-baseline">
          <p className="text-2xl font-black text-black dark:text-white">Calories</p>
          <p className="text-3xl font-black text-black dark:text-white">
            {formatCalories(nutritionFacts.calories)}
          </p>
        </div>
      </div>

      {/* % Daily Value header */}
      <div className="border-b-4 border-black dark:border-gray-200 py-1">
        <p className="text-xs font-bold text-right text-black dark:text-gray-200">% Daily Value*</p>
      </div>

      {/* Total Fat */}
      {nutritionFacts.total_fat !== undefined && (
        <div className="border-b border-black dark:border-gray-700 py-1">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-bold text-black dark:text-white">
              <span className="font-bold">Total Fat </span>
              <span className="font-normal">{formatValue(nutritionFacts.total_fat)}g</span>
            </p>
            <p className="text-sm font-bold text-black dark:text-white">
              {calculateDV(nutritionFacts.total_fat, dailyValues.total_fat)}
            </p>
          </div>

          {/* Saturated Fat (indented) */}
          {nutritionFacts.saturated_fat !== undefined && (
            <div className="flex justify-between items-baseline ml-4 mt-1">
              <p className="text-sm text-black dark:text-gray-200">
                Saturated Fat {formatValue(nutritionFacts.saturated_fat)}g
              </p>
              <p className="text-sm font-bold text-black dark:text-white">
                {calculateDV(nutritionFacts.saturated_fat, dailyValues.saturated_fat)}
              </p>
            </div>
          )}

          {/* Trans Fat (indented) */}
          {nutritionFacts.trans_fat !== undefined && (
            <div className="flex justify-between items-baseline ml-4 mt-1">
              <p className="text-sm text-black dark:text-gray-200">
                <span className="italic">Trans</span> Fat {formatValue(nutritionFacts.trans_fat)}g
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cholesterol */}
      {nutritionFacts.cholesterol !== undefined && (
        <div className="border-b border-black dark:border-gray-700 py-1">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-bold text-black dark:text-white">
              <span className="font-bold">Cholesterol </span>
              <span className="font-normal">{formatValue(nutritionFacts.cholesterol)}mg</span>
            </p>
            <p className="text-sm font-bold text-black dark:text-white">
              {calculateDV(nutritionFacts.cholesterol, dailyValues.cholesterol)}
            </p>
          </div>
        </div>
      )}

      {/* Sodium */}
      {nutritionFacts.sodium !== undefined && (
        <div className="border-b border-black dark:border-gray-700 py-1">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-bold text-black dark:text-white">
              <span className="font-bold">Sodium </span>
              <span className="font-normal">{formatSodium(nutritionFacts.sodium)}</span>
            </p>
            <p className="text-sm font-bold text-black dark:text-white">
              {calculateDV((nutritionFacts.sodium || 0) * 1000, dailyValues.sodium)}
            </p>
          </div>
        </div>
      )}

      {/* Total Carbohydrate */}
      {nutritionFacts.total_carbohydrate !== undefined && (
        <div className="border-b border-black dark:border-gray-700 py-1">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-bold text-black dark:text-white">
              <span className="font-bold">Total Carbohydrate </span>
              <span className="font-normal">{formatValue(nutritionFacts.total_carbohydrate)}g</span>
            </p>
            <p className="text-sm font-bold text-black dark:text-white">
              {calculateDV(nutritionFacts.total_carbohydrate, dailyValues.total_carbohydrate)}
            </p>
          </div>

          {/* Dietary Fiber (indented) */}
          {nutritionFacts.dietary_fiber !== undefined && (
            <div className="flex justify-between items-baseline ml-4 mt-1">
              <p className="text-sm text-black dark:text-gray-200">
                Dietary Fiber {formatValue(nutritionFacts.dietary_fiber)}g
              </p>
              <p className="text-sm font-bold text-black dark:text-white">
                {calculateDV(nutritionFacts.dietary_fiber, dailyValues.dietary_fiber)}
              </p>
            </div>
          )}

          {/* Total Sugars (indented) */}
          {nutritionFacts.total_sugars !== undefined && (
            <div className="ml-4 mt-1">
              <div className="flex justify-between items-baseline">
                <p className="text-sm text-black dark:text-gray-200">
                  Total Sugars {formatValue(nutritionFacts.total_sugars)}g
                </p>
              </div>

              {/* Added Sugars (double indented) */}
              {nutritionFacts.added_sugars !== undefined && (
                <div className="flex justify-between items-baseline ml-4 mt-1">
                  <p className="text-sm text-black dark:text-gray-200">
                    Includes {formatValue(nutritionFacts.added_sugars)}g Added Sugars
                  </p>
                  <p className="text-sm font-bold text-black dark:text-white">
                    {calculateDV(nutritionFacts.added_sugars, dailyValues.added_sugars)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Protein */}
      {nutritionFacts.protein !== undefined && (
        <div className="border-b-8 border-black dark:border-gray-200 py-1">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-bold text-black dark:text-white">
              <span className="font-bold">Protein </span>
              <span className="font-normal">{formatValue(nutritionFacts.protein)}g</span>
            </p>
          </div>
        </div>
      )}

      {/* Vitamins and Minerals */}
      {(nutritionFacts.vitamin_d || nutritionFacts.calcium || nutritionFacts.iron || nutritionFacts.potassium) && (
        <div className="py-2 space-y-1">
          {nutritionFacts.vitamin_d !== undefined && (
            <div className="flex justify-between items-baseline border-b border-gray-300 dark:border-gray-700 pb-1">
              <p className="text-sm text-black dark:text-gray-200">Vitamin D {formatValue(nutritionFacts.vitamin_d)}mcg</p>
              <p className="text-sm text-black dark:text-gray-200">
                {calculateDV(nutritionFacts.vitamin_d, dailyValues.vitamin_d)}
              </p>
            </div>
          )}
          {nutritionFacts.calcium !== undefined && (
            <div className="flex justify-between items-baseline border-b border-gray-300 dark:border-gray-700 pb-1">
              <p className="text-sm text-black dark:text-gray-200">Calcium {formatValue(nutritionFacts.calcium)}mg</p>
              <p className="text-sm text-black dark:text-gray-200">
                {calculateDV(nutritionFacts.calcium, dailyValues.calcium)}
              </p>
            </div>
          )}
          {nutritionFacts.iron !== undefined && (
            <div className="flex justify-between items-baseline border-b border-gray-300 dark:border-gray-700 pb-1">
              <p className="text-sm text-black dark:text-gray-200">Iron {formatValue(nutritionFacts.iron)}mg</p>
              <p className="text-sm text-black dark:text-gray-200">
                {calculateDV(nutritionFacts.iron, dailyValues.iron)}
              </p>
            </div>
          )}
          {nutritionFacts.potassium !== undefined && (
            <div className="flex justify-between items-baseline border-b border-gray-300 dark:border-gray-700 pb-1">
              <p className="text-sm text-black dark:text-gray-200">Potassium {formatValue(nutritionFacts.potassium)}mg</p>
              <p className="text-sm text-black dark:text-gray-200">
                {calculateDV(nutritionFacts.potassium, dailyValues.potassium)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t-4 border-black dark:border-gray-200 pt-2 mt-1">
        <p className="text-xs text-black dark:text-gray-200">
          * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.
        </p>
      </div>
    </div>
  )
}
