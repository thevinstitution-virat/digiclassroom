'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle, XCircle, Mail, Phone, Award } from 'lucide-react'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'

interface TeacherStatus {
  isTeacher: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected'
  canAccessFeatures: boolean
  message: string
  data: {
    userId: string
    email: string
    firstName: string
    lastName: string
    approvedAt?: string
    rejectionReason?: string
    specialization: string[]
    qualification: string
    experienceYears: number
    registeredAt: string
  }
}

export default function TeacherPendingApprovalPage() {
  const { user, isLoaded } = useBetterAuthUser()
  const router = useRouter()
  const [status, setStatus] = useState<TeacherStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && user) {
      fetchTeacherStatus()
    }
  }, [isLoaded, user])

  const fetchTeacherStatus = async () => {
    try {
      const response = await fetch('/api/teacher/status')
      const data = await response.json()
      
      setStatus(data)
      
      // If approved, redirect to teacher dashboard
      if (data.approvalStatus === 'approved') {
        router.push('/dashboard/teacher')
      }
    } catch (error) {
      console.error('Error fetching teacher status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>Unable to load teacher status</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const getStatusIcon = () => {
    switch (status.approvalStatus) {
      case 'pending':
        return <Clock className="h-16 w-16 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-16 w-16 text-green-500" />
      case 'rejected':
        return <XCircle className="h-16 w-16 text-red-500" />
    }
  }

  const getStatusColor = () => {
    switch (status.approvalStatus) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200'
      case 'approved':
        return 'bg-green-50 border-green-200'
      case 'rejected':
        return 'bg-red-50 border-red-200'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/15 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Status Card */}
        <Card className={`mb-6 ${getStatusColor()}`}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl">
              {status.approvalStatus === 'pending' && 'Approval Pending'}
              {status.approvalStatus === 'approved' && 'Account Approved'}
              {status.approvalStatus === 'rejected' && 'Application Rejected'}
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              {status.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status.approvalStatus === 'pending' && (
              <div className="bg-card rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-lg">What happens next?</h3>
                <ul className="space-y-2 text-foreground">
                  <li className="flex items-start">
                    <span className="mr-2">1.</span>
                    <span>Our admin team will review your application</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">2.</span>
                    <span>You will receive an email notification once your account is reviewed</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">3.</span>
                    <span>Once approved, you can access all teacher features</span>
                  </li>
                </ul>
                <div className="mt-6 p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-primary">
                    <strong>Tip:</strong> This usually takes 1-2 business days. You'll be notified via email at{' '}
                    <strong>{status.data.email}</strong>
                  </p>
                </div>
              </div>
            )}

            {status.approvalStatus === 'rejected' && status.data.rejectionReason && (
              <div className="bg-card rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-2">Reason for Rejection</h3>
                <p className="text-foreground">{status.data.rejectionReason}</p>
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    If you believe this is an error, please contact support at support@digiclassroom.com
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Your Application Details</CardTitle>
            <CardDescription>Information submitted for review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{status.data.email}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Award className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Qualification</p>
                  <p className="font-medium">{status.data.qualification}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Experience</p>
                  <p className="font-medium">{status.data.experienceYears} years</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Award className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Specialization</p>
                  <p className="font-medium">{status.data.specialization.join(', ')}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Registered on: {new Date(status.data.registeredAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-muted text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={fetchTeacherStatus}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  )
}

