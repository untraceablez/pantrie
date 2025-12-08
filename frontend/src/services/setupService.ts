import { apiClient } from './api';

export interface SetupStatusResponse {
  setup_complete: boolean;
  message: string;
}

export interface SMTPConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_use_tls: boolean;
}

export interface NotificationConfig {
  email_notifications_enabled: boolean;
  notify_expiring_items: boolean;
  notify_low_stock: boolean;
  notify_new_member: boolean;
  expiry_warning_days: number;
}

export interface OAuthConfig {
  google_client_id?: string;
  google_client_secret?: string;
  authentik_client_id?: string;
  authentik_client_secret?: string;
  authentik_base_url?: string;
  authentik_slug?: string;
}

export interface InitialSetupRequest {
  admin_email: string;
  admin_username: string;
  admin_password: string;
  household_name: string;
  smtp_config?: SMTPConfig;
  notification_config?: NotificationConfig;
  oauth_config?: OAuthConfig;
}

export interface InitialSetupResponse {
  user: {
    id: number;
    email: string;
    username: string;
  };
  household: {
    id: number;
    name: string;
  };
  message: string;
}

export const setupService = {
  /**
   * Check if initial setup has been completed
   */
  async checkSetupStatus(): Promise<SetupStatusResponse> {
    const response = await apiClient.get<SetupStatusResponse>('/setup/status');
    return response.data;
  },

  /**
   * Perform initial application setup
   */
  async performInitialSetup(
    data: InitialSetupRequest
  ): Promise<InitialSetupResponse> {
    const response = await apiClient.post<InitialSetupResponse>(
      '/setup/initialize',
      data
    );
    return response.data;
  },
};
