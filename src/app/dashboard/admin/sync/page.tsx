'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  RefreshCw, 
  Database, 
  Zap,
  Webhook,
  History,
  FileJson,
  ArrowRight
} from 'lucide-react'
import UserSyncPanel from '@/components/admin/UserSyncPanel'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function UserSyncPage() {
  const [activeTab, setActiveTab] = useState('overview')
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Database className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                User Synchronization
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Manage user synchronization between Clerk authentication and application database
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/20 dark:border-gray-700/20">
          <TabsList className="grid grid-cols-4 gap-4 bg-transparent">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl h-12"
            >
              <Users className="h-5 w-5 mr-2" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="webhooks" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl h-12"
            >
              <Webhook className="h-5 w-5 mr-2" />
              <span>Webhooks</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl h-12"
            >
              <History className="h-5 w-5 mr-2" />
              <span>Sync History</span>
            </TabsTrigger>
            <TabsTrigger 
              value="logs" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl h-12"
            >
              <FileJson className="h-5 w-5 mr-2" />
              <span>Logs</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <UserSyncPanel />
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Webhook className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                    Webhook Configuration
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Automatic user synchronization via Clerk webhooks
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Webhook Status</h3>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-700 dark:text-green-300 font-medium">Active</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Webhooks are properly configured and actively syncing user data between Clerk and your application database.
                </p>
                <div className="flex items-center space-x-3">
                  <Button
                    className="px-4 py-2 h-10 rounded-xl border-gray-200 hover:border-gray-400 hover:bg-gray-50 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    variant="outline"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    <span>Test Webhook</span>
                  </Button>
                  <Button
                    className="px-4 py-2 h-10 rounded-xl border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    variant="outline"
                  >
                    <span>View Configuration</span>
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
              
              <div className="p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Webhook Events</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="font-medium">user.created</span>
                    </div>
                    <span className="text-green-600 text-sm">Active</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="font-medium">user.updated</span>
                    </div>
                    <span className="text-green-600 text-sm">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <History className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                    Synchronization History
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Recent user synchronization operations
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                Sync history will be displayed here
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FileJson className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                    Synchronization Logs
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Detailed logs of sync operations and errors
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                Sync logs will be displayed here
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
