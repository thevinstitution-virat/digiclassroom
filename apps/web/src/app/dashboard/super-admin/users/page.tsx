'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserProfile, UserListFilters, BulkUserAction, UserUpdateData, USER_ROLES } from '@/types/user-management'
import UserTable from '@/components/admin/users/UserTable'
import UserFilters from '@/components/admin/users/UserFilters'
import BulkActions from '@/components/admin/users/BulkActions'
import UserModal from '@/components/admin/users/UserModal'
import { Users, RefreshCw, X } from 'lucide-react'

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [totalUsers, setTotalUsers] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)

  // Add-user modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'student' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const [filters, setFilters] = useState<UserListFilters>({
    search: '', role: 'all', status: 'all',
    dateRange: { from: null, to: null }, sortBy: 'createdAt', sortOrder: 'desc',
  })

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(), limit: '20',
        search: filters.search, role: filters.role, status: filters.status,
        sortBy: filters.sortBy, sortOrder: filters.sortOrder,
      })
      const response = await fetch(`/api/super-admin/users?${params}`)
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

  useEffect(() => { fetchUsers(1) }, [fetchUsers])

  const handleFiltersChange = (newFilters: Partial<UserListFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(1)
  }
  const handleFiltersReset = () => {
    setFilters({ search: '', role: 'all', status: 'all', dateRange: { from: null, to: null }, sortBy: 'createdAt', sortOrder: 'desc' })
  }
  const handleSelectionChange = (userIds: string[]) => setSelectedUsers(userIds)

  const handleUserEdit = (user: UserProfile) => {
    setEditingUser(user)
    setShowUserModal(true)
  }

  const handleUserSave = async (userData: UserUpdateData) => {
    if (!editingUser) return
    try {
      const response = await fetch(`/api/super-admin/users/${editingUser.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData),
      })
      const result = await response.json()
      if (result.success) {
        setShowUserModal(false); setEditingUser(null); fetchUsers(currentPage)
      } else { alert('Failed to update user: ' + result.error) }
    } catch (error) {
      console.error('Error updating user:', error); alert('Error updating user')
    }
  }

  const handleUserDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
    try {
      const response = await fetch(`/api/super-admin/users/${userId}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) fetchUsers(currentPage)
      else alert('Failed to delete user: ' + result.error)
    } catch (error) {
      console.error('Error deleting user:', error); alert('Error deleting user')
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const response = await fetch(`/api/super-admin/users/${userId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
      })
      const result = await response.json()
      if (result.success) fetchUsers(currentPage)
      else alert('Failed to update role: ' + result.error)
    } catch (error) {
      console.error('Error updating role:', error); alert('Error updating role')
    }
  }

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const response = await fetch(`/api/super-admin/users/${userId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      })
      const result = await response.json()
      if (result.success) fetchUsers(currentPage)
      else alert('Failed to update status: ' + result.error)
    } catch (error) {
      console.error('Error updating status:', error); alert('Error updating status')
    }
  }

  const handleBulkAction = async (action: BulkUserAction) => {
    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/super-admin/users/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action),
      })
      const result = await response.json()
      if (result.success) {
        setSelectedUsers([]); fetchUsers(currentPage)
        if (result.data.failed > 0) {
          alert(`Completed: ${result.data.successful} succeeded, ${result.data.failed} failed.`)
        }
      } else { alert('Bulk action failed: ' + result.error) }
    } catch (error) {
      console.error('Error performing bulk action:', error); alert('Error performing bulk action')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleAddUser = async () => {
    setAddLoading(true); setAddError('')
    try {
      const res = await fetch('/api/super-admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm),
      })
      const result = await res.json()
      if (result.success) {
        setShowAddModal(false)
        setAddForm({ name: '', email: '', role: 'student' })
        fetchUsers(1)
      } else { setAddError(result.error || 'Failed to add user') }
    } catch {
      setAddError('Network error — please try again')
    } finally {
      setAddLoading(false)
    }
  }

  const handleNextPage = () => { if (hasNextPage) fetchUsers(currentPage + 1) }
  const handlePrevPage = () => { if (currentPage > 1) fetchUsers(currentPage - 1) }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-blue-600 text-white shadow-lg shadow-blue-600/20">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">User Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Every user across all institutions and direct sign-ups — roles, status &amp; access.
          </p>
        </div>
      </div>

      {/* User Management Content */}
      <div className="space-y-6 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Accounts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage accounts, roles, and permissions</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchUsers(currentPage)}
              disabled={loading}
              className="px-4 py-2 h-10 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 font-medium transition-all flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => { setAddError(''); setShowAddModal(true) }}
              className="px-6 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center"
            >
              <Users className="h-4 w-4 mr-2" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        <UserFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleFiltersReset}
          totalUsers={totalUsers}
          filteredUsers={users.length}
        />

        <BulkActions
          selectedUsers={selectedUsers}
          onBulkAction={handleBulkAction}
          loading={bulkActionLoading}
          onClearSelection={() => setSelectedUsers([])}
        />

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

      {/* Pagination */}
      {(currentPage > 1 || hasNextPage) && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-sm text-gray-700 dark:text-gray-300">Page {currentPage} · {totalUsers} users</div>
          <div className="flex space-x-2">
            <button onClick={handlePrevPage} disabled={currentPage === 1 || loading}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Previous</button>
            <button onClick={handleNextPage} disabled={!hasNextPage || loading}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      <UserModal
        user={editingUser}
        isOpen={showUserModal}
        onClose={() => { setShowUserModal(false); setEditingUser(null) }}
        onSave={handleUserSave}
        loading={loading}
      />

      {/* Add-user modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add User</h3>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Creates the account and emails a welcome / sign-in link.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Full name</label>
                <input value={addForm.name} onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Anita Sharma"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Role</label>
                <select value={addForm.role} onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                  {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleAddUser} disabled={addLoading || !addForm.email}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-blue-600 px-5 py-2 font-semibold text-white shadow disabled:opacity-50">
                {addLoading ? 'Adding…' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
