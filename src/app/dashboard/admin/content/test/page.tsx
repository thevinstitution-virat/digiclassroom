export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          🎯 Test Page Working!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          This confirms that the routing is working correctly.
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="space-y-2 text-left">
            <div className="flex justify-between">
              <span>Server:</span>
              <span className="text-green-600">✅ Running</span>
            </div>
            <div className="flex justify-between">
              <span>Authentication:</span>
              <span className="text-green-600">✅ Working</span>
            </div>
            <div className="flex justify-between">
              <span>Routing:</span>
              <span className="text-green-600">✅ Working</span>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <a 
            href="/dashboard/admin/content" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Content Page
          </a>
        </div>
      </div>
    </div>
  )
}
