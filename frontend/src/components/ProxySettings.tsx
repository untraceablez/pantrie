import { useState, useEffect } from 'react'
import { siteSettingsService, ProxySettings as ProxySettingsType } from '@/services/siteSettings'

export default function ProxySettings() {
  const [settings, setSettings] = useState<ProxySettingsType>({
    proxy_mode: 'none',
    external_proxy_url: null,
    custom_domain: null,
    use_https: true,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await siteSettingsService.getProxySettings()
      setSettings(data)
    } catch (error: any) {
      console.error('Failed to load proxy settings:', error)
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load proxy settings',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      await siteSettingsService.updateProxySettings(settings)
      setMessage({
        type: 'success',
        text: 'Proxy settings saved successfully! Please restart the application for changes to take effect.',
      })
    } catch (error: any) {
      console.error('Failed to save proxy settings:', error)
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to save proxy settings',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading proxy settings...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Reverse Proxy Configuration
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Configure how Pantrie is accessed through reverse proxies or custom domains.
      </p>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
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
            value={settings.proxy_mode}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="none">No Reverse Proxy (Direct Access)</option>
            <option value="builtin">Built-in Nginx Proxy</option>
            <option value="external">External Proxy (Cloudflare Tunnel, etc.)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Choose how Pantrie is exposed to the internet
          </p>
        </div>

        {/* External Proxy URL - Only shown for external mode */}
        {settings.proxy_mode === 'external' && (
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
              value={settings.external_proxy_url || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="http://10.0.0.248:5173"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The internal address your proxy forwards to
            </p>
          </div>
        )}

        {/* Custom Domain */}
        {settings.proxy_mode !== 'none' && (
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
              value={settings.custom_domain || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="pantrie.example.com"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The domain name you'll use to access Pantrie
            </p>
          </div>
        )}

        {/* Use HTTPS */}
        {settings.proxy_mode !== 'none' && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="use_https"
              name="use_https"
              checked={settings.use_https}
              onChange={handleChange}
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
            {settings.proxy_mode === 'none' && (
              <>📌 Direct access mode - Pantrie is accessible via IP:port</>
            )}
            {settings.proxy_mode === 'builtin' && (
              <>🔧 Built-in nginx will serve both frontend and backend on port 80/443</>
            )}
            {settings.proxy_mode === 'external' && (
              <>🌐 Configure your external proxy (Cloudflare Tunnel, nginx, etc.) to point to Pantrie</>
            )}
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Proxy Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
