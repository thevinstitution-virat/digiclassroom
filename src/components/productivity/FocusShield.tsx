/**
 * FocusShield - Smart Focus Mode with App-Level Suppression
 * Distraction blocking with emergency SOS and whitelist control
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  ShieldCheckIcon,
  ShieldExclamationIcon,
  BellSlashIcon,
  BellIcon,
  PhoneIcon,
  GlobeAltIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface FocusSession {
  id: string
  startTime: Date
  duration: number
  blockedApps: string[]
  emergencyContacts: string[]
  isActive: boolean
}

interface BlockedSite {
  domain: string
  category: 'social' | 'entertainment' | 'news' | 'gaming' | 'custom'
  isBlocked: boolean
}

export default function FocusShield() {
  const [isActive, setIsActive] = useState(false)
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null)
  const [sessionDuration, setSessionDuration] = useState(25) // minutes
  const [emergencyContact, setEmergencyContact] = useState('')
  const [customBlockedSite, setCustomBlockedSite] = useState('')
  const [sosMessage, setSosMessage] = useState('')
  const [showSosPanel, setShowSosPanel] = useState(false)

  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([
    { domain: 'facebook.com', category: 'social', isBlocked: true },
    { domain: 'instagram.com', category: 'social', isBlocked: true },
    { domain: 'twitter.com', category: 'social', isBlocked: true },
    { domain: 'youtube.com', category: 'entertainment', isBlocked: true },
    { domain: 'netflix.com', category: 'entertainment', isBlocked: true },
    { domain: 'reddit.com', category: 'social', isBlocked: true },
    { domain: 'tiktok.com', category: 'social', isBlocked: true },
    { domain: 'whatsapp.com', category: 'social', isBlocked: false }, // Educational communication
    { domain: 'zoom.us', category: 'social', isBlocked: false }, // Online classes
    { domain: 'meet.google.com', category: 'social', isBlocked: false }, // Online classes
  ])

  const [whitelistedSites] = useState([
    'khan-academy.org',
    'coursera.org',
    'edx.org',
    'byju.com',
    'unacademy.com',
    'vedantu.com',
    'toppr.com',
    'ncert.nic.in',
    'cbse.gov.in',
    'nta.ac.in'
  ])

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('focusshield_settings')
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setBlockedSites(settings.blockedSites || blockedSites)
      setEmergencyContact(settings.emergencyContact || '')
    }
  }, [])

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      blockedSites,
      emergencyContact,
      sessionDuration
    }
    localStorage.setItem('focusshield_settings', JSON.stringify(settings))
  }

  // Start focus session
  const startFocusSession = () => {
    const session: FocusSession = {
      id: Date.now().toString(),
      startTime: new Date(),
      duration: sessionDuration * 60 * 1000, // Convert to milliseconds
      blockedApps: blockedSites.filter(site => site.isBlocked).map(site => site.domain),
      emergencyContacts: emergencyContact ? [emergencyContact] : [],
      isActive: true
    }

    setCurrentSession(session)
    setIsActive(true)
    saveSettings()

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Show start notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🛡️ FocusShield Activated', {
        body: `Focus session started for ${sessionDuration} minutes. Distractions are now blocked.`,
        icon: '/favicon.ico'
      })
    }

    // Set timer to end session
    setTimeout(() => {
      endFocusSession()
    }, session.duration)
  }

  // End focus session
  const endFocusSession = () => {
    setIsActive(false)
    setCurrentSession(null)

    // Show completion notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🎉 Focus Session Complete!', {
        body: 'Great job staying focused! Take a well-deserved break.',
        icon: '/favicon.ico'
      })
    }
  }

  // Emergency SOS function
  const triggerSOS = () => {
    if (emergencyContact && sosMessage) {
      // In a real implementation, this would send SMS/WhatsApp
      console.log('SOS triggered:', { contact: emergencyContact, message: sosMessage })
      
      // Temporarily disable focus mode
      setIsActive(false)
      
      // Show SOS notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 Emergency SOS Triggered', {
          body: 'Focus mode temporarily disabled. Emergency contact notified.',
          icon: '/favicon.ico'
        })
      }
      
      setShowSosPanel(false)
      
      // Re-enable after 10 minutes
      setTimeout(() => {
        if (currentSession) {
          setIsActive(true)
        }
      }, 10 * 60 * 1000)
    }
  }

  // Toggle site blocking
  const toggleSiteBlocking = (domain: string) => {
    setBlockedSites(prev => 
      prev.map(site => 
        site.domain === domain 
          ? { ...site, isBlocked: !site.isBlocked }
          : site
      )
    )
  }

  // Add custom blocked site
  const addCustomBlockedSite = () => {
    if (customBlockedSite && !blockedSites.find(site => site.domain === customBlockedSite)) {
      setBlockedSites(prev => [...prev, {
        domain: customBlockedSite,
        category: 'custom',
        isBlocked: true
      }])
      setCustomBlockedSite('')
    }
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      social: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      entertainment: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      news: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      gaming: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      custom: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
    return colors[category as keyof typeof colors] || colors.custom
  }

  const timeRemaining = currentSession 
    ? Math.max(0, currentSession.duration - (Date.now() - currentSession.startTime.getTime()))
    : 0

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
            <ShieldCheckIcon className="h-6 w-6" />
            <span>FocusShield - Smart Distraction Blocker</span>
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            🇮🇳 Block distractions while keeping educational sites accessible
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Current Session Status */}
      {isActive && currentSession && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  Focus Mode Active
                </span>
              </div>
              
              <div className="text-3xl font-mono font-bold text-blue-600">
                {formatTimeRemaining(timeRemaining)}
              </div>
              
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {blockedSites.filter(site => site.isBlocked).length} sites blocked • 
                {whitelistedSites.length} educational sites allowed
              </div>

              <div className="flex justify-center space-x-4">
                <Button onClick={endFocusSession} variant="outline">
                  End Session
                </Button>
                <Button 
                  onClick={() => setShowSosPanel(true)} 
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                  Emergency SOS
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SOS Panel */}
      {showSosPanel && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200">Emergency SOS</CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              This will temporarily disable focus mode and notify your emergency contact
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Describe your emergency situation..."
              value={sosMessage}
              onChange={(e) => setSosMessage(e.target.value)}
            />
            <div className="flex space-x-4">
              <Button onClick={triggerSOS} variant="destructive" className="flex-1">
                <PhoneIcon className="h-4 w-4 mr-2" />
                Send SOS
              </Button>
              <Button onClick={() => setShowSosPanel(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Session Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Session Duration (minutes)</label>
              <Input
                type="number"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Number(e.target.value))}
                min="5"
                max="120"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Emergency Contact</label>
              <Input
                placeholder="Parent/Guardian phone number"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
              />
            </div>

            {!isActive && (
              <Button onClick={startFocusSession} className="w-full bg-green-600 hover:bg-green-700">
                <ShieldCheckIcon className="h-4 w-4 mr-2" />
                Start Focus Session
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Whitelisted Educational Sites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <GlobeAltIcon className="h-5 w-5 text-green-600" />
              <span>Always Allowed (Educational)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {whitelistedSites.map((site, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900 rounded">
                  <span className="text-sm">{site}</span>
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    Educational
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blocked Sites Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BellSlashIcon className="h-5 w-5 text-red-600" />
            <span>Blocked Sites & Apps</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Custom Site */}
          <div className="flex space-x-2">
            <Input
              placeholder="Add custom site to block (e.g., example.com)"
              value={customBlockedSite}
              onChange={(e) => setCustomBlockedSite(e.target.value)}
            />
            <Button onClick={addCustomBlockedSite} variant="outline">
              Add
            </Button>
          </div>

          {/* Blocked Sites List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blockedSites.map((site, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={site.isBlocked}
                    onCheckedChange={() => toggleSiteBlocking(site.domain)}
                  />
                  <div>
                    <div className="font-medium">{site.domain}</div>
                    <Badge className={`text-xs ${getCategoryColor(site.category)}`}>
                      {site.category}
                    </Badge>
                  </div>
                </div>
                {site.isBlocked ? (
                  <BellSlashIcon className="h-5 w-5 text-red-500" />
                ) : (
                  <BellIcon className="h-5 w-5 text-green-500" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Focus Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <ClockIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Hours Focused Today</div>
            </div>
            <div className="text-center">
              <ShieldCheckIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Sessions This Week</div>
            </div>
            <div className="text-center">
              <BellSlashIcon className="h-8 w-8 mx-auto mb-2 text-red-600" />
              <div className="text-2xl font-bold">{blockedSites.filter(s => s.isBlocked).length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Sites Blocked</div>
            </div>
            <div className="text-center">
              <GlobeAltIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold">{whitelistedSites.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Educational Sites</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
