import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupService } from '../services/setupService';

export default function SetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    admin_email: '',
    admin_username: '',
    admin_password: '',
    confirm_password: '',
    household_name: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (formData.admin_password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.admin_password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(formData.admin_password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(formData.admin_password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(formData.admin_password)) {
      setError('Password must contain at least one number');
      return;
    }

    setLoading(true);

    try {
      const result = await setupService.performInitialSetup({
        admin_email: formData.admin_email,
        admin_username: formData.admin_username,
        admin_password: formData.admin_password,
        household_name: formData.household_name,
      });

      console.log('Setup successful:', result);

      // Show success message
      setSuccess(true);
      setLoading(false);

      // Wait a moment to show the success message, then redirect
      setTimeout(() => {
        console.log('Redirecting to login...');
        // Use window.location to force a full page reload and bypass any guards
        window.location.href = '/login';
      }, 2000);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-8">
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
              Let's get started by setting up your administrator account
            </p>
          </div>

          {/* Setup Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
                <p className="text-sm font-medium">Setup completed successfully! Redirecting to login...</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

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
                value={formData.admin_email}
                onChange={handleChange}
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
                value={formData.admin_username}
                onChange={handleChange}
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
                value={formData.admin_password}
                onChange={handleChange}
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
                value={formData.confirm_password}
                onChange={handleChange}
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
                value={formData.household_name}
                onChange={handleChange}
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
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This setup will create your administrator account and first household.
              You can invite additional members later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
