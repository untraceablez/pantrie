import { type InventoryItem } from '@/services/inventory'
import InventoryItemCard from './InventoryItemCard'

interface InventoryListProps {
  items: InventoryItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onSortChange: (field: string) => void
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onEdit?: (item: InventoryItem) => void
  onDelete?: (item: InventoryItem) => void
  onItemClick?: (item: InventoryItem) => void
}

export default function InventoryList({
  items,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onSortChange,
  sortBy,
  sortOrder,
  onEdit,
  onDelete,
  onItemClick,
}: InventoryListProps) {
  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  const SortButton = ({ field, label }: { field: string; label: string }) => {
    const isActive = sortBy === field
    return (
      <button
        onClick={() => onSortChange(field)}
        className={`text-sm font-medium ${
          isActive ? 'text-primary' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        {label}
        {isActive && (
          <span className="ml-1">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
      {/* Header with sort options */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Showing {startItem}-{endItem} of {total} items
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
            <SortButton field="name" label="Name" />
            <SortButton field="expiration_date" label="Expiration" />
            <SortButton field="created_at" label="Date Added" />
            <SortButton field="quantity" label="Quantity" />
          </div>
        </div>
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {items.map((item) => (
          <InventoryItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} onClick={onItemClick} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center space-x-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                // Show first page, last page, current page, and pages around current
                const showPage =
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= page - 1 && pageNum <= page + 1)

                if (!showPage) {
                  // Show ellipsis
                  if (pageNum === page - 2 || pageNum === page + 2) {
                    return (
                      <span key={pageNum} className="px-2 text-gray-500 dark:text-gray-400">
                        ...
                      </span>
                    )
                  }
                  return null
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-4 py-2 border rounded-md text-sm font-medium ${
                      pageNum === page
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
