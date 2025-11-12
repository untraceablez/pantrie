import { apiClient } from './api'

export interface ProductInfo {
  name: string
  description: string | null
  brand: string | null
  categories: string[]
  image_url: string | null
  quantity: string | null
  serving_size: string | null
  ingredients: string | null
  allergens: string | null
  nutrition_grade: string | null
  labels: string[]
  stores: string | null
  countries: string | null
  source: string
  source_url: string
}

export const lookupBarcode = async (barcode: string): Promise<ProductInfo> => {
  const response = await apiClient.get<ProductInfo>(`/barcode/${barcode}`)
  return response.data
}
