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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Add New Item</h1>
          <p className="mt-2 text-sm text-gray-600">
            Add a new item to your household inventory
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <AddItemForm onSuccess={handleSuccess} onCancel={handleCancel} />
        </div>
      </div>
    </div>
  )
}
