import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

// API base URL from environment or use relative path for nginx proxying
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api/v1` : '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth state and redirect to login
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export { apiClient }
export type { AxiosError }

// ---------------------------------------------------------------------------
// Dashboard summary (issue #72)
// ---------------------------------------------------------------------------

export interface DashboardCounts {
  total_items: number
  expired: number
  expiring_soon: number
  low_stock: number
  no_expiration_date: number
}

export interface DashboardLocationBreakdown {
  location_id: number | null
  name: string
  icon: string | null
  item_count: number
}

export interface DashboardCategoryBreakdown {
  category_id: number | null
  name: string
  icon: string | null
  item_count: number
}

export interface DashboardRecentItem {
  id: number
  name: string
  brand: string | null
  /** Pydantic serialises Decimal as a JSON string (e.g. "2.00") */
  quantity: string
  unit: string | null
  expiration_date: string | null
  created_at: string
}

export interface DashboardSummary {
  household_id: number
  generated_on: string
  expiring_within_days: number
  /** Pydantic serialises Decimal as a JSON string (e.g. "1") */
  low_stock_threshold: string
  counts: DashboardCounts
  by_location: DashboardLocationBreakdown[]
  by_category: DashboardCategoryBreakdown[]
  recently_added: DashboardRecentItem[]
}

export interface DashboardSummaryParams {
  expiring_within_days?: number
  low_stock_threshold?: number
  recent_limit?: number
}

export const getDashboardSummary = async (
  householdId: number,
  params?: DashboardSummaryParams
): Promise<DashboardSummary> => {
  const response = await apiClient.get<DashboardSummary>(
    `/dashboard/households/${householdId}/summary`,
    { params }
  )
  return response.data
}
