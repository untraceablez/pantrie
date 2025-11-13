import { useNavigate } from 'react-router-dom'
import AddItemForm from '@/components/inventory/AddItemForm'

export default function AddItem() {
  const navigate = useNavigate()

  const handleSuccess = () => {
    navigate('/dashboard')
  }

  const handleCancel = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add New Item</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Add a new item to your household inventory
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <AddItemForm onSuccess={handleSuccess} onCancel={handleCancel} />
        </div>
      </div>
    </div>
  )
}
