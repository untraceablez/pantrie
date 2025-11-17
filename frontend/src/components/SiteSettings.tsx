import { useState, useEffect } from 'react'
import { siteSettingsService, SMTPSettings, SMTPSettingsUpdate } from '@/services/siteSettings'

export default function SiteSettings() {
  const [settings, setSettings] = useState<SMTPSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'Pantrie',
    smtp_use_tls: true,
    require_email_confirmation: true,
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await siteSettingsService.getSMTPSettings()
      setSettings(data)

      // Update form with loaded data
      setFormData({
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_password: '', // Never populate password
        smtp_from_email: data.smtp_from_email || '',
        smtp_from_name: data.smtp_from_name || 'Pantrie',
        smtp_use_tls: data.smtp_use_tls,
        require_email_confirmation: data.require_email_confirmation,
      })
    } catch (err: any) {
      setError('Failed to load SMTP settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.smtp_host || !formData.smtp_from_email) {
      setError('SMTP host and from email are required')
      return
    }

    try {
      setSaving(true)

      const updateData: SMTPSettingsUpdate = {
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_user: formData.smtp_user || undefined,
        smtp_password: formData.smtp_password || undefined,
        smtp_from_email: formData.smtp_from_email,
        smtp_from_name: formData.smtp_from_name,
        smtp_use_tls: formData.smtp_use_tls,
        require_email_confirmation: formData.require_email_confirmation,
      }

      await siteSettingsService.updateSMTPSettings(updateData)
      setSuccess('SMTP settings updated successfully')
      setFormData(prev => ({ ...prev, smtp_password: '' })) // Clear password field
      await loadSettings()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update SMTP settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">SMTP Settings</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Configure email delivery settings for user registration confirmations and notifications.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="smtp_host" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              SMTP Host *
            </label>
            <input
              type="text"
              id="smtp_host"
              value={formData.smtp_host}
              onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="smtp.gmail.com"
              required
            />
          </div>

          <div>
            <label htmlFor="smtp_port" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              SMTP Port *
            </label>
            <input
              type="number"
              id="smtp_port"
              value={formData.smtp_port}
              onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="smtp_user" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              SMTP Username
            </label>
            <input
              type="text"
              id="smtp_user"
              value={formData.smtp_user}
              onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Optional"
            />
          </div>

          <div>
            <label htmlFor="smtp_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              SMTP Password
            </label>
            <input
              type="password"
              id="smtp_password"
              value={formData.smtp_password}
              onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Leave blank to keep current password"
            />
          </div>

          <div>
            <label htmlFor="smtp_from_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              From Email *
            </label>
            <input
              type="email"
              id="smtp_from_email"
              value={formData.smtp_from_email}
              onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="noreply@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="smtp_from_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              From Name
            </label>
            <input
              type="text"
              id="smtp_from_name"
              value={formData.smtp_from_name}
              onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="smtp_use_tls"
              checked={formData.smtp_use_tls}
              onChange={(e) => setFormData({ ...formData, smtp_use_tls: e.target.checked })}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="smtp_use_tls" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Use TLS encryption
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="require_email_confirmation"
              checked={formData.require_email_confirmation}
              onChange={(e) => setFormData({ ...formData, require_email_confirmation: e.target.checked })}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="require_email_confirmation" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Require email confirmation for new users
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
