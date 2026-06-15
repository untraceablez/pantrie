import { useState, useEffect } from 'react'
import {
  getMealieConnection,
  configureMealieConnection,
  deleteMealieConnection,
  type MealieConnection,
} from '@/services/mealie'

interface MealieConnectionSettingsProps {
  householdId: number
  isAdmin: boolean
}

export default function MealieConnectionSettings({
  householdId,
  isAdmin,
}: MealieConnectionSettingsProps) {
  const [connection, setConnection] = useState<MealieConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchConnection = async () => {
    try {
      setLoading(true)
      const conn = await getMealieConnection(householdId)
      setConnection(conn)
      if (conn) setBaseUrl(conn.base_url)
      setError('')
    } catch (err) {
      console.error('Error fetching Mealie connection:', err)
      setError('Failed to load Mealie connection')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnection()
  }, [householdId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!baseUrl.trim() || !apiKey.trim()) return
    try {
      setSaving(true)
      setError('')
      const conn = await configureMealieConnection(householdId, {
        base_url: baseUrl.trim(),
        api_key: apiKey.trim(),
      })
      setConnection(conn)
      setApiKey('') // never keep the key in state after saving
      setSuccess('Mealie connection saved')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving Mealie connection:', err)
      setError('Failed to save Mealie connection. Check the URL and API key.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Remove the Mealie connection?')) return
    try {
      await deleteMealieConnection(householdId)
      setConnection(null)
      setBaseUrl('')
      setApiKey('')
    } catch (err) {
      console.error('Error removing Mealie connection:', err)
      setError('Failed to remove Mealie connection')
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Mealie Connection</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Only household admins can configure the Mealie connection.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Mealie Connection</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Connect a Mealie instance to see which recipes you can make from your inventory.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-6">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {connection && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Connected to <span className="font-mono">{connection.base_url}</span>. Enter a new API
              key only to change it.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mealie URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://mealie.example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={connection ? '•••••••• (unchanged)' : 'Mealie API token'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Stored encrypted; never displayed again.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="submit"
              disabled={saving || !baseUrl.trim() || !apiKey.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : connection ? 'Update connection' : 'Connect'}
            </button>
            {connection && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 font-medium"
              >
                Remove
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
