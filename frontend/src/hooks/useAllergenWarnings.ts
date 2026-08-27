import { useEffect, useState } from 'react'
import {
  checkTextsForAllergens,
  getInventoryAllergenMatches,
} from '@/services/allergen'

/**
 * Household allergen warnings, matched by the backend.
 *
 * Stored items are resolved through one household-wide request that every card
 * on screen shares, so a page of N items still costs a single call. Without the
 * shared cache each card would fetch on its own — the N+1 the old per-card
 * `listHouseholdAllergens()` call produced.
 */

// How long a fetched result is reused before the next mount refetches. Long
// enough to cover rendering a whole list, short enough that editing an item or
// changing the household's allergens shows up promptly.
const CACHE_TTL_MS = 30000

interface CacheEntry {
  fetchedAt: number
  matches: Promise<Map<number, string[]>>
}

const cache = new Map<number, CacheEntry>()

/** Drop the shared cache (used by tests, and after allergens change). */
export const resetAllergenWarningCache = (): void => {
  cache.clear()
}

/** Item id -> matched allergen names, fetched at most once per TTL per household. */
export const loadHouseholdAllergenMatches = (
  householdId: number
): Promise<Map<number, string[]>> => {
  const cached = cache.get(householdId)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.matches
  }

  const matches = getInventoryAllergenMatches(householdId)
    .then((rows) => new Map(rows.map((row) => [row.item_id, row.allergens])))
    .catch((err) => {
      // Don't cache a failure — the next card (or the next render) retries.
      cache.delete(householdId)
      throw err
    })

  cache.set(householdId, { fetchedAt: Date.now(), matches })
  return matches
}

/** Household allergens implicated by one stored item's ingredients. */
export const useItemAllergenWarnings = (
  householdId: number,
  itemId: number
): string[] => {
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    let active = true
    loadHouseholdAllergenMatches(householdId)
      .then((matches) => {
        if (active) setWarnings(matches.get(itemId) ?? [])
      })
      .catch(() => {
        // A failed check must never blank out the item itself.
        if (active) setWarnings([])
      })
    return () => {
      active = false
    }
  }, [householdId, itemId])

  return warnings
}

// Typing pauses this long before the unsaved ingredients text is checked.
const CHECK_DEBOUNCE_MS = 400

/** Household allergens implicated by free text that isn't saved yet (a form field). */
export const useTextAllergenWarnings = (
  householdId: number | null,
  text: string
): string[] => {
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    if (!householdId || !text.trim()) {
      setWarnings([])
      return
    }

    let active = true
    const timer = setTimeout(() => {
      checkTextsForAllergens(householdId, [text])
        .then((results) => {
          if (active) setWarnings(results[0]?.allergens ?? [])
        })
        .catch(() => {
          if (active) setWarnings([])
        })
    }, CHECK_DEBOUNCE_MS)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [householdId, text])

  return warnings
}
