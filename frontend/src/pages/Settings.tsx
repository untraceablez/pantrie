import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import HouseholdSettings from '@/components/settings/HouseholdSettings'
import UserSettings from '@/components/settings/UserSettings'

type SettingsSection = 'household' | 'account' | 'notifications'

export default function Settings() {
  const navigate = useNavigate()
  const { resolvedTheme } = useThemeStore()
  const [activeSection, setActiveSection] = useState<SettingsSection>('household')

  const sections = [
    { id: 'household' as const, name: 'Household Settings', icon: '🏠' },
    { id: 'account' as const, name: 'Account Settings', icon: '👤' },
    { id: 'notifications' as const, name: 'Notifications', icon: '🔔', disabled: true },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              <span className="font-medium">Back to Dashboard</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <img
              src={resolvedTheme === 'dark' ? '/pantrie-logo-light.png' : '/pantrie-logo-dark.png'}
              alt="Pantrie"
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Manage your household, account, and preferences
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => !section.disabled && setActiveSection(section.id)}
                  disabled={section.disabled}
                  className={`w-full text-left px-4 py-3 rounded-md flex items-center space-x-3 transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : section.disabled
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl">{section.icon}</span>
                  <span className="font-medium">{section.name}</span>
                  {section.disabled && (
                    <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                      Coming Soon
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {activeSection === 'household' && <HouseholdSettings />}
            {activeSection === 'account' && <UserSettings />}
            {activeSection === 'notifications' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notifications</h2>
                <p className="text-gray-600 dark:text-gray-400">Coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
