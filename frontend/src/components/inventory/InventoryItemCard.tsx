import { type InventoryItem } from '@/services/inventory'

interface InventoryItemCardProps {
  item: InventoryItem
  onEdit?: (item: InventoryItem) => void
}

export default function InventoryItemCard({ item, onEdit }: InventoryItemCardProps) {
  // Calculate days until expiration
  const getDaysUntilExpiration = () => {
    if (!item.expiration_date) return null
    const today = new Date()
    const expirationDate = new Date(item.expiration_date)
    const diffTime = expirationDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilExpiration = getDaysUntilExpiration()

  // Determine expiration status and styling
  const getExpirationStatus = () => {
    if (daysUntilExpiration === null) return null

    if (daysUntilExpiration < 0) {
      return { text: 'Expired', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' }
    } else if (daysUntilExpiration === 0) {
      return { text: 'Expires today', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' }
    } else if (daysUntilExpiration <= 3) {
      return { text: `Expires in ${daysUntilExpiration}d`, color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' }
    } else if (daysUntilExpiration <= 7) {
      return { text: `Expires in ${daysUntilExpiration}d`, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' }
    } else {
      return { text: `Expires in ${daysUntilExpiration}d`, color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' }
    }
  }

  const expirationStatus = getExpirationStatus()

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow bg-white dark:bg-gray-800">
      {/* Item image or placeholder */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-40 object-cover rounded-md mb-4"
        />
      ) : (
        <div className="w-full h-40 bg-gray-100 dark:bg-gray-700 rounded-md mb-4 flex items-center justify-center">
          <svg
            className="w-16 h-16 text-gray-400 dark:text-gray-500"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
          </svg>
        </div>
      )}

      {/* Item details */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1 mr-2">{item.name}</h3>
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="text-gray-400 hover:text-primary flex-shrink-0"
              title="Edit item"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
          )}
        </div>

        {item.brand && (
          <p className="text-sm text-gray-600">{item.brand}</p>
        )}

        {item.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-1">
            <span className="text-lg font-bold text-gray-900">{item.quantity}</span>
            {item.unit && <span className="text-sm text-gray-600">{item.unit}</span>}
          </div>

          {expirationStatus && (
            <span className={`px-2 py-1 text-xs font-medium rounded border ${expirationStatus.color}`}>
              {expirationStatus.text}
            </span>
          )}
        </div>

        {/* Additional info */}
        <div className="pt-2 border-t border-gray-200 space-y-1">
          {item.expiration_date && (
            <div className="flex items-center text-xs text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <span>Expires: {formatDate(item.expiration_date)}</span>
            </div>
          )}

          {item.purchase_date && (
            <div className="flex items-center text-xs text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <span>Purchased: {formatDate(item.purchase_date)}</span>
            </div>
          )}

          {item.barcode && (
            <div className="flex items-center text-xs text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 4v16m8-8H4"></path>
              </svg>
              <span>{item.barcode}</span>
            </div>
          )}
        </div>

        {item.notes && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-600 italic line-clamp-2">{item.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
