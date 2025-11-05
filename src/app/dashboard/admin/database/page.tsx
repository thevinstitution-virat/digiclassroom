'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Database, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  BookOpen,
  Settings
} from 'lucide-react'

interface MigrationStatus {
  tableExists: boolean
  wordCount: number
  isReady: boolean
  message?: string
}

interface MigrationResult {
  success: boolean
  message: string
  wordsCreated?: number
  totalWords?: number
  error?: string
}

export default function DatabaseManagementPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  const checkDatabaseStatus = async () => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/dictionary/migrate', {
        method: 'GET'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStatus(data.status)
      } else {
        console.error('Failed to check database status:', data.error)
      }
    } catch (error) {
      console.error('Error checking database status:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const runMigration = async () => {
    setIsLoading(true)
    setMigrationResult(null)
    
    try {
      const response = await fetch('/api/dictionary/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'migrate' })
      })
      
      const data = await response.json()
      setMigrationResult(data)
      
      // Refresh status after migration
      if (data.success) {
        setTimeout(() => {
          checkDatabaseStatus()
        }, 1000)
      }
    } catch (error) {
      console.error('Migration error:', error)
      setMigrationResult({
        success: false,
        message: 'Migration failed due to network error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addCommonWords = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/dictionary/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'add-common-words' })
      })
      
      const data = await response.json()
      setMigrationResult(data)
      
      // Refresh status after adding words
      if (data.success) {
        setTimeout(() => {
          checkDatabaseStatus()
        }, 1000)
      }
    } catch (error) {
      console.error('Add words error:', error)
      setMigrationResult({
        success: false,
        message: 'Failed to add common words',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-4">
            <Database className="h-6 w-6 text-orange-500" />
            <span className="text-lg font-semibold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Database Management
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Manage dictionary database tables and migrations
          </p>
        </div>

        {/* Status Card */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Database Status</span>
            </CardTitle>
            <CardDescription>
              Current status of the dictionary database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Dictionary Table Status:</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkDatabaseStatus}
                disabled={isChecking}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Check Status</span>
              </Button>
            </div>

            {status && (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span>Table Exists:</span>
                  <Badge variant={status.tableExists ? "default" : "destructive"}>
                    {status.tableExists ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Yes</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> No</>
                    )}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Word Count:</span>
                  <Badge variant={status.wordCount > 0 ? "default" : "secondary"}>
                    <BookOpen className="h-3 w-3 mr-1" />
                    {status.wordCount} words
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Ready for Use:</span>
                  <Badge variant={status.isReady ? "default" : "destructive"}>
                    {status.isReady ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Ready</>
                    ) : (
                      <><AlertCircle className="h-3 w-3 mr-1" /> Not Ready</>
                    )}
                  </Badge>
                </div>

                {status.message && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      {status.message}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Migration Actions */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Play className="h-5 w-5" />
              <span>Migration Actions</span>
            </CardTitle>
            <CardDescription>
              Run database migrations and populate with vocabulary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Button 
                onClick={runMigration}
                disabled={isLoading}
                className="h-12 bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-600 hover:to-blue-600 text-white font-medium"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Run Full Migration
              </Button>

              <Button 
                onClick={addCommonWords}
                disabled={isLoading || !status?.tableExists}
                variant="outline"
                className="h-12"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BookOpen className="h-4 w-4 mr-2" />
                )}
                Add Common Words
              </Button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>Full Migration:</strong> Creates the dictionary_words table and populates it with essential vocabulary (40+ words)</p>
              <p><strong>Add Common Words:</strong> Adds additional common words to an existing table (15+ words)</p>
            </div>
          </CardContent>
        </Card>

        {/* Migration Results */}
        {migrationResult && (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {migrationResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>Migration Result</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`p-4 rounded-lg border-l-4 ${
                migrationResult.success 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-500' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-500'
              }`}>
                <p className={`font-medium ${
                  migrationResult.success 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {migrationResult.message}
                </p>
                
                {migrationResult.success && migrationResult.totalWords && (
                  <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                    Total words in database: {migrationResult.totalWords}
                  </p>
                )}
                
                {migrationResult.error && (
                  <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                    Error: {migrationResult.error}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Instructions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="space-y-2">
              <p><strong>Step 1:</strong> Click "Check Status" to see the current database state</p>
              <p><strong>Step 2:</strong> If the table doesn't exist, click "Run Full Migration"</p>
              <p><strong>Step 3:</strong> If you need more words, click "Add Common Words"</p>
              <p><strong>Step 4:</strong> Check status again to verify the migration was successful</p>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-500">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Note:</strong> The migration will create a table with 40+ essential English words with Hindi translations, 
                pronunciations, and audio URLs for the dictionary feature.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
