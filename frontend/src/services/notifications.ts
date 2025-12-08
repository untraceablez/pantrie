import { apiClient } from './api'

// Email Notification Settings
export interface EmailNotificationSettings {
  email_notifications_enabled: boolean
  notify_expiring_items: boolean
  notify_low_stock: boolean
  notify_new_member: boolean
  expiry_warning_days: number
  smtp_configured: boolean
}

export interface EmailNotificationSettingsUpdate {
  email_notifications_enabled: boolean
  notify_expiring_items: boolean
  notify_low_stock: boolean
  notify_new_member: boolean
  expiry_warning_days: number
}

// Webhook types
export interface Webhook {
  id: number
  name: string
  url: string
  is_active: boolean
  event_types: string[]
  household_id: number | null
  created_by_id: number
}

export interface WebhookCreate {
  name: string
  url: string
  secret?: string
  event_types: string[]
  household_id?: number | null
}

export interface WebhookUpdate {
  name?: string
  url?: string
  secret?: string
  is_active?: boolean
  event_types?: string[]
}

export interface WebhookTestResult {
  success: boolean
  status_code?: number
  message: string
}

export const notificationService = {
  // Email notification settings
  async getEmailSettings(): Promise<EmailNotificationSettings> {
    const response = await apiClient.get<EmailNotificationSettings>('/notifications/email')
    return response.data
  },

  async updateEmailSettings(settings: EmailNotificationSettingsUpdate): Promise<EmailNotificationSettings> {
    const response = await apiClient.put<EmailNotificationSettings>('/notifications/email', settings)
    return response.data
  },

  // Webhook operations
  async listWebhooks(): Promise<Webhook[]> {
    const response = await apiClient.get<Webhook[]>('/notifications/webhooks')
    return response.data
  },

  async getWebhook(id: number): Promise<Webhook> {
    const response = await apiClient.get<Webhook>(`/notifications/webhooks/${id}`)
    return response.data
  },

  async createWebhook(webhook: WebhookCreate): Promise<Webhook> {
    const response = await apiClient.post<Webhook>('/notifications/webhooks', webhook)
    return response.data
  },

  async updateWebhook(id: number, webhook: WebhookUpdate): Promise<Webhook> {
    const response = await apiClient.put<Webhook>(`/notifications/webhooks/${id}`, webhook)
    return response.data
  },

  async deleteWebhook(id: number): Promise<void> {
    await apiClient.delete(`/notifications/webhooks/${id}`)
  },

  async testWebhook(id: number): Promise<WebhookTestResult> {
    const response = await apiClient.post<WebhookTestResult>(`/notifications/webhooks/${id}/test`)
    return response.data
  },
}
