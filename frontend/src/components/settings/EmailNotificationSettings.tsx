import { useState, useEffect } from 'react'
import {
  notificationService,
  EmailNotificationSettings as EmailNotificationSettingsType,
  EmailNotificationSettingsUpdate,
} from '@/services/notifications'

export default function EmailNotificationSettings() {
  const [settings, setSettings] = useState<EmailNotificationSettingsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await notificationService.getEmailSettings()
      setSettings(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load email notification settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const update: EmailNotificationSettingsUpdate = {
        email_notifications_enabled: settings.email_notifications_enabled,
        notify_expiring_items: settings.notify_expiring_items,
        notify_low_stock: settings.notify_low_stock,
        notify_new_member: settings.notify_new_member,
        expiry_warning_days: settings.expiry_warning_days,
      }

      const updated = await notificationService.updateEmailSettings(update)
      setSettings(updated)
      setSuccess('Email notification settings saved successfully')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4">
        Failed to load settings
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Email Notifications
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure email notification preferences for your Pantrie instance.
        </p>
      </div>

      {!settings.smtp_configured && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start">
            <span className="text-yellow-500 mr-2">!</span>
            <div>
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                SMTP Not Configured
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Email notifications require SMTP to be configured. Please configure SMTP settings in
                Administration &gt; SMTP Settings before enabling email notifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Master Enable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Enable Email Notifications
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Turn on email notifications for all enabled events
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.email_notifications_enabled}
              onChange={(e) =>
                setSettings({ ...settings, email_notifications_enabled: e.target.checked })
              }
              disabled={!settings.smtp_configured}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
          </label>
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
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_expiring_items}
                onChange={(e) =>
                  setSettings({ ...settings, notify_expiring_items: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Expiry Warning Days */}
          {settings.notify_expiring_items && (
            <div className="pl-4 py-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Days before expiry to send warning
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.expiry_warning_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    expiry_warning_days: parseInt(e.target.value) || 7,
                  })
                }
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
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_low_stock}
                onChange={(e) =>
                  setSettings({ ...settings, notify_low_stock: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
            </label>
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
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_new_member}
                onChange={(e) =>
                  setSettings({ ...settings, notify_new_member: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
