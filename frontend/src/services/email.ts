import { apiClient } from './api'

interface ConfirmEmailResponse {
  message: string
  success: boolean
}

interface VerifyTokenResponse {
  valid: boolean
  message?: string
  user?: {
    username: string
    email: string
  }
}

export const emailService = {
  /**
   * Confirm an email address using a confirmation token
   */
  async confirmEmail(token: string): Promise<ConfirmEmailResponse> {
    const response = await apiClient.post<ConfirmEmailResponse>('/email/confirm', { token })
    return response.data
  },

  /**
   * Verify if a confirmation token is valid (without confirming it)
   */
  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    const response = await apiClient.get<VerifyTokenResponse>(`/email/verify-token/${token}`)
    return response.data
  },
}
