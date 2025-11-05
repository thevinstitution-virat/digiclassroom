'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Clock, Mail, Award, Briefcase, X } from 'lucide-react'

interface Teacher {
  userId: string
  clerkId: string
  email: string
  firstName: string
  lastName: string
  approvalStatus: 'pending' | 'approved' | 'rejected'
  specialization: string[]
  qualification: string
  experienceYears: number
  phone?: string
  createdAt: string
  approvedAt?: string
  rejectionReason?: string
}

export default function AdminPendingTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTeachers()
  }, [filter])

  const fetchTeachers = async () => {
    try {
      const response = await fetch(`/api/admin/teachers/pending?status=${filter}`)
      const data = await response.json()
      if (data.success) {
        setTeachers(data.data.teachers)
      }
    } catch (error) {
      console.error('Error fetching teachers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (teacherId: string) => {
    if (!confirm('Are you sure you want to approve this teacher?')) return
    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/teachers/approve/${teacherId}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        fetchTeachers()
      } else {
        alert(data.error || 'Failed to approve teacher')
      }
    } catch (error) {
      console.error('Error approving teacher:', error)
      alert('Failed to approve teacher')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedTeacher || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/teachers/reject/${selectedTeacher.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      })

      const data = await response.json()

      if (data.success) {
        setShowRejectModal(false)
        setSelectedTeacher(null)
        setRejectionReason('')
        fetchTeachers()
      } else {
        alert(data.error || 'Failed to reject teacher')
      }
    } catch (error) {
      console.error('Error rejecting teacher:', error)
      alert('Failed to reject teacher')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Pending</span>
      case 'approved':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Approved</span>
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Rejected</span>
      default:
        return null
    }
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
        <h1 className="text-3xl font-bold text-gray-900">Teacher Approval Management</h1>
        <p className="text-gray-600 mt-2">Review and approve teacher registration requests</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              filter === status
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Teachers List */}
      {teachers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No teachers found</h3>
            <p className="text-gray-600">
              {filter === 'pending' ? 'No pending teacher requests' : `No ${filter} teachers found`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {teachers.map((teacher) => (
            <Card key={teacher.userId} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {teacher.firstName} {teacher.lastName}
                    </CardTitle>
                    <CardDescription className="mt-1">{teacher.email}</CardDescription>
                  </div>
                  {getStatusBadge(teacher.approvalStatus)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Teacher Details */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Award className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Qualification</p>
                      <p className="font-medium">{teacher.qualification}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Briefcase className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Experience</p>
                      <p className="font-medium">{teacher.experienceYears} years</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Award className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Specialization</p>
                      <p className="font-medium">{teacher.specialization.join(', ')}</p>
                    </div>
                  </div>

                  {teacher.phone && (
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium">{teacher.phone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rejection Reason */}
                {teacher.approvalStatus === 'rejected' && teacher.rejectionReason && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                    <p className="text-sm text-red-700">{teacher.rejectionReason}</p>
                  </div>
                )}

                {/* Approval Date */}
                {teacher.approvedAt && (
                  <div className="text-sm text-gray-600">
                    Approved on {new Date(teacher.approvedAt).toLocaleDateString()}
                  </div>
                )}

                {/* Registration Date */}
                <div className="text-sm text-gray-600 pt-3 border-t">
                  Registered on {new Date(teacher.createdAt).toLocaleDateString()}
                </div>

                {/* Action Buttons */}
                {teacher.approvalStatus === 'pending' && (
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => {
                        setSelectedTeacher(teacher)
                        setShowRejectModal(true)
                      }}
                      disabled={submitting}
                      variant="outline"
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(teacher.userId)}
                      disabled={submitting}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Reject Teacher Application</CardTitle>
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedTeacher(null)
                    setRejectionReason('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription>
                Provide a reason for rejecting {selectedTeacher.firstName} {selectedTeacher.lastName}'s application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Explain why this application is being rejected..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedTeacher(null)
                      setRejectionReason('')
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={submitting || !rejectionReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {submitting ? 'Rejecting...' : 'Reject Application'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

