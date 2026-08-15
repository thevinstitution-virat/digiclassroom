export default function TestPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          🎯 Test Page Working!
        </h1>
        <p className="text-muted-foreground mb-8">
          This confirms that the routing is working correctly.
        </p>
        <div className="bg-card rounded-lg p-6 shadow-lg">
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
            href="/dashboard/super-admin/content" 
            className="bg-primary/100 hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Content Page
          </a>
        </div>
      </div>
    </div>
  )
}
