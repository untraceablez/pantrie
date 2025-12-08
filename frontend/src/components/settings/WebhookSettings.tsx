import { useState, useEffect } from 'react'
import {
  notificationService,
  Webhook,
  WebhookCreate,
  WebhookUpdate,
} from '@/services/notifications'

const EVENT_TYPES = [
  { id: 'expiring_items', name: 'Expiring Items', description: 'When items are about to expire' },
  { id: 'low_stock', name: 'Low Stock', description: 'When items are running low' },
  { id: 'new_member', name: 'New Member', description: 'When a new member joins a household' },
]

export default function WebhookSettings() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [formData, setFormData] = useState<WebhookCreate>({
    name: '',
    url: '',
    secret: '',
    event_types: ['expiring_items', 'low_stock', 'new_member'],
    household_id: null,
  })
  const [saving, setSaving] = useState(false)

  // Test state
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadWebhooks()
  }, [])

  const loadWebhooks = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await notificationService.listWebhooks()
      setWebhooks(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClick = () => {
    setEditingWebhook(null)
    setFormData({
      name: '',
      url: '',
      secret: '',
      event_types: ['expiring_items', 'low_stock', 'new_member'],
      household_id: null,
    })
    setShowModal(true)
  }

  const handleEditClick = (webhook: Webhook) => {
    setEditingWebhook(webhook)
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: '',
      event_types: webhook.event_types,
      household_id: webhook.household_id,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')

      if (editingWebhook) {
        const update: WebhookUpdate = {
          name: formData.name,
          url: formData.url,
          event_types: formData.event_types,
        }
        if (formData.secret) {
          update.secret = formData.secret
        }
        await notificationService.updateWebhook(editingWebhook.id, update)
        setSuccess('Webhook updated successfully')
      } else {
        await notificationService.createWebhook(formData)
        setSuccess('Webhook created successfully')
      }

      setShowModal(false)
      await loadWebhooks()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save webhook')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (webhook: Webhook) => {
    if (!confirm(`Are you sure you want to delete the webhook "${webhook.name}"?`)) {
      return
    }

    try {
      setError('')
      await notificationService.deleteWebhook(webhook.id)
      setSuccess('Webhook deleted successfully')
      await loadWebhooks()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete webhook')
    }
  }

  const handleToggleActive = async (webhook: Webhook) => {
    try {
      setError('')
      await notificationService.updateWebhook(webhook.id, {
        is_active: !webhook.is_active,
      })
      await loadWebhooks()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update webhook')
    }
  }

  const handleTest = async (webhook: Webhook) => {
    try {
      setTestingId(webhook.id)
      setTestResult(null)
      const result = await notificationService.testWebhook(webhook.id)
      setTestResult({
        id: webhook.id,
        success: result.success,
        message: result.message,
      })
    } catch (err: any) {
      setTestResult({
        id: webhook.id,
        success: false,
        message: err.response?.data?.detail || 'Failed to test webhook',
      })
    } finally {
      setTestingId(null)
    }
  }

  const toggleEventType = (eventType: string) => {
    const newEventTypes = formData.event_types.includes(eventType)
      ? formData.event_types.filter((e) => e !== eventType)
      : [...formData.event_types, eventType]
    setFormData({ ...formData, event_types: newEventTypes })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Webhooks
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure webhooks to receive notifications in external services.
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Add Webhook
        </button>
      </div>

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

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No webhooks configured yet.</p>
          <p className="text-sm mt-1">Click "Add Webhook" to create your first webhook.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {webhook.name}
                    </h4>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        webhook.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono break-all">
                    {webhook.url}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {webhook.event_types.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded"
                      >
                        {EVENT_TYPES.find((e) => e.id === event)?.name || event}
                      </span>
                    ))}
                  </div>
                  {testResult && testResult.id === webhook.id && (
                    <div
                      className={`mt-2 text-sm ${
                        testResult.success
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleTest(webhook)}
                    disabled={testingId === webhook.id}
                    className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    {testingId === webhook.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleToggleActive(webhook)}
                    className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    {webhook.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleEditClick(webhook)}
                    className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(webhook)}
                    className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Webhook"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com/webhook"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                {/* Secret */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={formData.secret}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    placeholder={editingWebhook ? '(unchanged)' : 'Enter secret for HMAC signature'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    If provided, requests will include an X-Pantrie-Signature header for verification.
                  </p>
                </div>

                {/* Event Types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Event Types
                  </label>
                  <div className="space-y-2">
                    {EVENT_TYPES.map((event) => (
                      <label
                        key={event.id}
                        className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.event_types.includes(event.id)}
                          onChange={() => toggleEventType(event.id)}
                          className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {event.name}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {event.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || formData.event_types.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Saving...' : editingWebhook ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
