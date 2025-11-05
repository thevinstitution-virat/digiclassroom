'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserProfile, UserListFilters, BulkUserAction, UserUpdateData } from '@/types/user-management'
import UserTable from '@/components/admin/users/UserTable'
import UserFilters from '@/components/admin/users/UserFilters'
import BulkActions from '@/components/admin/users/BulkActions'
import UserModal from '@/components/admin/users/UserModal'
import UserSyncPanel from '@/components/admin/UserSyncPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Database, RefreshCw } from 'lucide-react'

export default function UserManagementPage() {
  // State management
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [totalUsers, setTotalUsers] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [activeTab, setActiveTab] = useState('users')

  // Filters state
  const [filters, setFilters] = useState<UserListFilters>({
    search: '',
    role: 'all',
    status: 'all',
    dateRange: { from: null, to: null },
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  // Fetch users function
  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: filters.search,
        role: filters.role,
        status: filters.status,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      })

      const response = await fetch(`/api/admin/users?${params}`)
      const result = await response.json()

      if (result.success) {
        setUsers(result.data.users)
        setTotalUsers(result.data.totalCount)
        setHasNextPage(result.data.hasNextPage)
        setCurrentPage(page)
      } else {
        console.error('Failed to fetch users:', result.error)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Initial load and filter changes
  useEffect(() => {
    fetchUsers(1)
  }, [fetchUsers])

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<UserListFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(1)
  }

  // Handle filter reset
  const handleFiltersReset = () => {
    setFilters({
      search: '',
      role: 'all',
      status: 'all',
      dateRange: { from: null, to: null },
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  }

  // Handle user selection
  const handleSelectionChange = (userIds: string[]) => {
    setSelectedUsers(userIds)
  }

  // Handle user edit
  const handleUserEdit = (user: UserProfile) => {
    setEditingUser(user)
    setShowUserModal(true)
  }

  // Handle user save
  const handleUserSave = async (userData: UserUpdateData) => {
    if (!editingUser) return

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })

      const result = await response.json()

      if (result.success) {
        setShowUserModal(false)
        setEditingUser(null)
        fetchUsers(currentPage) // Refresh current page
      } else {
        console.error('Failed to update user:', result.error)
        alert('Failed to update user: ' + result.error)
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Error updating user')
    }
  }

  // Handle user delete
  const handleUserDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers(currentPage) // Refresh current page
      } else {
        console.error('Failed to delete user:', result.error)
        alert('Failed to delete user: ' + result.error)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
    }
  }

  // Handle role change
  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers(currentPage) // Refresh current page
      } else {
        console.error('Failed to update role:', result.error)
        alert('Failed to update role: ' + result.error)
      }
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Error updating role')
    }
  }

  // Handle status change
  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers(currentPage) // Refresh current page
      } else {
        console.error('Failed to update status:', result.error)
        alert('Failed to update status: ' + result.error)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status')
    }
  }

  // Handle bulk actions
  const handleBulkAction = async (action: BulkUserAction) => {
    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
      })

      const result = await response.json()

      if (result.success) {
        setSelectedUsers([]) // Clear selection
        fetchUsers(currentPage) // Refresh current page
        
        if (result.data.failed.length > 0) {
          alert(`Action completed with some errors. ${result.data.successful} successful, ${result.data.failed.length} failed.`)
        }
      } else {
        console.error('Bulk action failed:', result.error)
        alert('Bulk action failed: ' + result.error)
      }
    } catch (error) {
      console.error('Error performing bulk action:', error)
      alert('Error performing bulk action')
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Handle pagination
  const handleNextPage = () => {
    if (hasNextPage) {
      fetchUsers(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      fetchUsers(currentPage - 1)
    }
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Manage user accounts, roles, permissions, and synchronization
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/20 dark:border-gray-700/20">
          <TabsList className="grid grid-cols-2 gap-4 bg-transparent">
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl h-12"
            >
              <Users className="h-5 w-5 mr-2" />
              <span>User Management</span>
            </TabsTrigger>
            <TabsTrigger
              value="sync"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl h-12"
            >
              <Database className="h-5 w-5 mr-2" />
              <span>User Synchronization</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="space-y-6">
          {/* User Management Content */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  User Accounts
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage user accounts, roles, and permissions
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchUsers(currentPage)}
                  disabled={loading}
                  className="px-4 py-2 h-10 rounded-xl border-gray-200 hover:border-gray-400 hover:bg-gray-50 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                <button className="px-6 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span>Invite User</span>
                </button>
              </div>
            </div>

            {/* Filters */}
            <UserFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onReset={handleFiltersReset}
              totalUsers={totalUsers}
              filteredUsers={users.length}
            />

            {/* Bulk Actions */}
            <BulkActions
              selectedUsers={selectedUsers}
              onBulkAction={handleBulkAction}
              loading={bulkActionLoading}
              onClearSelection={() => setSelectedUsers([])}
            />

            {/* User Table */}
            <UserTable
              users={users}
              loading={loading}
              selectedUsers={selectedUsers}
              onSelectionChange={handleSelectionChange}
              onUserEdit={handleUserEdit}
              onUserDelete={handleUserDelete}
              onRoleChange={handleRoleChange}
              onStatusChange={handleStatusChange}
            />
          </div>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <UserSyncPanel />
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {(currentPage > 1 || hasNextPage) && (
        <div className="flex items-center justify-between bg-white px-6 py-3 border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-700">
            Page {currentPage} of users
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasNextPage || loading}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* User Edit Modal */}
      <UserModal
        user={editingUser}
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false)
          setEditingUser(null)
        }}
        onSave={handleUserSave}
        loading={loading}
      />
    </div>
  )
}
