import { apiClient } from './api'

export interface InventoryItem {
  id: number
  household_id: number
  category_id: number | null
  location_id: number | null
  added_by_user_id: number
  name: string
  description: string | null
  quantity: number
  unit: string | null
  purchase_date: string | null
  expiration_date: string | null
  barcode: string | null
  brand: string | null
  image_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateInventoryItemData {
  household_id: number
  name: string
  description?: string | null
  quantity: number
  unit?: string | null
  category_id?: number | null
  location_id?: number | null
  purchase_date?: string | null
  expiration_date?: string | null
  barcode?: string | null
  brand?: string | null
  image_url?: string | null
  notes?: string | null
}

export interface UpdateInventoryItemData {
  name?: string
  description?: string | null
  quantity?: number
  unit?: string | null
  category_id?: number | null
  location_id?: number | null
  purchase_date?: string | null
  expiration_date?: string | null
  barcode?: string | null
  brand?: string | null
  image_url?: string | null
  notes?: string | null
}

export const createItem = async (data: CreateInventoryItemData): Promise<InventoryItem> => {
  const response = await apiClient.post<InventoryItem>('/inventory', data)
  return response.data
}

export const getItem = async (itemId: number): Promise<InventoryItem> => {
  const response = await apiClient.get<InventoryItem>(`/inventory/${itemId}`)
  return response.data
}

export const listHouseholdItems = async (householdId: number): Promise<InventoryItem[]> => {
  const response = await apiClient.get<InventoryItem[]>(`/inventory/households/${householdId}`)
  return response.data
}

export const updateItem = async (
  itemId: number,
  data: UpdateInventoryItemData
): Promise<InventoryItem> => {
  const response = await apiClient.put<InventoryItem>(`/inventory/${itemId}`, data)
  return response.data
}

export const deleteItem = async (itemId: number): Promise<void> => {
  await apiClient.delete(`/inventory/${itemId}`)
}
