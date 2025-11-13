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
  ingredients: string | null
  nutritional_info: string | null
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
  ingredients?: string | null
  nutritional_info?: string | null
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
  ingredients?: string | null
  nutritional_info?: string | null
}

export interface InventoryListParams {
  page?: number
  page_size?: number
  search?: string
  category_id?: number
  location_id?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface InventoryListResponse {
  items: InventoryItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
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

export const listInventory = async (
  householdId: number,
  params?: InventoryListParams
): Promise<InventoryListResponse> => {
  const response = await apiClient.get<InventoryListResponse>(
    `/inventory/households/${householdId}/list`,
    { params }
  )
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
