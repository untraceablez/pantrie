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
  nutrition_facts: Record<string, string | number> | null
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
  /** Which database this came from, e.g. 'off' or 'usda'. */
  source: string
  source_label: string
  /** Barcode for the Open Food Facts family, FDC id for USDA. */
  id: string
  /** Null for generic USDA foods, which carry no barcode. */
  barcode: string | null
  name: string
  brand: string | null
  image_url: string | null
}

export interface ProductSearchGroup {
  source: string
  label: string
  results: ProductSuggestion[]
  search_url: string
}

export interface ProductSearchResult {
  /** One group per source that returned hits, in source order. */
  groups: ProductSearchGroup[]
  /** Flattened view kept for backwards compatibility. */
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

/**
 * Look up a suggestion's full details in the source it came from. USDA foods
 * are keyed by FDC id rather than barcode, so the source has to travel with it.
 */
export const lookupProduct = async (
  source: string,
  id: string
): Promise<ProductInfo> => {
  const response = await apiClient.get<ProductInfo>('/barcode/product', {
    params: { source, id },
  })
  return response.data
}
