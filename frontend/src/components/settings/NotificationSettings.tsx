import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import EmailNotificationSettings from '@/components/settings/EmailNotificationSettings'
import WebhookSettings from '@/components/settings/WebhookSettings'

type NotificationTab = 'email' | 'webhooks'

export default function NotificationSettings() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<NotificationTab>('email')

  const isSiteAdmin = user?.site_role === 'site_administrator'

  if (!isSiteAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Notifications
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          You need site administrator privileges to access notification settings.
        </p>
      </div>
    )
  }

  const tabs = [
    { id: 'email' as const, name: 'Email Notifications', icon: '📧' },
    { id: 'webhooks' as const, name: 'Webhooks', icon: '🔗' },
  ]

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Notification Settings
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
        {activeTab === 'email' && <EmailNotificationSettings />}
        {activeTab === 'webhooks' && <WebhookSettings />}
      </div>
    </div>
  )
}
