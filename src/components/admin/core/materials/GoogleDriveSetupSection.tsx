'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CloudIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
  FolderIcon,
  KeyIcon,
  LinkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/core/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Badge } from '@/components/core/ui/badge'
import { Input } from '@/components/core/ui/input'
import { Label } from '@/components/core/ui/label'
import { Textarea } from '@/components/core/ui/textarea'
import { Alert, AlertDescription } from '@/components/core/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/core/ui/tabs'
import { TokenManagerSection } from './TokenManagerSection'
import type { GoogleDriveQuota, FolderStructure } from '@/types/google-drive'

interface GoogleDriveSetupSectionProps {
  isConnected: boolean
  onConnectionChange: () => void
}

interface SetupState {
  loading: boolean
  error?: string
  quota?: GoogleDriveQuota
  folders: FolderStructure[]
  credentials: {
    clientId: string
    clientSecret: string
    redirectUri: string
  }
  authUrl?: string
  authCode: string
}

export default function GoogleDriveSetupSection({ 
  isConnected, 
  onConnectionChange 
}: GoogleDriveSetupSectionProps) {
  const [state, setState] = useState<SetupState>({
    loading: false,
    error: undefined,
    folders: [],
    credentials: {
      clientId: '',
      clientSecret: '',
      redirectUri: ''
    },
    authCode: ''
  })

  useEffect(() => {
    if (isConnected) {
      fetchQuotaInfo()
      fetchFolderStructure()
    }
    loadCredentials()

    // Check for authorization code in URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const authCode = urlParams.get('code')
    if (authCode) {
      setState(prev => ({ ...prev, authCode }))
      // Clear URL parameters to prevent repeated attempts
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.toString())
    }
  }, [isConnected])

  const loadCredentials = async () => {
    try {
      const response = await fetch('/api/super-admin/materials/google-drive/credentials')
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          credentials: result.data
        }))
      }
    } catch (error) {
      console.error('Error loading credentials:', error)
    }
  }

  const fetchQuotaInfo = async () => {
    try {
      const response = await fetch('/api/super-admin/materials/google-drive/quota')
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          quota: result.data
        }))
      }
    } catch (error) {
      console.error('Error fetching quota:', error)
    }
  }

  const fetchFolderStructure = async () => {
    try {
      const response = await fetch('/api/super-admin/materials/google-drive/folders')
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          folders: result.data
        }))
      }
    } catch (error) {
      console.error('Error fetching folders:', error)
    }
  }

  const saveCredentials = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }))
      
      const response = await fetch('/api/super-admin/materials/google-drive/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.credentials)
      })
      
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          authUrl: result.authUrl,
          loading: false
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to save credentials',
          loading: false
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to save credentials',
        loading: false
      }))
    }
  }

  const exchangeAuthCode = async (codeParam?: string) => {
    const codeToUse = codeParam || state.authCode
    if (!codeToUse) {
      setState(prev => ({ ...prev, error: 'Authorization code is required' }))
      return
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }))

      const response = await fetch('/api/super-admin/materials/google-drive/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToUse })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          authCode: '',
          authUrl: undefined
        }))

        // Clear URL parameters
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          url.searchParams.delete('code')
          url.searchParams.delete('success')
          window.history.replaceState({}, '', url.toString())
        }

        onConnectionChange()
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to authenticate',
          loading: false
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to authenticate',
        loading: false
      }))
    }
  }

  const createFolderStructure = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }))
      
      const response = await fetch('/api/super-admin/materials/google-drive/folders/create-structure', {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({ ...prev, loading: false }))
        fetchFolderStructure()
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to create folder structure',
          loading: false
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to create folder structure',
        loading: false
      }))
    }
  }

  const disconnectGoogleDrive = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive?')) return

    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }))
      
      const response = await fetch('/api/super-admin/materials/google-drive/disconnect', {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({ ...prev, loading: false }))
        onConnectionChange()
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to disconnect',
          loading: false
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to disconnect',
        loading: false
      }))
    }
  }

  const formatBytes = (bytes: string) => {
    const num = parseInt(bytes)
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (num === 0)
  return '0 Bytes'
    const i = Math.floor(Math.log(num) / Math.log(1024))
    return Math.round(num / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CloudIcon className="h-8 w-8 text-blue-500" />
              <div>
                <CardTitle>Google Drive Integration</CardTitle>
                <CardDescription>
                  Configure Google Drive for materials storage and management
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {state.error && (
            <Alert className="mb-4">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {isConnected ? (
            <div className="space-y-4">
              {/* Quota Information */}
              {state.quota && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Storage</p>
                    <p className="text-lg font-bold">{formatBytes(state.quota.limit)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Used Storage</p>
                    <p className="text-lg font-bold">{formatBytes(state.quota.usage)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Available</p>
                    <p className="text-lg font-bold">
                      {formatBytes((parseInt(state.quota.limit) - parseInt(state.quota.usage)).toString())}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={fetchQuotaInfo}
                  disabled={state.loading}
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
                <Button
                  variant="destructive"
                  onClick={disconnectGoogleDrive}
                  disabled={state.loading}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CloudIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Google Drive Not Connected
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Connect your Google Drive account to enable materials management
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Tabs */}
      <Tabs defaultValue="credentials" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="folders">Folder Structure</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <KeyIcon className="h-5 w-5" />
                <span>API Credentials</span>
              </CardTitle>
              <CardDescription>
                Configure Google Drive API credentials for authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={state.credentials.clientId}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    credentials: { ...prev.credentials, clientId: e.target.value }
                  }))}
                  placeholder="Enter Google Drive Client ID"
                />
              </div>

              <div>
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={state.credentials.clientSecret}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    credentials: { ...prev.credentials, clientSecret: e.target.value }
                  }))}
                  placeholder="Enter Google Drive Client Secret"
                />
              </div>

              <div>
                <Label htmlFor="redirectUri">Redirect URI</Label>
                <Input
                  id="redirectUri"
                  value={state.credentials.redirectUri}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    credentials: { ...prev.credentials, redirectUri: e.target.value }
                  }))}
                  placeholder="Enter Redirect URI"
                />
              </div>

              <Button
                onClick={saveCredentials}
                disabled={state.loading || !state.credentials.clientId || !state.credentials.clientSecret}
                className="w-full"
              >
                {state.loading ? 'Saving...' : 'Save Credentials'}
              </Button>

              {state.authUrl && (
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Authorization Required</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click the link below to authorize VG Kosh to access your Google Drive:
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open(state.authUrl, '_blank')}
                    className="w-full"
                  >
                    Authorize Google Drive Access
                  </Button>
                  
                  <div className="space-y-2">
                    <Label htmlFor="authCode">Authorization Code</Label>
                    <Input
                      id="authCode"
                      value={state.authCode}
                      onChange={(e) => setState(prev => ({ ...prev, authCode: e.target.value }))}
                      placeholder="Paste the authorization code here"
                    />
                    <Button
                      onClick={() => exchangeAuthCode()}
                      disabled={state.loading || !state.authCode}
                      className="w-full"
                    >
                      {state.loading ? 'Connecting...' : 'Complete Connection'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="folders" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <FolderIcon className="h-5 w-5" />
                    <span>Folder Structure</span>
                  </CardTitle>
                  <CardDescription>
                    Manage Google Drive folder organization for materials
                  </CardDescription>
                </div>
                <Button
                  onClick={createFolderStructure}
                  disabled={state.loading || !isConnected}
                >
                  Create Structure
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {state.folders.length > 0 ? (
                <div className="space-y-2">
                  {state.folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <FolderIcon className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{folder.folderName}</p>
                          <p className="text-sm text-gray-500">{folder.folderPath}</p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {folder.board} - Class {folder.class}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FolderIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No Folder Structure Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Create the folder structure to organize your materials
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CogIcon className="h-5 w-5" />
                <span>Advanced Settings</span>
              </CardTitle>
              <CardDescription>
                Configure advanced Google Drive integration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-approve uploads</p>
                    <p className="text-sm text-gray-500">Automatically approve materials from trusted sources</p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sync frequency</p>
                    <p className="text-sm text-gray-500">How often to sync with Google Drive</p>
                  </div>
                  <Badge variant="secondary">Every 15 minutes</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Storage notifications</p>
                    <p className="text-sm text-gray-500">Get notified when storage is running low</p>
                  </div>
                  <Badge variant="default">Enabled</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Token Manager Section */}
      <div className="mt-6">
        <TokenManagerSection />
      </div>
    </div>
  )
}
