import { useState } from 'react';
import { setupService } from '../services/setupService';

type SetupStep = 'admin' | 'smtp' | 'notifications' | 'oauth';
type OAuthProvider = 'none' | 'google' | 'authentik';

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState<SetupStep>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adminData, setAdminData] = useState({
    admin_email: '',
    admin_username: '',
    admin_password: '',
    confirm_password: '',
    household_name: '',
  });

  const [smtpData, setSmtpData] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'Pantrie',
    smtp_use_tls: true,
  });

  const [notificationData, setNotificationData] = useState({
    email_notifications_enabled: false,
    notify_expiring_items: true,
    notify_low_stock: true,
    notify_new_member: true,
    expiry_warning_days: 7,
  });

  const [skipSMTP, setSkipSMTP] = useState(false);
  const [skipNotifications, setSkipNotifications] = useState(false);

  const [oauthProvider, setOAuthProvider] = useState<OAuthProvider>('none');
  const [oauthData, setOAuthData] = useState({
    google_client_id: '',
    google_client_secret: '',
    authentik_client_id: '',
    authentik_client_secret: '',
    authentik_base_url: '',
    authentik_slug: '',
  });

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (error) setError(null);
  };

  const handleSMTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSmtpData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
    if (error) setError(null);
  };

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setNotificationData((prev) => ({
      ...prev,
      [e.target.name]: e.target.type === 'number' ? parseInt(value as string) || 7 : value,
    }));
    if (error) setError(null);
  };

  const handleOAuthChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'oauth_provider') {
      setOAuthProvider(e.target.value as OAuthProvider);
    } else {
      setOAuthData((prev) => ({
        ...prev,
        [e.target.name]: e.target.value,
      }));
    }
    if (error) setError(null);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (adminData.admin_password !== adminData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (adminData.admin_password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(adminData.admin_password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(adminData.admin_password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(adminData.admin_password)) {
      setError('Password must contain at least one number');
      return;
    }

    // Move to SMTP step
    setCurrentStep('smtp');
  };

  const handleSMTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Move to notifications step
    setCurrentStep('notifications');
  };

  const handleSkipSMTP = () => {
    setSkipSMTP(true);
    setCurrentStep('notifications');
  };

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Move to OAuth step
    setCurrentStep('oauth');
  };

  const handleSkipNotifications = () => {
    setSkipNotifications(true);
    setCurrentStep('oauth');
  };

  const handleOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const setupData: any = {
        admin_email: adminData.admin_email,
        admin_username: adminData.admin_username,
        admin_password: adminData.admin_password,
        household_name: adminData.household_name,
      };

      // Only include SMTP config if not skipped and has required fields
      if (!skipSMTP && smtpData.smtp_host && smtpData.smtp_from_email) {
        setupData.smtp_config = {
          smtp_host: smtpData.smtp_host,
          smtp_port: parseInt(smtpData.smtp_port),
          smtp_user: smtpData.smtp_user || undefined,
          smtp_password: smtpData.smtp_password || undefined,
          smtp_from_email: smtpData.smtp_from_email,
          smtp_from_name: smtpData.smtp_from_name,
          smtp_use_tls: smtpData.smtp_use_tls,
        };
      }

      // Only include notification config if not skipped
      if (!skipNotifications) {
        setupData.notification_config = {
          email_notifications_enabled: notificationData.email_notifications_enabled,
          notify_expiring_items: notificationData.notify_expiring_items,
          notify_low_stock: notificationData.notify_low_stock,
          notify_new_member: notificationData.notify_new_member,
          expiry_warning_days: notificationData.expiry_warning_days,
        };
      }

      // Include OAuth config based on selected provider
      if (oauthProvider === 'google' && oauthData.google_client_id && oauthData.google_client_secret) {
        setupData.oauth_config = {
          google_client_id: oauthData.google_client_id,
          google_client_secret: oauthData.google_client_secret,
        };
      } else if (
        oauthProvider === 'authentik' &&
        oauthData.authentik_client_id &&
        oauthData.authentik_client_secret &&
        oauthData.authentik_base_url &&
        oauthData.authentik_slug
      ) {
        setupData.oauth_config = {
          authentik_client_id: oauthData.authentik_client_id,
          authentik_client_secret: oauthData.authentik_client_secret,
          authentik_base_url: oauthData.authentik_base_url,
          authentik_slug: oauthData.authentik_slug,
        };
      }

      const result = await setupService.performInitialSetup(setupData);

      console.log('Setup successful:', result);

      // Redirect to login
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.details?.[0]?.msg ||
          'Failed to complete setup. Please try again.'
      );
      setLoading(false);
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'admin':
        return "Let's get started by setting up your administrator account";
      case 'smtp':
        return 'Configure email settings for user invitations (optional)';
      case 'notifications':
        return 'Configure notification preferences (optional)';
      case 'oauth':
        return 'Configure OAuth authentication (optional)';
    }
  };

  const getStepNumber = (step: SetupStep): number => {
    switch (step) {
      case 'admin':
        return 1;
      case 'smtp':
        return 2;
      case 'notifications':
        return 3;
      case 'oauth':
        return 4;
    }
  };

  const isStepComplete = (step: SetupStep): boolean => {
    const currentStepNumber = getStepNumber(currentStep);
    const checkStepNumber = getStepNumber(step);
    return checkStepNumber < currentStepNumber;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="max-w-md w-full">
        <div className="bg-white/95 dark:bg-gray-800/95 shadow-2xl rounded-2xl p-8 backdrop-blur-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <img
                src="/pantrie-logo-dark.png"
                alt="Pantrie Logo"
                className="h-16 mx-auto dark:hidden"
              />
              <img
                src="/pantrie-logo-light.png"
                alt="Pantrie Logo"
                className="h-16 mx-auto hidden dark:block"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to Pantrie
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{getStepDescription()}</p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-2">
              {/* Step 1 */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === 'admin'
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-500 text-white'
                }`}
              >
                {isStepComplete('admin') ? '✓' : '1'}
              </div>
              <div
                className={`w-6 h-1 ${
                  isStepComplete('admin') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              ></div>
              {/* Step 2 */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === 'smtp'
                    ? 'bg-blue-600 text-white'
                    : isStepComplete('smtp')
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {isStepComplete('smtp') ? '✓' : '2'}
              </div>
              <div
                className={`w-6 h-1 ${
                  isStepComplete('smtp') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              ></div>
              {/* Step 3 */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === 'notifications'
                    ? 'bg-blue-600 text-white'
                    : isStepComplete('notifications')
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {isStepComplete('notifications') ? '✓' : '3'}
              </div>
              <div
                className={`w-6 h-1 ${
                  isStepComplete('notifications') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              ></div>
              {/* Step 4 */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === 'oauth'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                4
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Admin Account */}
          {currentStep === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-6">
              {/* Admin Email */}
              <div>
                <label
                  htmlFor="admin_email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Administrator Email
                </label>
                <input
                  type="email"
                  id="admin_email"
                  name="admin_email"
                  value={adminData.admin_email}
                  onChange={handleAdminChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="admin@example.com"
                />
              </div>

              {/* Admin Username */}
              <div>
                <label
                  htmlFor="admin_username"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Administrator Username
                </label>
                <input
                  type="text"
                  id="admin_username"
                  name="admin_username"
                  value={adminData.admin_username}
                  onChange={handleAdminChange}
                  required
                  minLength={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="admin"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="admin_password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="admin_password"
                  name="admin_password"
                  value={adminData.admin_password}
                  onChange={handleAdminChange}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="••••••••"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Must be at least 8 characters with uppercase, lowercase, and numbers
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm_password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={adminData.confirm_password}
                  onChange={handleAdminChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              {/* Household Name */}
              <div>
                <label
                  htmlFor="household_name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Household Name
                </label>
                <input
                  type="text"
                  id="household_name"
                  name="household_name"
                  value={adminData.household_name}
                  onChange={handleAdminChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Smith Family"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This will be the name of your first household
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Continue to Email Setup
              </button>
            </form>
          )}

          {/* Step 2: SMTP Configuration */}
          {currentStep === 'smtp' && (
            <form id="smtp-form" onSubmit={handleSMTPSubmit} className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Configure SMTP to enable email confirmations for new users. You can skip this step
                  and configure it later in the settings.
                </p>
              </div>

              {/* SMTP Host */}
              <div>
                <label
                  htmlFor="smtp_host"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  SMTP Host
                </label>
                <input
                  type="text"
                  id="smtp_host"
                  name="smtp_host"
                  value={smtpData.smtp_host}
                  onChange={handleSMTPChange}
                  disabled={skipSMTP}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="smtp.gmail.com"
                />
              </div>

              {/* SMTP Port */}
              <div>
                <label
                  htmlFor="smtp_port"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  SMTP Port
                </label>
                <input
                  type="number"
                  id="smtp_port"
                  name="smtp_port"
                  value={smtpData.smtp_port}
                  onChange={handleSMTPChange}
                  disabled={skipSMTP}
                  min="1"
                  max="65535"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="587"
                />
              </div>

              {/* SMTP User */}
              <div>
                <label
                  htmlFor="smtp_user"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  SMTP Username (optional)
                </label>
                <input
                  type="text"
                  id="smtp_user"
                  name="smtp_user"
                  value={smtpData.smtp_user}
                  onChange={handleSMTPChange}
                  disabled={skipSMTP}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="username@example.com"
                />
              </div>

              {/* SMTP Password */}
              <div>
                <label
                  htmlFor="smtp_password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  SMTP Password (optional)
                </label>
                <input
                  type="password"
                  id="smtp_password"
                  name="smtp_password"
                  value={smtpData.smtp_password}
                  onChange={handleSMTPChange}
                  disabled={skipSMTP}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>

              {/* From Email */}
              <div>
                <label
                  htmlFor="smtp_from_email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  From Email Address
                </label>
                <input
                  type="email"
                  id="smtp_from_email"
                  name="smtp_from_email"
                  value={smtpData.smtp_from_email}
                  onChange={handleSMTPChange}
                  disabled={skipSMTP}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="noreply@pantrie.app"
                />
              </div>

              {/* From Name */}
              <div>
                <label
                  htmlFor="smtp_from_name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  From Name
                </label>
                <input
                  type="text"
                  id="smtp_from_name"
                  name="smtp_from_name"
                  value={smtpData.smtp_from_name}
                  onChange={handleSMTPChange}
                  disabled={skipSMTP}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="Pantrie"
                />
              </div>

              {/* Use TLS */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="smtp_use_tls"
                  name="smtp_use_tls"
                  checked={smtpData.smtp_use_tls}
                  onChange={handleSMTPChange}
                  disabled={skipSMTP}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <label
                  htmlFor="smtp_use_tls"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Use TLS encryption (recommended)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('admin')}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSkipSMTP}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={loading || !smtpData.smtp_host}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Notifications Configuration */}
          {currentStep === 'notifications' && (
            <form id="notifications-form" onSubmit={handleNotificationsSubmit} className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Configure notification preferences for expiring items, low stock alerts, and more.
                  {skipSMTP && ' Note: Email notifications require SMTP to be configured first.'}
                </p>
              </div>

              {/* Enable Email Notifications */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Enable Email Notifications
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Send email alerts for enabled events
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="email_notifications_enabled"
                  name="email_notifications_enabled"
                  checked={notificationData.email_notifications_enabled}
                  onChange={handleNotificationChange}
                  disabled={skipSMTP}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
              </div>

              {/* Notification Types */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Notification Events
                </h4>

                {/* Expiring Items */}
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Expiring Items
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Notify when items are about to expire
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="notify_expiring_items"
                    name="notify_expiring_items"
                    checked={notificationData.notify_expiring_items}
                    onChange={handleNotificationChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                {/* Expiry Warning Days */}
                {notificationData.notify_expiring_items && (
                  <div className="pl-4 py-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Days before expiry to send warning
                    </label>
                    <input
                      type="number"
                      id="expiry_warning_days"
                      name="expiry_warning_days"
                      min="1"
                      max="30"
                      value={notificationData.expiry_warning_days}
                      onChange={handleNotificationChange}
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Low Stock */}
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Low Stock Alerts
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Notify when items are running low
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="notify_low_stock"
                    name="notify_low_stock"
                    checked={notificationData.notify_low_stock}
                    onChange={handleNotificationChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                {/* New Member */}
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      New Household Members
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Notify when new members join a household
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="notify_new_member"
                    name="notify_new_member"
                    checked={notificationData.notify_new_member}
                    onChange={handleNotificationChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('smtp')}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSkipNotifications}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* Step 4: OAuth Configuration */}
          {currentStep === 'oauth' && (
            <form onSubmit={handleOAuthSubmit} className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Configure OAuth to allow users to sign in with Google or Authentik. This is optional and can be
                  configured later in the settings.
                </p>
              </div>

              {/* OAuth Provider Selection */}
              <div>
                <label
                  htmlFor="oauth_provider"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Authentication Method
                </label>
                <select
                  id="oauth_provider"
                  name="oauth_provider"
                  value={oauthProvider}
                  onChange={handleOAuthChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="none">Local Authentication Only</option>
                  <option value="google">Google OAuth</option>
                  <option value="authentik">Authentik OAuth</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Choose how users will authenticate with Pantrie
                </p>
              </div>

              {/* Google OAuth Fields */}
              {oauthProvider === 'google' && (
                <>
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      To configure Google OAuth, you'll need to create OAuth 2.0 credentials in the{' '}
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline hover:no-underline"
                      >
                        Google Cloud Console
                      </a>
                      . Follow{' '}
                      <a
                        href="https://support.google.com/cloud/answer/6158849?hl=en"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline hover:no-underline"
                      >
                        Google's OAuth 2.0 setup guide
                      </a>
                      .
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="google_client_id"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Google Client ID
                    </label>
                    <input
                      type="text"
                      id="google_client_id"
                      name="google_client_id"
                      value={oauthData.google_client_id}
                      onChange={handleOAuthChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="123456789-abc123.apps.googleusercontent.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="google_client_secret"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Google Client Secret
                    </label>
                    <input
                      type="password"
                      id="google_client_secret"
                      name="google_client_secret"
                      value={oauthData.google_client_secret}
                      onChange={handleOAuthChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="GOCSPX-••••••••"
                    />
                  </div>
                </>
              )}

              {/* Authentik OAuth Fields */}
              {oauthProvider === 'authentik' && (
                <>
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      To configure Authentik OAuth, follow our{' '}
                      <a
                        href="/docs/deployment/authentik-oauth"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline hover:no-underline"
                      >
                        Authentik OAuth setup guide
                      </a>
                      .
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="authentik_base_url"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Authentik Base URL
                    </label>
                    <input
                      type="url"
                      id="authentik_base_url"
                      name="authentik_base_url"
                      value={oauthData.authentik_base_url}
                      onChange={handleOAuthChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="https://auth.example.com"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      The URL of your Authentik instance
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="authentik_slug"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Application Slug
                    </label>
                    <input
                      type="text"
                      id="authentik_slug"
                      name="authentik_slug"
                      value={oauthData.authentik_slug}
                      onChange={handleOAuthChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="pantrie"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      The application slug from your Authentik application settings
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="authentik_client_id"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Authentik Client ID
                    </label>
                    <input
                      type="text"
                      id="authentik_client_id"
                      name="authentik_client_id"
                      value={oauthData.authentik_client_id}
                      onChange={handleOAuthChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="pantrie"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="authentik_client_secret"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Authentik Client Secret
                    </label>
                    <input
                      type="password"
                      id="authentik_client_secret"
                      name="authentik_client_secret"
                      value={oauthData.authentik_client_secret}
                      onChange={handleOAuthChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>
                </>
              )}

              {/* Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('notifications')}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Setting up...' : 'Complete Setup'}
                </button>
              </div>
            </form>
          )}

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {currentStep === 'admin'
                ? 'This setup will create your administrator account and first household.'
                : currentStep === 'smtp'
                ? 'Email settings can be changed later in the administration settings.'
                : currentStep === 'notifications'
                ? 'Notification settings can be changed later in the settings menu.'
                : 'OAuth settings can be changed later in the administration settings.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
