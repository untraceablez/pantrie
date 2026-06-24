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

export interface ProductSuggestion {
  barcode: string
  name: string
  brand: string | null
  image_url: string | null
}

export interface ProductSearchResult {
  results: ProductSuggestion[]
  search_url: string
}

export const searchProducts = async (
  query: string,
  limit = 3
): Promise<ProductSearchResult> => {
  const response = await apiClient.get<ProductSearchResult>('/barcode/search', {
    params: { q: query, limit },
  })
  return response.data
}
