import { apiClient } from './api'

export interface RegisterData {
  email: string
  username: string
  password: string
}

export interface LoginData {
  email: string
  password: string
}

export interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  is_verified: boolean
  oauth_provider: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export const register = async (data: RegisterData): Promise<User> => {
  const response = await apiClient.post<User>('/auth/register', data)
  return response.data
}

export const login = async (data: LoginData): Promise<AuthResponse> => {
  const tokenResponse = await apiClient.post<TokenResponse>('/auth/login', data)

  // Fetch user data after successful login
  const userResponse = await apiClient.get<User>('/auth/me', {
    headers: {
      Authorization: `Bearer ${tokenResponse.data.access_token}`,
    },
  })

  return {
    user: userResponse.data,
    ...tokenResponse.data,
  }
}

export const refreshToken = async (refreshToken: string): Promise<TokenResponse> => {
  const response = await apiClient.post<TokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  return response.data
}

export const logout = async (refreshToken: string): Promise<void> => {
  await apiClient.post('/auth/logout', { refresh_token: refreshToken })
}

export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/auth/me')
  return response.data
}
