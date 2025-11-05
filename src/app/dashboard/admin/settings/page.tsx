'use client'

import React, { useState } from 'react'
import {
  Settings,
  Shield,
  Bell,
  Database,
  Monitor,
  Globe,
  Lock,
  Key,
  Mail,
  Server,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface SystemSettings {
  maintenanceMode: boolean
  debugMode: boolean
  autoBackup: boolean
  emailNotifications: boolean
  systemAlerts: boolean
  userRegistration: boolean
  guestAccess: boolean
  dataRetention: number
  sessionTimeout: number
  maxFileSize: number
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    maintenanceMode: false,
    debugMode: false,
    autoBackup: true,
    emailNotifications: true,
    systemAlerts: true,
    userRegistration: true,
    guestAccess: false,
    dataRetention: 365,
    sessionTimeout: 60,
    maxFileSize: 100
  })
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Here you would save settings to your backend
      // await saveSystemSettings(settings)
      
      setSuccessMessage('Settings saved successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updateSetting = (key: keyof SystemSettings, value: boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Glassmorphic overlay for consistency with landing page */}
      <div className="absolute inset-0 bg-white/20 dark:bg-black/10 backdrop-blur-sm pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 rounded-full border border-orange-200/50 dark:border-blue-200/20 mb-6 backdrop-blur-sm">
            <Settings className="h-4 w-4 text-orange-500 mr-2 animate-pulse" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">System Configuration</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">System Settings</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
            Configure system-wide settings and preferences with advanced administrative controls
          </p>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-blue-600 text-white hover:from-orange-600 hover:to-blue-700 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/50 rounded-2xl p-6 backdrop-blur-md shadow-lg">
            <div className="flex items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl mr-4 shadow-lg">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">Settings Saved!</h3>
                <p className="text-green-700 dark:text-green-300">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* System Control */}
          <div className="relative p-8 bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-200/50 dark:border-gray-700/50 group overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
                  <Monitor className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Control</h2>
                  <p className="text-gray-600 dark:text-gray-300">Core system settings and operational modes</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">Maintenance Mode</label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Temporarily disable user access</p>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-orange-500 data-[state=checked]:to-red-500"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">Debug Mode</label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Enable detailed error logging</p>
                  </div>
                  <Switch
                    checked={settings.debugMode}
                    onCheckedChange={(checked) => updateSetting('debugMode', checked)}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-orange-500 data-[state=checked]:to-red-500"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">Auto Backup</label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Automatic daily system backups</p>
                  </div>
                  <Switch
                    checked={settings.autoBackup}
                    onCheckedChange={(checked) => updateSetting('autoBackup', checked)}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-orange-500 data-[state=checked]:to-red-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User Management */}
          <div className="relative p-8 bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-200/50 dark:border-gray-700/50 group overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
                  <p className="text-gray-600 dark:text-gray-300">User access and registration settings</p>
                </div>
              </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                    <div>
                      <label className="text-sm font-semibold text-gray-900 dark:text-white">User Registration</label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Allow new user signups</p>
                    </div>
                    <Switch
                      checked={settings.userRegistration}
                      onCheckedChange={(checked) => updateSetting('userRegistration', checked)}
                      className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                    <div>
                      <label className="text-sm font-semibold text-gray-900 dark:text-white">Guest Access</label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Allow anonymous browsing</p>
                    </div>
                    <Switch
                      checked={settings.guestAccess}
                      onCheckedChange={(checked) => updateSetting('guestAccess', checked)}
                      className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-500"
                    />
                  </div>

                  <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                    <label className="text-sm font-semibold text-gray-900 dark:text-white mb-3 block">Session Timeout (minutes)</label>
                    <input
                      type="number"
                      value={settings.sessionTimeout}
                      onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 60)}
                      min="5"
                      max="480"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

          {/* Notifications */}
          <div className="relative p-8 bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-200/50 dark:border-gray-700/50 group overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg">
                  <Bell className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h2>
                  <p className="text-gray-600 dark:text-gray-300">System alerts and notification preferences</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">Email Notifications</label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Send admin alerts via email</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-yellow-500 data-[state=checked]:to-orange-500"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">System Alerts</label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">In-app system notifications</p>
                  </div>
                  <Switch
                    checked={settings.systemAlerts}
                    onCheckedChange={(checked) => updateSetting('systemAlerts', checked)}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-yellow-500 data-[state=checked]:to-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="relative p-8 bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-200/50 dark:border-gray-700/50 group overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl shadow-lg">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Management</h2>
                  <p className="text-gray-600 dark:text-gray-300">Data retention and storage settings</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <label className="text-sm font-semibold text-gray-900 dark:text-white mb-3 block">Data Retention (days)</label>
                  <input
                    type="number"
                    value={settings.dataRetention}
                    onChange={(e) => updateSetting('dataRetention', parseInt(e.target.value) || 365)}
                    min="30"
                    max="3650"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:border-green-300 dark:hover:border-green-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">How long to keep user data and logs</p>
                </div>

                <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <label className="text-sm font-semibold text-gray-900 dark:text-white mb-3 block">Max File Size (MB)</label>
                  <input
                    type="number"
                    value={settings.maxFileSize}
                    onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value) || 100)}
                    min="1"
                    max="1000"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:border-green-300 dark:hover:border-green-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Maximum upload file size</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="relative p-8 bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] border border-gray-200/50 dark:border-gray-700/50 group overflow-hidden backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl shadow-lg">
                <Server className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Status</h2>
                <p className="text-gray-600 dark:text-gray-300">Current system health and status indicators</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200/50 dark:border-green-700/50">
                <div className="h-4 w-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-lg animate-pulse"></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Database</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200/50 dark:border-green-700/50">
                <div className="h-4 w-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-lg animate-pulse"></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">AI Services</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Operational</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200/50 dark:border-green-700/50">
                <div className="h-4 w-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-lg animate-pulse"></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">File Storage</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Available</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200/50 dark:border-yellow-700/50">
                <div className="h-4 w-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full shadow-lg animate-pulse"></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Backup</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Scheduled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
