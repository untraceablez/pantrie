import { apiClient } from './api'

export interface Staple {
  id: number
  household_id: number
  name: string
  created_at: string
  updated_at: string
}

export interface CreateStapleData {
  name: string
}

export const listHouseholdStaples = async (householdId: number): Promise<Staple[]> => {
  const response = await apiClient.get(`/households/${householdId}/staples`)
  return response.data
}

export const createStaple = async (householdId: number, data: CreateStapleData): Promise<Staple> => {
  const response = await apiClient.post(`/households/${householdId}/staples`, data)
  return response.data
}

export const deleteStaple = async (stapleId: number): Promise<void> => {
  await apiClient.delete(`/households/staples/${stapleId}`)
}
