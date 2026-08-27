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

// --- Allergen checking ---
//
// Matching lives on the server (src/services/allergen_service.py), which reuses
// the same normalised ingredient matcher as recipe makeability. Doing it here
// would be a second, weaker implementation that disagrees with the backend —
// the old client-side regex flagged "corn" for "cornstarch", for instance.

export interface InventoryAllergenMatch {
  item_id: number
  name: string
  allergens: string[]
}

export interface AllergenTextMatch {
  text: string
  allergens: string[]
}

/**
 * Allergen matches for every stored item in a household, in one request.
 *
 * Deliberately household-wide rather than per item: a list view can flag all of
 * its cards from a single call instead of one lookup per card. Items with no
 * match are omitted.
 */
export const getInventoryAllergenMatches = async (
  householdId: number
): Promise<InventoryAllergenMatch[]> => {
  const response = await apiClient.get<{ matches: InventoryAllergenMatch[] }>(
    `/households/${householdId}/allergens/inventory-matches`
  )
  return response.data.matches
}

/** Check free text (e.g. an add/edit form's ingredients field) for allergens. */
export const checkTextsForAllergens = async (
  householdId: number,
  texts: string[]
): Promise<AllergenTextMatch[]> => {
  const response = await apiClient.post<{ results: AllergenTextMatch[] }>(
    `/households/${householdId}/allergens/check`,
    { texts }
  )
  return response.data.results
}
