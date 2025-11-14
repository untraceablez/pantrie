import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listInventory, deleteItem, type InventoryListResponse, type InventoryItem } from '@/services/inventory'
import { listHouseholds, type HouseholdWithRole } from '@/services/household'
import { listHouseholdLocations, type Location } from '@/services/location'
import { logout } from '@/services/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import InventoryList from '@/components/inventory/InventoryList'
import SearchBar from '@/components/inventory/SearchBar'
import EditItemModal from '@/components/inventory/EditItemModal'
import ItemDetailModal from '@/components/inventory/ItemDetailModal'

export default function Inventory() {
  const navigate = useNavigate()
  const { user, refreshToken, logout: clearAuth } = useAuthStore()
  const { resolvedTheme } = useThemeStore()
  const [households, setHouseholds] = useState<HouseholdWithRole[]>([])
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [inventoryData, setInventoryData] = useState<InventoryListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null)

  // Search and filter state
  const [search, setSearch] = useState('')
  const [categoryId] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Fetch user's households on mount
  useEffect(() => {
    const fetchHouseholds = async () => {
      if (!user) return
      try {
        const userHouseholds = await listHouseholds()
        setHouseholds(userHouseholds)
        if (userHouseholds.length > 0) {
          setSelectedHouseholdId(userHouseholds[0].id)
        }
      } catch (err) {
        console.error('Error fetching households:', err)
        setError('Failed to load households')
      }
    }
    fetchHouseholds()
  }, [user])

  // Fetch locations when household changes
  useEffect(() => {
    const fetchLocations = async () => {
      if (!selectedHouseholdId) {
        setLocations([])
        setSelectedLocationId(null)
        return
      }

      try {
        const householdLocations = await listHouseholdLocations(selectedHouseholdId)
        setLocations(householdLocations)
        // Reset to "All" tab when household changes
        setSelectedLocationId(null)
      } catch (err) {
        console.error('Error fetching locations:', err)
      }
    }

    fetchLocations()
  }, [selectedHouseholdId])

  // Fetch inventory when household or filters change
  useEffect(() => {
    const fetchInventory = async () => {
      if (!selectedHouseholdId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const data = await listInventory(selectedHouseholdId, {
          page,
          page_size: pageSize,
          search: search || undefined,
          category_id: categoryId,
          location_id: selectedLocationId || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        })
        setInventoryData(data)
        setError('')
      } catch (err: any) {
        console.error('Error fetching inventory:', err)
        setError(err.response?.data?.error || 'Failed to load inventory')
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [selectedHouseholdId, page, search, categoryId, selectedLocationId, sortBy, sortOrder])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1) // Reset to first page when searching
  }

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      // Toggle sort order if clicking same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
  }

  const handleDelete = (item: InventoryItem) => {
    setDeletingItem(item)
  }

  const handleConfirmDelete = async () => {
    if (!deletingItem) return

    setDeleteLoading(true)
    setError('')

    try {
      await deleteItem(deletingItem.id)
      setDeletingItem(null)

      // Refresh inventory after successful delete
      if (selectedHouseholdId) {
        const data = await listInventory(selectedHouseholdId, {
          page,
          page_size: pageSize,
          search: search || undefined,
          category_id: categoryId,
          location_id: selectedLocationId || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        })
        setInventoryData(data)
      }
    } catch (err: any) {
      console.error('Error deleting item:', err)
      setError(err.response?.data?.error || 'Failed to delete item. Please try again.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleEditSuccess = () => {
    // Refresh inventory after successful edit
    if (selectedHouseholdId) {
      listInventory(selectedHouseholdId, {
        page,
        page_size: pageSize,
        search: search || undefined,
        category_id: categoryId,
        location_id: selectedLocationId || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
        .then((data) => setInventoryData(data))
        .catch((err) => {
          console.error('Error refreshing inventory:', err)
        })
    }
  }

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await logout(refreshToken)
      }
      clearAuth()
      navigate('/login')
    } catch (err) {
      console.error('Error logging out:', err)
      // Clear auth anyway
      clearAuth()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <img
                src={resolvedTheme === 'dark' ? '/pantrie-logo-light.png' : '/pantrie-logo-dark.png'}
                alt="Pantrie"
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  View and manage your household items
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/settings')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                title="Settings"
              >
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                title="Logout"
              >
                Logout
              </button>
              <button
                onClick={() => navigate('/add-item')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Household selector */}
        {households.length > 1 && (
          <div className="mb-6 bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4">
            <label htmlFor="household-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Household
            </label>
            <select
              id="household-select"
              value={selectedHouseholdId || ''}
              onChange={(e) => setSelectedHouseholdId(Number(e.target.value))}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            >
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Location Tabs */}
        {selectedHouseholdId && locations.length > 0 && (
          <div className="mb-6 bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedLocationId(null)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  selectedLocationId === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All Items
              </button>
              {locations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => setSelectedLocationId(location.id)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2 ${
                    selectedLocationId === location.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span>{location.icon}</span>
                  <span>{location.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar value={search} onChange={handleSearchChange} />
        </div>

        {/* Filters - Future enhancement */}
        {/* Can add category/location filters here */}

        {/* Inventory List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading inventory...</p>
          </div>
        ) : !selectedHouseholdId ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No household selected</p>
          </div>
        ) : !inventoryData || inventoryData.items.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {search ? 'No items found matching your search' : 'No items in your inventory yet'}
            </p>
            <button
              onClick={() => navigate('/add-item')}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Add your first item
            </button>
          </div>
        ) : (
          <InventoryList
            items={inventoryData.items}
            total={inventoryData.total}
            page={inventoryData.page}
            pageSize={inventoryData.page_size}
            totalPages={inventoryData.total_pages}
            onPageChange={handlePageChange}
            onSortChange={handleSortChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onItemClick={setViewingItem}
          />
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Item Detail Modal */}
      {viewingItem && (
        <ItemDetailModal
          item={viewingItem}
          onClose={() => setViewingItem(null)}
          onEdit={(item) => {
            setViewingItem(null)
            setEditingItem(item)
          }}
          onDelete={(item) => {
            setViewingItem(null)
            setDeletingItem(item)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Item
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete <strong>{deletingItem.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingItem(null)}
                disabled={deleteLoading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
