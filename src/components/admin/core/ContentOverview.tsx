'use client'

import { useState } from 'react'
import {
  Database,
  RefreshCw,
  Search,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'
import useSWR from 'swr'

interface UploadedBook {
  id: string
  book_title: string
  subject: string
  class: string
  board: string
  medium: string
  total_pages: number
  total_chunks: number
  chapters_count: number
  status: 'complete' | 'in_progress' | 'failed'
  upload_date: string
  processing_time?: string
  estimated_size: string
  chapters: string[]
}

interface ContentOverviewProps {
  isActive?: boolean
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ContentOverview({ isActive = true }: ContentOverviewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const booksPerPage = 10

  // Use SWR for real-time data fetching with auto-refresh
  const { data: booksData, error: booksError, isLoading: booksLoading, mutate: mutateBooks } = useSWR(
    isActive ? '/api/super-admin/qdrant/books' : null,
    fetcher,
    {
      refreshInterval: 10000, // Auto-refresh every 10 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  )

  const { data: statsData, error: statsError, isLoading: statsLoading, mutate: mutateStats } = useSWR(
    isActive ? '/api/super-admin/qdrant/stats' : null,
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  )

  // Transform API data to match UploadedBook interface
  const uploadedBooks: UploadedBook[] = booksData?.books?.map((book: any) => ({
    id: book.bookId,
    book_title: book.bookTitle,
    subject: book.subject,
    class: book.classLevel,
    board: book.curriculum,
    medium: book.language,
    total_pages: book.totalPages,
    total_chunks: book.totalChunks,
    chapters_count: 0, // Not available in API response
    status: 'complete' as const,
    upload_date: book.uploadDate || new Date().toISOString(),
    estimated_size: `${(book.totalChunks * 0.5).toFixed(1)} KB`,
    chapters: []
  })) || []

  const stats = statsData?.stats || null

  // Handle book actions
  const handleViewBook = (bookId: string) => {
    // Open Qdrant collection viewer or detailed view
    window.open(`http://localhost:6333/collections/ncert-books-enhanced`, '_blank')
  }

  const handleDeleteBook = async (bookId: string, bookTitle: string) => {
    if (confirm(`Are you sure you want to delete "${bookTitle}"?\n\nThis action cannot be undone.`)) {
      try {
        const response = await fetch(`/api/super-admin/qdrant/books/${bookId}`, {
          method: 'DELETE'
        })
        const result = await response.json()
        if (result.success) {
          mutateBooks() // Refresh the list using SWR
          mutateStats() // Refresh stats
          alert(`Successfully deleted "${bookTitle}" (${result.deletedCount} chunks)`)
        } else {
          alert('Failed to delete book: ' + (result.error || 'Unknown error'))
        }
      } catch (error) {
        console.error('Error deleting book:', error)
        alert('Error deleting book')
      }
    }
  }

  const handleRefresh = () => {
    mutateBooks()
    mutateStats()
  }

  // Filter and paginate books
  const filteredBooks = uploadedBooks.filter(book =>
    book.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.class.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.board.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.medium.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredBooks.length / booksPerPage)
  const startIndex = (currentPage - 1) * booksPerPage
  const paginatedBooks = filteredBooks.slice(startIndex, startIndex + booksPerPage)

  // Don't render anything if not active
  if (!isActive) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Uploaded Content Overview
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Manage and monitor all uploaded textbooks
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={booksLoading}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${booksLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search books by title, subject, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
          />
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
        {booksLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading uploaded books...</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Auto-refreshing every 10 seconds...</p>
          </div>
        ) : booksError ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <p className="text-red-600 dark:text-red-400">Failed to load books</p>
            <button onClick={handleRefresh} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Retry
            </button>
          </div>
        ) : paginatedBooks.length === 0 ? (
          <div className="p-8 text-center">
            <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Books Found</h3>
            <p className="text-gray-500 dark:text-gray-500">
              {searchTerm ? 'No books match your search criteria.' : 'Upload your first textbook to get started.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Book Details</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Content Stats</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chapters</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Upload Date</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {paginatedBooks.map((book) => (
                    <tr key={book.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{book.book_title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {book.subject} • Class {book.class} • {book.board} • {book.medium}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Pages:</span>
                            <span className="font-medium">{book.total_pages}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Chunks:</span>
                            <span className="font-medium">{book.total_chunks}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Size:</span>
                            <span className="font-medium">{book.estimated_size}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {book.chapters_count} chapters
                          </span>
                          {book.status === 'complete' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(book.upload_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewBook(book.id)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors duration-200"
                            title="View in Qdrant"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBook(book.id, book.book_title)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors duration-200"
                            title="Delete Book"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {startIndex + 1} to {Math.min(startIndex + booksPerPage, filteredBooks.length)} of {filteredBooks.length} books
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
