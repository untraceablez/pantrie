import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'

interface PageHeaderProps {
  title: string
  subtitle: string
  /** The sibling page this one links across to (Dashboard <-> Inventory). */
  siblingLabel: string
  siblingTo: string
  onLogout: () => void
}

// Shared by every button in the nav row except the primary "Add Item".
const NAV_BUTTON_CLASS =
  'px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 ' +
  'dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 ' +
  'font-medium transition-colors'

/**
 * Logo, title and nav actions shared by the Dashboard and Inventory pages.
 *
 * Extracted because the two headers were identical but for the title, the
 * subtitle and the one button that links to the other page.
 */
export default function PageHeader({
  title,
  subtitle,
  siblingLabel,
  siblingTo,
  onLogout,
}: Readonly<PageHeaderProps>) {
  const navigate = useNavigate()
  const { resolvedTheme } = useThemeStore()

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <img
            src={resolvedTheme === 'dark' ? '/pantrie-logo-light.png' : '/pantrie-logo-dark.png'}
            alt="Pantrie"
            className="h-12 w-auto"
          />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(siblingTo)}
            className={NAV_BUTTON_CLASS}
            title={siblingLabel}
          >
            {siblingLabel}
          </button>
          <button onClick={() => navigate('/recipes')} className={NAV_BUTTON_CLASS} title="Recipes">
            Recipes
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={NAV_BUTTON_CLASS}
            title="Settings"
          >
            Settings
          </button>
          <button onClick={onLogout} className={NAV_BUTTON_CLASS} title="Logout">
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
  )
}
