import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import SiteSettings from '@/components/SiteSettings'
import UserManagement from '@/components/UserManagement'
import HouseholdManagement from '@/components/HouseholdManagement'
import ProxySettings from '@/components/ProxySettings'

type AdminTab = 'smtp' | 'proxy' | 'users' | 'households'

export default function AdministrationSettings() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<AdminTab>('smtp')

  const isSiteAdmin = user?.site_role === 'site_administrator'

  if (!isSiteAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Administration
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          You need site administrator privileges to access this section.
        </p>
      </div>
    )
  }

  const tabs = [
    { id: 'smtp' as const, name: 'SMTP Settings', icon: '📧' },
    { id: 'proxy' as const, name: 'Proxy Settings', icon: '🌐' },
    { id: 'users' as const, name: 'User Management', icon: '👨‍👩‍👧‍👦' },
    { id: 'households' as const, name: 'Household Management', icon: '🏘️' },
  ]

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Site Administration
      </h2>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'smtp' && <SiteSettings />}
        {activeTab === 'proxy' && <ProxySettings />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'households' && <HouseholdManagement />}
      </div>
    </div>
  )
}
