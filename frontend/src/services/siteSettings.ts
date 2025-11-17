import { apiClient } from './api'

export interface SMTPSettings {
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_from_email: string | null
  smtp_from_name: string | null
  smtp_use_tls: boolean
  require_email_confirmation: boolean
}

export interface SMTPSettingsUpdate {
  smtp_host: string
  smtp_port: number
  smtp_user?: string
  smtp_password?: string
  smtp_from_email: string
  smtp_from_name: string
  smtp_use_tls: boolean
  require_email_confirmation: boolean
}

export interface ProxySettings {
  proxy_mode: string
  external_proxy_url: string | null
  custom_domain: string | null
  use_https: boolean
}

export interface ProxySettingsUpdate {
  proxy_mode: string
  external_proxy_url?: string | null
  custom_domain?: string | null
  use_https: boolean
}

export const siteSettingsService = {
  async getSMTPSettings(): Promise<SMTPSettings> {
    const response = await apiClient.get<SMTPSettings>('/site-settings/smtp')
    return response.data
  },

  async updateSMTPSettings(settings: SMTPSettingsUpdate): Promise<SMTPSettings> {
    const response = await apiClient.put<SMTPSettings>('/site-settings/smtp', settings)
    return response.data
  },

  async getProxySettings(): Promise<ProxySettings> {
    const response = await apiClient.get<ProxySettings>('/site-settings/proxy')
    return response.data
  },

  async updateProxySettings(settings: ProxySettingsUpdate): Promise<ProxySettings> {
    const response = await apiClient.put<ProxySettings>('/site-settings/proxy', settings)
    return response.data
  },
}
