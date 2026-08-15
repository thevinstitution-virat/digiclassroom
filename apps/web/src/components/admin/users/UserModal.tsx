'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { UserProfile, UserUpdateData, USER_ROLES, USER_STATUSES, getUserDisplayName } from '@/types/user-management'

interface UserModalProps {
  user: UserProfile | null
  isOpen: boolean
  onClose: () => void
  onSave: (userData: UserUpdateData) => void
  loading: boolean
}

export default function UserModal({
  user,
  isOpen,
  onClose,
  onSave,
  loading
}: UserModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'student' as any,
    status: 'active' as any
  })

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: (user as any)?.name?.split(' ')[0] || user?.fullName?.split(' ')[0] || '',
        lastName: (user as any)?.name?.split(' ').slice(1).join(' ') || user?.fullName?.split(' ').slice(1).join(' ') || '',
        email: user.email,
        role: user.role,
        status: user.status
      })
    }
  }, [user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleClose = () => {
    onClose()
    // Reset form after a short delay to avoid visual glitch
    setTimeout(() => {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: 'student',
        status: 'active'
      })
    }, 300)
  }

  if (!isOpen || !user) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Edit User: {getUserDisplayName(user)}
            </h2>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* User Avatar and Basic Info */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-16 w-16 flex-shrink-0">
              {user.profileImageUrl ? (
                <Image
                  src={user.profileImageUrl}
                  alt={getUserDisplayName(user)}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-xl font-medium text-foreground">
                    {getUserDisplayName(user).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">
                {getUserDisplayName(user)}
              </h3>
              <p className="text-sm text-muted-foreground">ID: {user.id}</p>
              <p className="text-sm text-muted-foreground">
                Registered: {user.createdAt.toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter first name"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter last name"
              />
            </div>

            {/* Email */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
              />
              <div className="mt-1 flex items-center">
                {user.emailVerified ? (
                  <span className="text-xs text-green-600">✓ Email verified</span>
                ) : (
                  <span className="text-xs text-red-600">✗ Email not verified</span>
                )}
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {USER_ROLES.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {USER_ROLES.find(r => r.value === formData.role)?.description}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Account Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {USER_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional Information */}
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">Additional Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-foreground">Phone Number:</span>
                <span className="ml-2 text-muted-foreground">
                  {user.phoneNumber || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="font-medium text-foreground">Last Login:</span>
                <span className="ml-2 text-muted-foreground">
                  {user.lastSignInAt ? user.lastSignInAt.toLocaleDateString() : 'Never'}
                </span>
              </div>
              <div>
                <span className="font-medium text-foreground">Account Created:</span>
                <span className="ml-2 text-muted-foreground">
                  {user.createdAt.toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="font-medium text-foreground">Email Verified:</span>
                <span className="ml-2 text-muted-foreground">
                  {user.emailVerified ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 pt-6 border-t border-border flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-foreground border border-input rounded hover:bg-muted/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
