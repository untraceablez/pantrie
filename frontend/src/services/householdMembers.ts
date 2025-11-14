import { apiClient } from './api'

export interface HouseholdMember {
  id: number
  user_id: number
  username: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  joined_at: string
}

export interface AddMemberRequest {
  email: string
  role: 'admin' | 'editor' | 'viewer'
}

export interface UpdateMemberRoleRequest {
  role: 'admin' | 'editor' | 'viewer'
}

export const listHouseholdMembers = async (householdId: number): Promise<HouseholdMember[]> => {
  const response = await apiClient.get<HouseholdMember[]>(`/households/${householdId}/members`)
  return response.data
}

export const addHouseholdMember = async (
  householdId: number,
  data: AddMemberRequest
): Promise<HouseholdMember> => {
  const response = await apiClient.post<HouseholdMember>(
    `/households/${householdId}/members`,
    data
  )
  return response.data
}

export const updateMemberRole = async (
  householdId: number,
  membershipId: number,
  data: UpdateMemberRoleRequest
): Promise<HouseholdMember> => {
  const response = await apiClient.patch<HouseholdMember>(
    `/households/${householdId}/members/${membershipId}`,
    data
  )
  return response.data
}

export const removeMember = async (
  householdId: number,
  membershipId: number
): Promise<void> => {
  await apiClient.delete(`/households/${householdId}/members/${membershipId}`)
}
