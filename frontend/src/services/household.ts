import { apiClient } from './api'

export interface Household {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface HouseholdWithRole extends Household {
  user_role: 'admin' | 'editor' | 'viewer'
}

export interface CreateHouseholdData {
  name: string
  description?: string | null
}

export interface UpdateHouseholdData {
  name?: string
  description?: string | null
}

export const createHousehold = async (data: CreateHouseholdData): Promise<Household> => {
  const response = await apiClient.post<Household>('/households', data)
  return response.data
}

export const listHouseholds = async (): Promise<HouseholdWithRole[]> => {
  const response = await apiClient.get<HouseholdWithRole[]>('/households')
  return response.data
}

export const getHousehold = async (householdId: number): Promise<HouseholdWithRole> => {
  const response = await apiClient.get<HouseholdWithRole>(`/households/${householdId}`)
  return response.data
}

export const updateHousehold = async (
  householdId: number,
  data: UpdateHouseholdData
): Promise<Household> => {
  const response = await apiClient.put<Household>(`/households/${householdId}`, data)
  return response.data
}

export const deleteHousehold = async (householdId: number): Promise<void> => {
  await apiClient.delete(`/households/${householdId}`)
}
