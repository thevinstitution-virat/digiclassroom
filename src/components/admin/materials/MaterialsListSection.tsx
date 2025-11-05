'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { EnhancedMaterial, MaterialSearchFilters, MaterialSortOptions } from '@/types/google-drive'

interface MaterialsListSectionProps {
  className?: string
}

interface MaterialsListState {
  materials: EnhancedMaterial[]
  loading: boolean
  error?: string
  filters: MaterialSearchFilters
  sortOptions: MaterialSortOptions
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  selectedMaterial?: EnhancedMaterial
}

export default function MaterialsListSection({ className }: MaterialsListSectionProps) {
  const [state, setState] = useState<MaterialsListState>({
    materials: [],
    loading: true,
    error: undefined,
    filters: {},
    sortOptions: { sortBy: 'title', sortOrder: 'asc' },
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchMaterials()
  }, [state.filters, state.sortOptions, state.pagination.page])

  const fetchMaterials = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }))

      const params = new URLSearchParams({
        page: state.pagination.page.toString(),
        limit: state.pagination.limit.toString(),
        sortBy: state.sortOptions.sortBy,
        sortOrder: state.sortOptions.sortOrder,
        ...Object.fromEntries(
          Object.entries(state.filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      })

      const response = await fetch(`/api/admin/materials?${params}`)
      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          materials: result.data,
          pagination: result.pagination,
          loading: false
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to fetch materials',
          loading: false
        }))
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to fetch materials',
        loading: false
      }))
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, searchQuery: query },
      pagination: { ...prev.pagination, page: 1 }
    }))
  }

  const handleFilterChange = (key: keyof MaterialSearchFilters, value: any) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
      pagination: { ...prev.pagination, page: 1 }
    }))
  }

  const handleSortChange = (sortBy: string) => {
    setState(prev => ({
      ...prev,
      sortOptions: {
        sortBy: sortBy as any,
        sortOrder: prev.sortOptions.sortBy === sortBy && prev.sortOptions.sortOrder === 'asc' ? 'desc' : 'asc'
      }
    }))
  }

  const handleApproval = async (materialId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/admin/materials/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId, action })
      })

      const result = await response.json()

      if (result.success) {
        fetchMaterials() // Refresh the list
      } else {
        console.error('Approval action failed:', result.error)
      }
    } catch (error) {
      console.error('Error performing approval action:', error)
    }
  }

  const handleDelete = async (materialId: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return

    try {
      const response = await fetch(`/api/admin/materials/${materialId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        fetchMaterials() // Refresh the list
      } else {
        console.error('Delete failed:', result.error)
      }
    } catch (error) {
      console.error('Error deleting material:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      pending_review: 'outline',
      approved: 'default',
      rejected: 'destructive',
      archived: 'secondary'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ')}
      </Badge>
    )
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading materials...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Materials Library</CardTitle>
              <CardDescription>
                Manage and review uploaded study materials
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
              >
                <Select
                  value={state.filters.board || ''}
                  onValueChange={(value) => handleFilterChange('board', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Boards" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Boards</SelectItem>
                    <SelectItem value="CBSE">CBSE</SelectItem>
                    <SelectItem value="ICSE">ICSE</SelectItem>
                    <SelectItem value="STATE_BOARD">State Board</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={state.filters.class?.toString() || ''}
                  onValueChange={(value) => handleFilterChange('class', value ? parseInt(value) : undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Classes</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()}>Class {num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={state.filters.type || ''}
                  onValueChange={(value) => handleFilterChange('type', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    <SelectItem value="notes">Notes</SelectItem>
                    <SelectItem value="summaries">Summaries</SelectItem>
                    <SelectItem value="mind_maps">Mind Maps</SelectItem>
                    <SelectItem value="quizzes">Quizzes</SelectItem>
                    <SelectItem value="textbooks">Textbooks</SelectItem>
                    <SelectItem value="reference">Reference</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={state.filters.status || ''}
                  onValueChange={(value) => handleFilterChange('status', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => handleSortChange('title')}
                >
                  Title
                </TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Board/Class</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => handleSortChange('date')}
                >
                  Created
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{material.title}</p>
                      {material.description && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {material.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{material.subject}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{material.board}</div>
                      <div className="text-gray-500">Class {material.class}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {material.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(material.status)}</TableCell>
                  <TableCell>{formatFileSize(material.fileSize)}</TableCell>
                  <TableCell>{material.downloadCount}</TableCell>
                  <TableCell>
                    {new Date(material.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      {material.status === 'pending_review' && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleApproval(material.id, 'approve')}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleApproval(material.id, 'reject')}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(material.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {state.materials.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No materials found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {state.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((state.pagination.page - 1) * state.pagination.limit) + 1} to{' '}
            {Math.min(state.pagination.page * state.pagination.limit, state.pagination.total)} of{' '}
            {state.pagination.total} materials
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={state.pagination.page === 1}
              onClick={() => setState(prev => ({
                ...prev,
                pagination: { ...prev.pagination, page: prev.pagination.page - 1 }
              }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={state.pagination.page === state.pagination.totalPages}
              onClick={() => setState(prev => ({
                ...prev,
                pagination: { ...prev.pagination, page: prev.pagination.page + 1 }
              }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
