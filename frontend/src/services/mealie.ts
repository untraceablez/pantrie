import { apiClient } from './api'

export interface MealieConnection {
  id: number
  household_id: number
  base_url: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecipeMakeability {
  recipe_id: string
  name: string
  makeable: boolean
  total_ingredients: number
  available_ingredients: number
  missing: string[]
}

export interface ShoppingListPushItem {
  name: string
  added: boolean
  detail: string | null
}

export interface ShoppingListPushResult {
  requested: number
  added: number
  items: ShoppingListPushItem[]
}

const base = (householdId: number) => `/households/${householdId}/mealie`

// Returns null when no connection is configured (the API returns 404).
export const getMealieConnection = async (
  householdId: number
): Promise<MealieConnection | null> => {
  try {
    const response = await apiClient.get<MealieConnection>(`${base(householdId)}/connection`)
    return response.data
  } catch (err: any) {
    if (err?.response?.status === 404) return null
    throw err
  }
}

export const configureMealieConnection = async (
  householdId: number,
  data: { base_url: string; api_key: string }
): Promise<MealieConnection> => {
  const response = await apiClient.put<MealieConnection>(`${base(householdId)}/connection`, data)
  return response.data
}

export const deleteMealieConnection = async (householdId: number): Promise<void> => {
  await apiClient.delete(`${base(householdId)}/connection`)
}

export const getMealieRecipes = async (
  householdId: number
): Promise<{ recipes: RecipeMakeability[] }> => {
  const response = await apiClient.get<{ recipes: RecipeMakeability[] }>(`${base(householdId)}/recipes`)
  return response.data
}

export const pushToShoppingList = async (
  householdId: number,
  items: string[]
): Promise<ShoppingListPushResult> => {
  const response = await apiClient.post<ShoppingListPushResult>(`${base(householdId)}/shopping-list`, {
    items,
  })
  return response.data
}
