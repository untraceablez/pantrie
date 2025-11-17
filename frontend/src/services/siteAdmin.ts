import { apiClient } from './api'

// User Management Types
export interface UserListItem {
  id: number
  email: string
  username: string
  is_active: boolean
  is_verified: boolean
  site_role: string
  created_at: string
  household_count: number
}

export interface UserDetail {
  id: number
  email: string
  username: string
  first_name: string | null
  last_name: string | null
  is_active: boolean
  is_verified: boolean
  site_role: string
  created_at: string
  updated_at: string
}

export interface UserCreateData {
  email: string
  username: string
  password: string
  first_name?: string
  last_name?: string
  is_verified?: boolean
  site_role?: string
}

export interface UserUpdateData {
  email?: string
  username?: string
  first_name?: string
  last_name?: string
  is_active?: boolean
  is_verified?: boolean
  site_role?: string
  password?: string
}

// Household Management Types
export interface HouseholdListItem {
  id: number
  name: string
  created_at: string
  member_count: number
}

export interface HouseholdDetail {
  id: number
  name: string
  created_at: string
  updated_at: string
  members: Array<{
    user_id: number
    username: string
    email: string
    role: string
  }>
}

export interface HouseholdCreateData {
  name: string
  admin_user_id: number
}

export interface HouseholdUpdateData {
  name?: string
}

export const siteAdminService = {
  // User Management
  async listUsers(): Promise<UserListItem[]> {
    const response = await apiClient.get<UserListItem[]>('/site-admin/users')
    return response.data
  },

  async getUser(userId: number): Promise<UserDetail> {
    const response = await apiClient.get<UserDetail>(`/site-admin/users/${userId}`)
    return response.data
  },

  async createUser(data: UserCreateData): Promise<UserDetail> {
    const response = await apiClient.post<UserDetail>('/site-admin/users', data)
    return response.data
  },

  async updateUser(userId: number, data: UserUpdateData): Promise<UserDetail> {
    const response = await apiClient.put<UserDetail>(`/site-admin/users/${userId}`, data)
    return response.data
  },

  async deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/site-admin/users/${userId}`)
  },

  // Household Management
  async listHouseholds(): Promise<HouseholdListItem[]> {
    const response = await apiClient.get<HouseholdListItem[]>('/site-admin/households')
    return response.data
  },

  async getHousehold(householdId: number): Promise<HouseholdDetail> {
    const response = await apiClient.get<HouseholdDetail>(`/site-admin/households/${householdId}`)
    return response.data
  },

  async createHousehold(data: HouseholdCreateData): Promise<HouseholdDetail> {
    const response = await apiClient.post<HouseholdDetail>('/site-admin/households', data)
    return response.data
  },

  async updateHousehold(householdId: number, data: HouseholdUpdateData): Promise<HouseholdDetail> {
    const response = await apiClient.put<HouseholdDetail>(`/site-admin/households/${householdId}`, data)
    return response.data
  },

  async deleteHousehold(householdId: number): Promise<void> {
    await apiClient.delete(`/site-admin/households/${householdId}`)
  },
}
