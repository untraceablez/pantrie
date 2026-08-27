interface AllergenWarningProps {
  /** Matched household allergen names. Nothing renders when empty. */
  allergens: string[]
  /** Leading label, e.g. "Contains" for a form field. */
  label?: string
  /**
   * Announce the warning as it appears. Use for warnings that show up in
   * response to typing; leave off for static list content, where a screenful
   * of alerts would spam a screen reader.
   */
  live?: boolean
  className?: string
}

/**
 * The shared "this matches one of your household's allergens" banner.
 *
 * The matching itself happens on the server (see `useAllergenWarnings`); this
 * only renders whatever came back.
 */
export default function AllergenWarning({
  allergens,
  label = 'Allergen warning',
  live = false,
  className = '',
}: Readonly<AllergenWarningProps>) {
  if (allergens.length === 0) return null

  return (
    <div
      {...(live ? { role: 'alert' } : {})}
      className={`rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2 ${className}`}
    >
      <div className="flex items-start space-x-2">
        <svg
          aria-hidden="true"
          focusable="false"
          className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <p className="text-xs text-red-900 dark:text-red-200">
          <span className="font-bold">{label}:</span>{' '}
          <span className="font-semibold capitalize">{allergens.join(', ')}</span>
        </p>
      </div>
    </div>
  )
}
