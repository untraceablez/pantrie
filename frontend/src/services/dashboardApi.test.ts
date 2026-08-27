/**
 * Unit test for the dashboard call that lives in `api.ts` alongside the shared
 * client. `getDashboardSummary` cannot mock `@/services/api` (it *is* that
 * module), so the axios `get` is stubbed on the real instance instead.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiClient, getDashboardSummary, type DashboardSummary } from './api'

const summary = {
  household_id: 7,
  generated_on: '2026-06-15',
  expiring_within_days: 7,
  low_stock_threshold: '1',
  counts: {
    total_items: 1,
    expired: 0,
    expiring_soon: 0,
    low_stock: 0,
    no_expiration_date: 1,
  },
  by_location: [],
  by_category: [],
  recently_added: [],
} as DashboardSummary

describe('getDashboardSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('requests the household summary and returns response.data', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: summary })

    expect(await getDashboardSummary(7)).toEqual(summary)
    expect(get).toHaveBeenCalledWith('/dashboard/households/7/summary', {
      params: undefined,
    })
  })

  it('forwards the horizon, threshold, and recent-limit params', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: summary })

    await getDashboardSummary(7, {
      expiring_within_days: 14,
      low_stock_threshold: 2,
      recent_limit: 3,
    })

    expect(get).toHaveBeenCalledWith('/dashboard/households/7/summary', {
      params: { expiring_within_days: 14, low_stock_threshold: 2, recent_limit: 3 },
    })
  })
})
