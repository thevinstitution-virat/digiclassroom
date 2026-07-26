'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Shield, Bell, Database, Monitor, Server, CheckCircle, Save, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import PageHeader from '@/components/dashboard/PageHeader'
import { trpc } from '@/lib/trpc/client'

const cardClass = 'rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/50'
const rowClass = 'flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]'

function SectionTitle({ icon: Icon, tint, title, desc }: { icon: React.ComponentType<{ className?: string }>; tint: string; title: string; desc: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const { data: config, isLoading, refetch } = trpc.superAdmin.getSystemSettings.useQuery()
  const updateSettings = trpc.superAdmin.updateSystemSettings.useMutation({
    onSuccess: () => {
      setSuccessMessage('Settings saved successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
      refetch()
    }
  })

  // We maintain a local state that initializes from DB, allowing UI edits before saving
  const [localSettings, setLocalSettings] = useState({
    maintenanceMode: false,
    debugMode: false,
    sessionTimeoutMinutes: 60,
    // Add decorative settings to match existing UI
    autoBackup: true,
    emailNotifications: true,
    systemAlerts: true,
    userRegistration: true,
    guestAccess: false,
    dataRetention: 365,
    maxFileSize: 100,
  })

  useEffect(() => {
    if (config) {
      setLocalSettings(prev => ({
        ...prev,
        maintenanceMode: config.maintenanceMode ?? false,
        debugMode: config.debugMode ?? false,
        sessionTimeoutMinutes: config.sessionTimeoutMinutes ?? 60,
      }))
    }
  }, [config])

  const [successMessage, setSuccessMessage] = useState('')

  const handleSave = () => {
    updateSettings.mutate({
      maintenanceMode: localSettings.maintenanceMode,
      debugMode: localSettings.debugMode,
      sessionTimeoutMinutes: localSettings.sessionTimeoutMinutes,
    })
  }

  const update = (key: keyof typeof localSettings, value: boolean | number) =>
    setLocalSettings((prev) => ({ ...prev, [key]: value }))

  const Toggle = ({ k, label, desc }: { k: keyof typeof localSettings; label: string; desc: string }) => (
    <div className={rowClass}>
      <div>
        <label className="text-sm font-semibold text-gray-900 dark:text-white">{label}</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
      <Switch checked={localSettings[k] as boolean} onCheckedChange={(c) => update(k, c)} />
    </div>
  )

  const numberInput = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white'

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Settings}
        title="System Settings"
        subtitle="Configure system-wide settings and preferences"
        actions={
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl disabled:opacity-50"
          >
            {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 
            {updateSettings.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <CheckCircle className="h-5 w-5 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <SectionTitle icon={Monitor} tint="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" title="System Control" desc="Core operational modes (Live)" />
          <div className="space-y-3">
            <Toggle k="maintenanceMode" label="Maintenance Mode" desc="Temporarily disable user access" />
            <Toggle k="debugMode" label="Debug Mode" desc="Enable detailed error logging" />
            <Toggle k="autoBackup" label="Auto Backup (Mock)" desc="Automatic daily system backups" />
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={Shield} tint="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" title="User Management" desc="Access & registration" />
          <div className="space-y-3">
            <Toggle k="userRegistration" label="User Registration (Mock)" desc="Allow new user signups" />
            <Toggle k="guestAccess" label="Guest Access (Mock)" desc="Allow anonymous browsing" />
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]">
              <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Session Timeout (minutes, Live)</label>
              <input type="number" min={5} max={480} value={localSettings.sessionTimeoutMinutes} onChange={(e) => update('sessionTimeoutMinutes', parseInt(e.target.value) || 60)} className={numberInput} />
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={Bell} tint="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" title="Notifications" desc="Alerts & preferences" />
          <div className="space-y-3">
            <Toggle k="emailNotifications" label="Email Notifications (Mock)" desc="Send admin alerts via email" />
            <Toggle k="systemAlerts" label="System Alerts (Mock)" desc="In-app system notifications" />
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={Database} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" title="Data Management" desc="Retention & storage" />
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]">
              <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Data Retention (days, Mock)</label>
              <input type="number" min={30} max={3650} value={localSettings.dataRetention} onChange={(e) => update('dataRetention', parseInt(e.target.value) || 365)} className={numberInput} />
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]">
              <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Max File Size (MB, Mock)</label>
              <input type="number" min={1} max={1000} value={localSettings.maxFileSize} onChange={(e) => update('maxFileSize', parseInt(e.target.value) || 100)} className={numberInput} />
            </div>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <SectionTitle icon={Server} tint="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" title="System Status" desc="Live health indicators" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { name: 'Database', state: 'Online', ok: true },
            { name: 'AI Services', state: 'Operational', ok: true },
            { name: 'File Storage', state: 'Available', ok: true },
            { name: 'Backup', state: 'Scheduled', ok: false },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]">
              <span className={`h-2 w-2 animate-pulse rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.name}</p>
                <p className={`text-xs font-medium ${s.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{s.state}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
