import { apiClient } from './api'

export interface Location {
  id: number
  household_id: number
  name: string
  description: string | null
  icon: string | null
  created_at: string
  updated_at: string
}

export interface CreateLocationData {
  household_id: number
  name: string
  description?: string | null
  icon?: string | null
}

export interface UpdateLocationData {
  name?: string
  description?: string | null
  icon?: string | null
}

export const createLocation = async (data: CreateLocationData): Promise<Location> => {
  const response = await apiClient.post<Location>('/locations', data)
  return response.data
}

export const getLocation = async (locationId: number): Promise<Location> => {
  const response = await apiClient.get<Location>(`/locations/${locationId}`)
  return response.data
}

export const listHouseholdLocations = async (householdId: number): Promise<Location[]> => {
  const response = await apiClient.get<Location[]>(`/locations/households/${householdId}`)
  return response.data
}

export const updateLocation = async (
  locationId: number,
  data: UpdateLocationData
): Promise<Location> => {
  const response = await apiClient.put<Location>(`/locations/${locationId}`, data)
  return response.data
}

export const deleteLocation = async (locationId: number): Promise<void> => {
  await apiClient.delete(`/locations/${locationId}`)
}
