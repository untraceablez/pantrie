import { apiClient } from './api'

export interface Allergen {
  id: number
  household_id: number
  name: string
  created_at: string
  updated_at: string
}

export interface CreateAllergenData {
  name: string
}

export const listHouseholdAllergens = async (householdId: number): Promise<Allergen[]> => {
  const response = await apiClient.get(`/households/${householdId}/allergens`)
  return response.data
}

export const createAllergen = async (householdId: number, data: CreateAllergenData): Promise<Allergen> => {
  const response = await apiClient.post(`/households/${householdId}/allergens`, data)
  return response.data
}

export const deleteAllergen = async (allergenId: number): Promise<void> => {
  await apiClient.delete(`/households/allergens/${allergenId}`)
}

/**
 * Check if ingredients contain any household allergens
 * @param ingredients - Ingredients text to check
 * @param allergens - List of household allergens
 * @returns Array of matched allergen names
 */
export const checkIngredientsForAllergens = (
  ingredients: string | null,
  allergens: Allergen[]
): string[] => {
  if (!ingredients || !allergens.length) {
    return []
  }

  const ingredientsLower = ingredients.toLowerCase()
  const matches: string[] = []

  for (const allergen of allergens) {
    // Check if allergen name appears in ingredients
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${allergen.name.toLowerCase()}\\b`, 'i')
    if (regex.test(ingredientsLower)) {
      matches.push(allergen.name)
    }
  }

  return matches
}
