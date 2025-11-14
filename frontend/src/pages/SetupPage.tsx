import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupService } from '../services/setupService';

type SetupStep = 'admin' | 'smtp' | 'proxy';

export default function SetupPage() {
  const navigate = useNavigate();
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

  const [proxyData, setProxyData] = useState({
    proxy_mode: 'none',
    external_proxy_url: '',
    custom_domain: '',
    use_https: true,
  });

  const [skipSMTP, setSkipSMTP] = useState(false);

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

  const handleProxyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setProxyData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
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

    // Move to proxy step
    setCurrentStep('proxy');
  };

  const handleProxySubmit = async (e: React.FormEvent) => {
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

      // Include proxy config
      setupData.proxy_config = {
        proxy_mode: proxyData.proxy_mode,
        external_proxy_url: proxyData.external_proxy_url || undefined,
        custom_domain: proxyData.custom_domain || undefined,
        use_https: proxyData.use_https,
      };

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

  const handleSkipSMTP = () => {
    setSkipSMTP(true);
    // Create a form submit event to trigger the handleSMTPSubmit
    const form = document.getElementById('smtp-form') as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
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
            <p className="text-gray-600 dark:text-gray-400">
              {currentStep === 'admin'
                ? "Let's get started by setting up your administrator account"
                : currentStep === 'smtp'
                ? 'Configure email settings for user invitations (optional)'
                : 'Configure reverse proxy and domain settings (optional)'}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === 'admin'
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-500 text-white'
                }`}
              >
                {currentStep !== 'admin' ? '✓' : '1'}
              </div>
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600"></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === 'smtp'
                    ? 'bg-blue-600 text-white'
                    : currentStep === 'proxy'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {currentStep === 'proxy' ? '✓' : '2'}
              </div>
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600"></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep === 'proxy'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                3
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
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={!smtpData.smtp_host && !skipSMTP}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Proxy Settings
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Reverse Proxy Configuration */}
          {currentStep === 'proxy' && (
            <form onSubmit={handleProxySubmit} className="space-y-6">
              {/* Proxy Mode */}
              <div>
                <label
                  htmlFor="proxy_mode"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Reverse Proxy Mode
                </label>
                <select
                  id="proxy_mode"
                  name="proxy_mode"
                  value={proxyData.proxy_mode}
                  onChange={handleProxyChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="none">No Reverse Proxy (Direct Access)</option>
                  <option value="builtin">Built-in Nginx Proxy</option>
                  <option value="external">External Proxy (Cloudflare Tunnel, etc.)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Choose how you want to expose Pantrie to the internet
                </p>
              </div>

              {/* External Proxy URL - Only shown for external mode */}
              {proxyData.proxy_mode === 'external' && (
                <div>
                  <label
                    htmlFor="external_proxy_url"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    External Proxy Address (Optional)
                  </label>
                  <input
                    type="text"
                    id="external_proxy_url"
                    name="external_proxy_url"
                    value={proxyData.external_proxy_url}
                    onChange={handleProxyChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="http://10.0.0.248:5173"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    The internal address your proxy forwards to
                  </p>
                </div>
              )}

              {/* Custom Domain */}
              {proxyData.proxy_mode !== 'none' && (
                <div>
                  <label
                    htmlFor="custom_domain"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Custom Domain
                  </label>
                  <input
                    type="text"
                    id="custom_domain"
                    name="custom_domain"
                    value={proxyData.custom_domain}
                    onChange={handleProxyChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="pantrie.example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    The domain name you'll use to access Pantrie
                  </p>
                </div>
              )}

              {/* Use HTTPS */}
              {proxyData.proxy_mode !== 'none' && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="use_https"
                    name="use_https"
                    checked={proxyData.use_https}
                    onChange={handleProxyChange}
                    className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <label
                    htmlFor="use_https"
                    className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Use HTTPS (Recommended)
                  </label>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {proxyData.proxy_mode === 'none' && (
                    <>📌 Direct access mode - Pantrie will be accessible via IP:port</>
                  )}
                  {proxyData.proxy_mode === 'builtin' && (
                    <>🔧 Built-in nginx will be configured to serve both frontend and backend on port 80/443</>
                  )}
                  {proxyData.proxy_mode === 'external' && (
                    <>🌐 Configure your external proxy (Cloudflare Tunnel, nginx, etc.) to point to Pantrie</>
                  )}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('smtp')}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                : 'Proxy settings can be changed later in the administration settings.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
