import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardSummary, type DashboardSummary } from '@/services/api'
import { listHouseholds, type HouseholdWithRole } from '@/services/household'
import { logout } from '@/services/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'

// Horizon used for the "expiring soon" card and its inventory deep-link.
const EXPIRING_WITHIN_DAYS = 7
// Quantity at or below which an item counts as low stock.
const LOW_STOCK_THRESHOLD = 1

interface SummaryCard {
  key: string
  label: string
  hint: string
  count: number
  to: string
  accent: string
}

/** Decimals arrive as strings ("2.00"); render them without trailing zeros. */
const formatQuantity = (value: string): string => {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? value : String(parsed)
}

const formatDate = (value: string | null): string => {
  if (!value) return 'No expiry'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

interface DashboardBodyProps {
  loading: boolean
  selectedHouseholdId: number | null
  summary: DashboardSummary | null
  cards: SummaryCard[]
  navigate: (to: string) => void
}

/** The state-dependent half of the page.
 *
 * Split out of `Dashboard` so the loading / no-household / no-data / populated
 * branches are early returns rather than a nested ternary chain.
 */
function DashboardBody({
  loading,
  selectedHouseholdId,
  summary,
  cards,
  navigate,
}: Readonly<DashboardBodyProps>) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
      </div>
    )
  }

  if (!selectedHouseholdId) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-gray-500 dark:text-gray-400 mb-4">No household selected</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-gray-500 dark:text-gray-400 mb-4">No dashboard data available</p>
      </div>
    )
  }

  return (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card) => (
              <button
                key={card.key}
                onClick={() => navigate(card.to)}
                className="text-left bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
              >
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {card.label}
                </p>
                <p className={`mt-2 text-3xl font-bold ${card.accent}`}>{card.count}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.hint}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Breakdown by location */}
            <section className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                By location
              </h2>
              {summary.by_location.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No items in your inventory yet
                </p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {summary.by_location.map((bucket) => (
                    <li key={bucket.location_id ?? 'unassigned'}>
                      <button
                        onClick={() =>
                          navigate(
                            bucket.location_id === null
                              ? '/inventory'
                              : `/inventory?location_id=${bucket.location_id}`
                          )
                        }
                        className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <span className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          {bucket.icon && <span aria-hidden="true">{bucket.icon}</span>}
                          <span>{bucket.name}</span>
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {bucket.item_count}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recently added */}
            <section className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recently added
              </h2>
              {summary.recently_added.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nothing added yet.{' '}
                  <button
                    onClick={() => navigate('/add-item')}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Add your first item
                  </button>
                </p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {summary.recently_added.map((item) => (
                    <li key={item.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </p>
                        {item.brand && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.brand}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {formatQuantity(item.quantity)}
                          {item.unit ? ` ${item.unit}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(item.expiration_date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Breakdown by category */}
            <section className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                By category
              </h2>
              {summary.by_category.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No items in your inventory yet
                </p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {summary.by_category.map((bucket) => (
                    <li
                      key={bucket.category_id ?? 'unassigned'}
                      className="py-3 flex items-center justify-between"
                    >
                      <span className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                        {bucket.icon && <span aria-hidden="true">{bucket.icon}</span>}
                        <span>{bucket.name}</span>
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {bucket.item_count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, refreshToken, logout: clearAuth } = useAuthStore()
  const { resolvedTheme } = useThemeStore()

  const [households, setHouseholds] = useState<HouseholdWithRole[]>([])
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fetch the user's households on mount
  useEffect(() => {
    const fetchHouseholds = async () => {
      if (!user) return
      try {
        const userHouseholds = await listHouseholds()
        setHouseholds(userHouseholds)
        if (userHouseholds.length > 0) {
          setSelectedHouseholdId(userHouseholds[0].id)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error fetching households:', err)
        setError('Failed to load households')
        setLoading(false)
      }
    }
    fetchHouseholds()
  }, [user])

  // Fetch the summary whenever the selected household changes
  useEffect(() => {
    const fetchSummary = async () => {
      if (!selectedHouseholdId) return

      try {
        setLoading(true)
        const data = await getDashboardSummary(selectedHouseholdId, {
          expiring_within_days: EXPIRING_WITHIN_DAYS,
          low_stock_threshold: LOW_STOCK_THRESHOLD,
        })
        setSummary(data)
        setError('')
      } catch (err: any) {
        console.error('Error fetching dashboard summary:', err)
        setError(err.response?.data?.error || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [selectedHouseholdId])

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

  const cards: SummaryCard[] = summary
    ? [
        {
          key: 'expired',
          label: 'Expired',
          hint: 'Past their expiration date',
          count: summary.counts.expired,
          to: '/inventory?expired=true&sort_by=expiration_date&sort_order=asc',
          accent: 'text-red-600 dark:text-red-400',
        },
        {
          key: 'expiring',
          label: 'Expiring soon',
          hint: `Within ${summary.expiring_within_days} days`,
          count: summary.counts.expiring_soon,
          to: `/inventory?expiring_within_days=${summary.expiring_within_days}&sort_by=expiration_date&sort_order=asc`,
          accent: 'text-amber-600 dark:text-amber-400',
        },
        {
          key: 'low-stock',
          label: 'Low stock',
          hint: `Quantity of ${formatQuantity(summary.low_stock_threshold)} or less`,
          count: summary.counts.low_stock,
          to: `/inventory?low_stock_threshold=${formatQuantity(
            summary.low_stock_threshold
          )}&sort_by=quantity&sort_order=asc`,
          accent: 'text-blue-600 dark:text-blue-400',
        },
        {
          key: 'total',
          label: 'Total items',
          hint: `${summary.counts.no_expiration_date} without an expiry date`,
          count: summary.counts.total_items,
          to: '/inventory',
          accent: 'text-gray-900 dark:text-white',
        },
      ]
    : []

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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  What needs your attention today
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/inventory')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                title="Inventory"
              >
                Inventory
              </button>
              <button
                onClick={() => navigate('/recipes')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                title="Recipes"
              >
                Recipes
              </button>
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
            <label
              htmlFor="dashboard-household-select"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Select Household
            </label>
            <select
              id="dashboard-household-select"
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

        <DashboardBody
          loading={loading}
          selectedHouseholdId={selectedHouseholdId}
          summary={summary}
          cards={cards}
          navigate={navigate}
        />
      </div>
    </div>
  )
}
