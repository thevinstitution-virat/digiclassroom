'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Users, CheckSquare, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalClasses: number
  totalStudents: number
  pendingValidations: number
  approvedValidations: number
}

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClasses: 0,
    totalStudents: 0,
    pendingValidations: 0,
    approvedValidations: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // Fetch classes
      const classesRes = await fetch('/api/teacher/classes')
      const classesData = await classesRes.json()
      
      // Fetch students
      const studentsRes = await fetch('/api/teacher/students')
      const studentsData = await studentsRes.json()
      
      // Fetch validation queue
      const validationRes = await fetch('/api/teacher/validation-queue?status=all')
      const validationData = await validationRes.json()

      setStats({
        totalClasses: classesData.data?.total || 0,
        totalStudents: studentsData.data?.total || 0,
        pendingValidations: validationData.data?.pending || 0,
        approvedValidations: validationData.data?.items?.filter((item: any) => item.validationStatus === 'approved').length || 0,
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'My Classes',
      value: stats.totalClasses,
      icon: BookOpen,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '/dashboard/teacher/classes',
    },
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      href: '/dashboard/teacher/students',
    },
    {
      title: 'Pending Validations',
      value: stats.pendingValidations,
      icon: CheckSquare,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      href: '/dashboard/teacher/validation',
    },
    {
      title: 'Approved Content',
      value: stats.approvedValidations,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      href: '/dashboard/teacher/validation',
    },
  ]

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
        <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your teaching activities.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks you can perform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/dashboard/teacher/classes"
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <BookOpen className="h-6 w-6 text-blue-600 mb-2" />
              <h3 className="font-semibold">Create New Class</h3>
              <p className="text-sm text-gray-600 mt-1">Set up a new class for your students</p>
            </a>

            <a
              href="/dashboard/teacher/students"
              className="p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <Users className="h-6 w-6 text-green-600 mb-2" />
              <h3 className="font-semibold">Manage Students</h3>
              <p className="text-sm text-gray-600 mt-1">Assign students to your classes</p>
            </a>

            <a
              href="/dashboard/teacher/validation"
              className="p-4 border border-gray-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition-colors"
            >
              <CheckSquare className="h-6 w-6 text-yellow-600 mb-2" />
              <h3 className="font-semibold">Validate Content</h3>
              <p className="text-sm text-gray-600 mt-1">Review AI-generated content</p>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Follow these steps to set up your teaching environment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">1</span>
              </div>
              <div>
                <h4 className="font-medium">Create your first class</h4>
                <p className="text-sm text-gray-600">Set up a class with subject, grade level, and section details</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-semibold">2</span>
              </div>
              <div>
                <h4 className="font-medium">Add students to your class</h4>
                <p className="text-sm text-gray-600">Assign students to your classes to start teaching</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 font-semibold">3</span>
              </div>
              <div>
                <h4 className="font-medium">Review and validate content</h4>
                <p className="text-sm text-gray-600">Help improve AI-generated content by validating questions and materials</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

