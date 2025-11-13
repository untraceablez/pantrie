import { useState, useEffect } from 'react'
import { createLocation } from '@/services/location'

interface AddLocationModalProps {
  householdId: number
  onClose: () => void
  onSuccess: () => void
}

const commonIcons = ['🗄️', '❄️', '🚪', '📦', '🧊', '🍽️', '🛒', '🏺', '📚', '🔧']

// Smart emoji suggestions based on location name
const emojiSuggestions: Record<string, string> = {
  fridge: '❄️',
  refrigerator: '❄️',
  freezer: '🧊',
  pantry: '🗄️',
  cabinet: '🚪',
  cupboard: '🚪',
  closet: '🚪',
  shelf: '📚',
  drawer: '📦',
  box: '📦',
  storage: '📦',
  garage: '🔧',
  shed: '🔧',
  basement: '🏺',
  cellar: '🏺',
  attic: '📦',
  kitchen: '🍽️',
  dining: '🍽️',
  cart: '🛒',
  counter: '🍽️',
  bar: '🍽️',
}

function suggestEmoji(name: string): string {
  const normalized = name.toLowerCase().trim()
  for (const [keyword, emoji] of Object.entries(emojiSuggestions)) {
    if (normalized.includes(keyword)) {
      return emoji
    }
  }
  return commonIcons[0] // Default to first icon
}

export default function AddLocationModal({ householdId, onClose, onSuccess }: AddLocationModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [customIcon, setCustomIcon] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-suggest emoji when name changes
  useEffect(() => {
    if (name && !icon && !customIcon) {
      const suggested = suggestEmoji(name)
      setIcon(suggested)
    }
  }, [name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)

    try {
      const finalIcon = customIcon.trim() || icon || null
      await createLocation({
        household_id: householdId,
        name: name.trim(),
        description: description.trim() || null,
        icon: finalIcon,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error creating location:', err)
      setError(err.response?.data?.error || 'Failed to create location. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Location</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            disabled={loading}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Location Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="e.g., Pantry, Refrigerator, Freezer"
                required
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:placeholder-gray-400"
                placeholder="Optional description"
                disabled={loading}
              />
            </div>

            {/* Icon Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Icon (Optional)
              </label>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {commonIcons.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setIcon(emoji)
                      setCustomIcon('')
                    }}
                    className={`text-2xl p-2 rounded-md border-2 transition-colors ${
                      icon === emoji && !customIcon
                        ? 'border-primary bg-blue-50 dark:bg-blue-900'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                    }`}
                    disabled={loading}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Or use custom:</span>
                <input
                  type="text"
                  value={customIcon}
                  onChange={(e) => {
                    setCustomIcon(e.target.value)
                    if (e.target.value) setIcon('')
                  }}
                  className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:placeholder-gray-400"
                  placeholder="Any emoji"
                  maxLength={4}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
