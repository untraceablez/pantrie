import { apiClient } from './api'

export interface User {
  id: number
  email: string
  username: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  is_active: boolean
  is_verified: boolean
  oauth_provider: string | null
  created_at: string
  updated_at: string
}

export interface UpdateUserData {
  username?: string
  email?: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

export interface PasswordChangeData {
  current_password: string
  new_password: string
}

export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/users/me')
  return response.data
}

export const updateCurrentUser = async (data: UpdateUserData): Promise<User> => {
  const response = await apiClient.put<User>('/users/me', data)
  return response.data
}

export const changePassword = async (data: PasswordChangeData): Promise<void> => {
  await apiClient.post('/users/me/password', data)
}

export const uploadAvatar = async (file: File): Promise<{ avatar_url: string }> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<{ avatar_url: string }>(
    '/users/me/avatar',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}
