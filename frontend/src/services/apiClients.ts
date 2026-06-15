import { apiClient } from './api'

export interface ApiClientPermissions {
  read: boolean
  write: boolean
  delete: boolean
}

export interface ApiClient {
  id: number
  name: string
  client_id: string
  permissions: ApiClientPermissions
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

// Returned only by create — includes the one-time plaintext secret.
export interface ApiClientCreated extends ApiClient {
  client_secret: string
}

export interface CreateApiClientData {
  name: string
  permissions?: Partial<ApiClientPermissions>
}

export const listApiClients = async (householdId: number): Promise<ApiClient[]> => {
  const response = await apiClient.get<ApiClient[]>(`/households/${householdId}/api-clients`)
  return response.data
}

export const createApiClient = async (
  householdId: number,
  data: CreateApiClientData
): Promise<ApiClientCreated> => {
  const response = await apiClient.post<ApiClientCreated>(
    `/households/${householdId}/api-clients`,
    data
  )
  return response.data
}

export const revokeApiClient = async (householdId: number, clientPk: number): Promise<void> => {
  await apiClient.delete(`/households/${householdId}/api-clients/${clientPk}`)
}
