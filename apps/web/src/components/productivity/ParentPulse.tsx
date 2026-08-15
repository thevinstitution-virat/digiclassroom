/**
 * ParentPulse - Parent & Teacher Dashboard
 * Progress insights, analytics, and communication tools
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { 
  ChartBarIcon,
  ClockIcon,
  AcademicCapIcon,
  BellIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface StudentProgress {
  subject: string
  hoursStudied: number
  completionRate: number
  lastActive: string
  upcomingTests: string[]
  strengths: string[]
  improvements: string[]
}

interface NotificationSettings {
  dailyReports: boolean
  weeklyReports: boolean
  testReminders: boolean
  lowPerformanceAlerts: boolean
  achievementUpdates: boolean
  smsNotifications: boolean
  emailNotifications: boolean
  whatsappNotifications: boolean
}

export default function ParentPulse() {
  const [selectedStudent, setSelectedStudent] = useState('arjun')
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'notifications' | 'communication'>('overview')
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    dailyReports: true,
    weeklyReports: true,
    testReminders: true,
    lowPerformanceAlerts: true,
    achievementUpdates: true,
    smsNotifications: false,
    emailNotifications: true,
    whatsappNotifications: false
  })

  const students = [
    { id: 'arjun', name: 'Arjun Sharma', grade: '10', board: 'CBSE' },
    { id: 'priya', name: 'Priya Patel', grade: '12', board: 'ICSE' }
  ]

  const studentProgress: Record<string, StudentProgress[]> = {
    arjun: [
      {
        subject: 'Mathematics',
        hoursStudied: 25,
        completionRate: 78,
        lastActive: '2 hours ago',
        upcomingTests: ['Quadratic Equations - March 15', 'Trigonometry - March 22'],
        strengths: ['Problem solving', 'Algebraic expressions'],
        improvements: ['Geometry theorems', 'Time management']
      },
      {
        subject: 'Physics',
        hoursStudied: 18,
        completionRate: 65,
        lastActive: '1 day ago',
        upcomingTests: ['Light & Optics - March 18'],
        strengths: ['Conceptual understanding', 'Numerical problems'],
        improvements: ['Diagram drawing', 'Formula memorization']
      },
      {
        subject: 'Chemistry',
        hoursStudied: 22,
        completionRate: 82,
        lastActive: '4 hours ago',
        upcomingTests: ['Acids & Bases - March 20'],
        strengths: ['Chemical equations', 'Practical knowledge'],
        improvements: ['Organic chemistry', 'Reaction mechanisms']
      }
    ]
  }

  const weeklyStats = {
    totalStudyHours: 45,
    averageSessionLength: 28,
    focusScore: 85,
    completedTasks: 23,
    missedSessions: 2,
    achievements: ['7-day streak', 'Math mastery', 'Perfect attendance']
  }

  const upcomingEvents = [
    { date: 'March 15', event: 'Mathematics Unit Test', type: 'test', priority: 'high' },
    { date: 'March 18', event: 'Physics Practical Exam', type: 'practical', priority: 'medium' },
    { date: 'March 20', event: 'Chemistry Assignment Due', type: 'assignment', priority: 'medium' },
    { date: 'March 25', event: 'Parent-Teacher Meeting', type: 'meeting', priority: 'high' }
  ]

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <ClockIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{weeklyStats.totalStudyHours}h</div>
            <div className="text-sm text-muted-foreground">This Week</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <AcademicCapIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{weeklyStats.focusScore}%</div>
            <div className="text-sm text-muted-foreground">Focus Score</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <TrophyIcon className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold">{weeklyStats.completedTasks}</div>
            <div className="text-sm text-muted-foreground">Tasks Done</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDaysIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold">{upcomingEvents.filter(e => e.type === 'test').length}</div>
            <div className="text-sm text-muted-foreground">Upcoming Tests</div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Subject-wise Progress</CardTitle>
          <CardDescription>Detailed breakdown of {students.find(s => s.id === selectedStudent)?.name}'s performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {studentProgress[selectedStudent]?.map((subject, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{subject.subject}</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{subject.hoursStudied}h studied</Badge>
                    <Badge variant={subject.completionRate >= 80 ? 'default' : subject.completionRate >= 60 ? 'secondary' : 'destructive'}>
                      {subject.completionRate}% complete
                    </Badge>
                  </div>
                </div>
                
                <Progress value={subject.completionRate} className="h-3" />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-600">Strengths:</span>
                    <ul className="mt-1 space-y-1">
                      {subject.strengths.map((strength, i) => (
                        <li key={i} className="flex items-center space-x-1">
                          <CheckCircleIcon className="h-3 w-3 text-green-500" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <span className="font-medium text-orange-600">Needs Improvement:</span>
                    <ul className="mt-1 space-y-1">
                      {subject.improvements.map((improvement, i) => (
                        <li key={i} className="flex items-center space-x-1">
                          <ExclamationTriangleIcon className="h-3 w-3 text-orange-500" />
                          <span>{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <span className="font-medium text-blue-600">Upcoming Tests:</span>
                    <ul className="mt-1 space-y-1">
                      {subject.upcomingTests.map((test, i) => (
                        <li key={i} className="text-blue-700 dark:text-blue-300">{test}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events & Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">{event.event}</div>
                    <div className="text-sm text-muted-foreground">{event.date}</div>
                  </div>
                </div>
                <Badge variant={event.priority === 'high' ? 'destructive' : 'secondary'}>
                  {event.priority} priority
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderNotifications = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose how and when you want to receive updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Types */}
          <div className="space-y-4">
            <h3 className="font-semibold">Report Types</h3>
            {Object.entries({
              dailyReports: 'Daily Progress Reports',
              weeklyReports: 'Weekly Summary Reports',
              testReminders: 'Test & Assignment Reminders',
              lowPerformanceAlerts: 'Low Performance Alerts',
              achievementUpdates: 'Achievement & Milestone Updates'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={notificationSettings[key as keyof NotificationSettings] as boolean}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    [key]: e.target.checked
                  }))}
                  className="rounded"
                />
              </div>
            ))}
          </div>

          {/* Delivery Methods */}
          <div className="space-y-4">
            <h3 className="font-semibold">Delivery Methods</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center space-x-3">
                  <EnvelopeIcon className="h-6 w-6 text-blue-600" />
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-sm text-muted-foreground">Detailed reports</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      emailNotifications: e.target.checked
                    }))}
                  />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center space-x-3">
                  <PhoneIcon className="h-6 w-6 text-green-600" />
                  <div>
                    <div className="font-medium">SMS</div>
                    <div className="text-sm text-muted-foreground">Quick alerts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.smsNotifications}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      smsNotifications: e.target.checked
                    }))}
                  />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center space-x-3">
                  <BellIcon className="h-6 w-6 text-purple-600" />
                  <div>
                    <div className="font-medium">WhatsApp</div>
                    <div className="text-sm text-muted-foreground">Instant updates</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.whatsappNotifications}
                    onChange={(e) => setNotificationSettings(prev => ({
                      ...prev,
                      whatsappNotifications: e.target.checked
                    }))}
                  />
                </div>
              </Card>
            </div>
          </div>

          <Button className="w-full">Save Notification Settings</Button>
        </CardContent>
      </Card>

      {/* Sample Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Reports</CardTitle>
          <CardDescription>Preview of the reports you'll receive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">Daily Progress Report - March 14, 2024</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                Arjun studied for 3.5 hours today, completing 85% of planned tasks. 
                Strong performance in Mathematics (2 hours) and Chemistry (1.5 hours). 
                Recommendation: Allocate more time to Physics tomorrow.
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Achievement Alert</h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                🎉 Congratulations! Arjun has achieved a 7-day study streak and mastered 
                the Quadratic Equations chapter. Keep up the excellent work!
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200">Test Reminder</h4>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                📅 Reminder: Mathematics Unit Test on Quadratic Equations is scheduled 
                for tomorrow (March 15). Current preparation level: 78%. 
                Suggested review: Practice problems 15-20.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderCommunication = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Direct Communication</CardTitle>
          <CardDescription>Send messages to teachers or get support</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">To</label>
            <select className="w-full p-2 border rounded">
              <option>Mathematics Teacher - Mrs. Sharma</option>
              <option>Physics Teacher - Mr. Kumar</option>
              <option>Chemistry Teacher - Dr. Patel</option>
              <option>Class Teacher - Ms. Gupta</option>
              <option>VG Kosh Support Team</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Subject</label>
            <Input placeholder="Enter message subject..." />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Message</label>
            <Textarea 
              placeholder="Type your message here..."
              rows={6}
            />
          </div>

          <div className="flex space-x-4">
            <Button className="flex-1">
              <EnvelopeIcon className="h-4 w-4 mr-2" />
              Send Message
            </Button>
            <Button variant="outline" className="flex-1">
              <PhoneIcon className="h-4 w-4 mr-2" />
              Request Call
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Communications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Communications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Mrs. Sharma (Math Teacher)</span>
                <span className="text-sm text-muted-foreground">2 days ago</span>
              </div>
              <p className="text-sm text-foreground">
                Arjun is showing excellent progress in algebra. I recommend additional 
                practice with word problems to strengthen application skills.
              </p>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">VG Kosh Support</span>
                <span className="text-sm text-muted-foreground">1 week ago</span>
              </div>
              <p className="text-sm text-foreground">
                Thank you for your feedback about the new productivity features. 
                We've implemented your suggestions in the latest update.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
            <ChartBarIcon className="h-6 w-6" />
            <span>ParentPulse - Family Dashboard</span>
          </CardTitle>
          <CardDescription className="text-orange-700 dark:text-orange-300">
            🇮🇳 Stay connected with your child's learning journey and academic progress
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Student Selection & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <label className="font-medium">Student:</label>
          <select 
            className="p-2 border rounded"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            {students.map(student => (
              <option key={student.id} value={student.id}>
                {student.name} - Grade {student.grade} ({student.board})
              </option>
            ))}
          </select>
        </div>

        <div className="flex space-x-2">
          <Button 
            variant={viewMode === 'overview' ? 'default' : 'outline'}
            onClick={() => setViewMode('overview')}
          >
            Overview
          </Button>
          <Button 
            variant={viewMode === 'notifications' ? 'default' : 'outline'}
            onClick={() => setViewMode('notifications')}
          >
            Notifications
          </Button>
          <Button 
            variant={viewMode === 'communication' ? 'default' : 'outline'}
            onClick={() => setViewMode('communication')}
          >
            Communication
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'overview' && renderOverview()}
      {viewMode === 'notifications' && renderNotifications()}
      {viewMode === 'communication' && renderCommunication()}
    </div>
  )
}
