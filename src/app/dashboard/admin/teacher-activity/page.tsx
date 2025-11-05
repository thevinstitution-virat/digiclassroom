'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, TrendingUp, Users, BookOpen, CheckSquare, Eye } from 'lucide-react'

interface TeacherStats {
  teacherId: string
  clerkId: string
  email: string
  teacherName: string
  approvalStatus: string
  approvedAt: string | null
  totalClasses: number
  totalStudents: number
  totalActivities: number
  totalValidations: number
  approvedValidations: number
  lastActivityAt: string | null
}

interface ActivityLog {
  id: string
  teacherId: string
  teacherEmail: string
  teacherName: string
  activityType: string
  activityDescription: string
  metadata: any
  createdAt: string
}

export default function AdminTeacherActivityPage() {
  const [teacherStats, setTeacherStats] = useState<TeacherStats[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    fetchTeacherStats()
  }, [])

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacherActivities(selectedTeacher)
    }
  }, [selectedTeacher])

  const fetchTeacherStats = async () => {
    try {
      const response = await fetch('/api/admin/teachers/activity')
      const data = await response.json()
      if (data.success) {
        setTeacherStats(data.data.teachers)
      }
    } catch (error) {
      console.error('Error fetching teacher stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeacherActivities = async (teacherId: string) => {
    setActivityLoading(true)
    try {
      const response = await fetch(`/api/admin/teachers/activity?teacherId=${teacherId}`)
      const data = await response.json()
      if (data.success) {
        setActivities(data.data.activities)
      }
    } catch (error) {
      console.error('Error fetching teacher activities:', error)
    } finally {
      setActivityLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'class_created':
      case 'class_updated':
      case 'class_deleted':
        return <BookOpen className="h-4 w-4" />
      case 'student_assigned':
      case 'student_removed':
        return <Users className="h-4 w-4" />
      case 'content_validated':
      case 'content_approved':
      case 'content_rejected':
        return <CheckSquare className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: string) => {
    if (type.includes('created') || type.includes('approved')) return 'text-green-600 bg-green-50'
    if (type.includes('deleted') || type.includes('rejected')) return 'text-red-600 bg-red-50'
    if (type.includes('updated') || type.includes('assigned')) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Teacher Activity Monitoring</h1>
        <p className="text-gray-600 mt-2">Monitor teacher activities and performance metrics</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teacherStats.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {teacherStats.reduce((sum, t) => sum + t.totalClasses, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {teacherStats.reduce((sum, t) => sum + t.totalStudents, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Validations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {teacherStats.reduce((sum, t) => sum + t.totalValidations, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teacher Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Teacher Performance</CardTitle>
          <CardDescription>Overview of all teacher activities and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Teacher</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Classes</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Students</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Validations</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Activities</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Last Active</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teacherStats.map((teacher) => (
                  <tr key={teacher.teacherId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{teacher.teacherName}</p>
                        <p className="text-sm text-gray-600">{teacher.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          teacher.approvalStatus === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : teacher.approvalStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {teacher.approvalStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{teacher.totalClasses}</td>
                    <td className="py-3 px-4 text-center font-medium">{teacher.totalStudents}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="text-sm">
                        <span className="font-medium">{teacher.approvedValidations}</span>
                        <span className="text-gray-500">/{teacher.totalValidations}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{teacher.totalActivities}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">
                      {teacher.lastActivityAt
                        ? new Date(teacher.lastActivityAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedTeacher(teacher.teacherId)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      {selectedTeacher && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  Recent activities for{' '}
                  {teacherStats.find((t) => t.teacherId === selectedTeacher)?.teacherName}
                </CardDescription>
              </div>
              <button
                onClick={() => setSelectedTeacher(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-gray-600">No activities found</div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg"
                  >
                    <div className={`p-2 rounded ${getActivityColor(activity.activityType)}`}>
                      {getActivityIcon(activity.activityType)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{activity.activityDescription}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.activityType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

