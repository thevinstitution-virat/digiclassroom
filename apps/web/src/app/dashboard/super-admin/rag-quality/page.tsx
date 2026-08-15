/**
 * Admin RAG Quality Analytics Page
 * Route: /dashboard/super-admin/rag-quality
 * 
 * Displays the RAG Quality Dashboard for monitoring RAGAS evaluation scores
 * across all AI agents. Protected by admin layout (ProtectedComponent roles=['admin']).
 */

import RagQualityDashboard from '@/components/admin/RagQualityDashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'RAG Quality | Admin Dashboard',
  description: 'Monitor AI RAG quality with RAGAS evaluation scores across agents'
}

export default function RagQualityPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary/10 to-primary/10 backdrop-blur-sm border border-primary/20 rounded-2xl px-6 py-3 mb-4">
            <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm font-medium bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              AI Quality Analytics
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              RAG Quality Dashboard
            </span>
          </h1>

          <p className="text-muted-foreground max-w-xl mx-auto">
            Monitor RAGAS evaluation scores to track AI answer quality across all agents
          </p>
        </div>

        <RagQualityDashboard />
      </div>
    </div>
  )
}
