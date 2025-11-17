import { apiClient } from './api';

export interface SetupStatusResponse {
  setup_complete: boolean;
  message: string;
}

export interface InitialSetupRequest {
  admin_email: string;
  admin_username: string;
  admin_password: string;
  household_name: string;
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
