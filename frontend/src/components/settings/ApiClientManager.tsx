import { useState, useEffect } from 'react'
import {
  listApiClients,
  createApiClient,
  revokeApiClient,
  type ApiClient,
  type ApiClientCreated,
} from '@/services/apiClients'

interface ApiClientManagerProps {
  householdId: number
  isAdmin: boolean
}

export default function ApiClientManager({ householdId, isAdmin }: ApiClientManagerProps) {
  const [clients, setClients] = useState<ApiClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create form
  const [name, setName] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [creating, setCreating] = useState(false)
  // The plaintext secret is shown exactly once, right after creation.
  const [newSecret, setNewSecret] = useState<ApiClientCreated | null>(null)

  const fetchClients = async () => {
    try {
      setLoading(true)
      setClients(await listApiClients(householdId))
      setError('')
    } catch (err) {
      console.error('Error fetching API clients:', err)
      setError('Failed to load API clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) fetchClients()
    else setLoading(false)
  }, [householdId, isAdmin])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      setCreating(true)
      const created = await createApiClient(householdId, {
        name: name.trim(),
        permissions: { read: true, write: canWrite },
      })
      setNewSecret(created)
      setName('')
      setCanWrite(false)
      await fetchClients()
    } catch (err) {
      console.error('Error creating API client:', err)
      setError('Failed to create API client')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (clientPk: number) => {
    if (!confirm('Revoke this API client? It will no longer be able to authenticate.')) return
    try {
      await revokeApiClient(householdId, clientPk)
      await fetchClients()
    } catch (err) {
      console.error('Error revoking API client:', err)
      setError('Failed to revoke API client')
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">API Clients</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Only household admins can manage API clients.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">API Clients</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Issue credentials for external apps (like Mealie) to read and update this household's
          inventory.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* One-time secret display */}
      {newSecret && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Copy this secret now — it will not be shown again.
          </p>
          <div className="mt-2 space-y-1 font-mono text-sm break-all">
            <div className="text-gray-800 dark:text-gray-100">
              <span className="font-semibold">client_id:</span> {newSecret.client_id}
            </div>
            <div className="text-gray-800 dark:text-gray-100">
              <span className="font-semibold">client_secret:</span> {newSecret.client_secret}
            </div>
          </div>
          <button
            onClick={() => setNewSecret(null)}
            className="mt-3 px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium"
          >
            I've saved it
          </button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mealie"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
          <input
            type="checkbox"
            checked={canWrite}
            onChange={(e) => setCanWrite(e.target.checked)}
          />
          <span>Allow writes (decrement quantities)</span>
        </label>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create client'}
        </button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Loading API clients…</p>
      ) : clients.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No API clients yet</p>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {client.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        client.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {client.is_active ? 'active' : 'revoked'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1 break-all">
                    {client.client_id}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Permissions:{' '}
                    {Object.entries(client.permissions)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'none'}
                    {client.last_used_at && (
                      <span className="ml-2 text-gray-400">
                        · last used {new Date(client.last_used_at).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
                {client.is_active && (
                  <button
                    onClick={() => handleRevoke(client.id)}
                    className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 font-medium"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
