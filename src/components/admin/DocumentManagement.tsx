'use client'

import React, { useState } from 'react'
import {
  Trash2,
  RefreshCw,
  BookOpen,
  FileText,
  Database,
  AlertTriangle,
  CheckCircle,
  Search,
  Filter,
  Download,
  Loader2
} from 'lucide-react'
import useSWR from 'swr'

interface BookInfo {
  bookTitle: string
  classLevel: string
  subject: string
  curriculum: string
  language: string
  totalChunks: number
  totalPages: number
  uploadDate?: string
  hasFormulas: boolean
  hasTables: boolean
  bookId: string
}

interface Stats {
  totalPoints: number
  totalBooks: number
  uniqueSubjects: number
  uniqueClassLevels: number
  chunksWithFormulas: number
  chunksWithTables: number
  collectionName: string
  subjects: string[]
  classLevels: string[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DocumentManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [deletingBook, setDeletingBook] = useState<string | null>(null)
  const [clearingDatabase, setClearingDatabase] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Fetch books and stats
  const { data: booksData, error: booksError, isLoading: booksLoading, mutate: mutateBooks } = useSWR(
    '/api/admin/qdrant/books',
    fetcher,
    { refreshInterval: 10000 }
  )

  const { data: statsData, error: statsError, isLoading: statsLoading, mutate: mutateStats } = useSWR(
    '/api/admin/qdrant/stats',
    fetcher,
    { refreshInterval: 10000 }
  )

  const books: BookInfo[] = booksData?.books || []
  const stats: Stats | null = statsData?.stats || null

  // Filter books
  const filteredBooks = books.filter(book => {
    const matchesSearch = book.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         book.subject.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = !filterClass || book.classLevel === filterClass
    const matchesSubject = !filterSubject || book.subject === filterSubject
    return matchesSearch && matchesClass && matchesSubject
  })

  // Handle delete book
  const handleDeleteBook = async (bookId: string, bookTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${bookTitle}"?\n\nThis will remove all ${books.find(b => b.bookId === bookId)?.totalChunks || 0} chunks from the database.\n\nThis action cannot be undone.`)) {
      return
    }

    setDeletingBook(bookId)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/qdrant/books/${bookId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: `Successfully deleted "${bookTitle}" (${result.deletedCount} chunks)` })
        mutateBooks()
        mutateStats()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete book' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setDeletingBook(null)
    }
  }

  // Handle clear database
  const handleClearDatabase = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL documents from the vector database!\n\nThis action cannot be undone.\n\nAre you absolutely sure?')) {
      return
    }

    if (!confirm('This is your final confirmation. Type "DELETE ALL" in the next prompt to proceed.')) {
      return
    }

    const confirmation = prompt('Type "DELETE ALL" to confirm:')
    if (confirmation !== 'DELETE ALL') {
      alert('Confirmation failed. Database was not cleared.')
      return
    }

    setClearingDatabase(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/qdrant/clear', {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: `Successfully cleared database (${result.deletedCount} chunks deleted)` })
        mutateBooks()
        mutateStats()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to clear database' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setClearingDatabase(false)
    }
  }

  // Export books as CSV
  const handleExportCSV = () => {
    const csv = [
      ['Book Title', 'Class', 'Subject', 'Curriculum', 'Language', 'Chunks', 'Pages', 'Formulas', 'Tables', 'Upload Date'].join(','),
      ...filteredBooks.map(book => [
        `"${book.bookTitle}"`,
        book.classLevel,
        book.subject,
        book.curriculum,
        book.language,
        book.totalChunks,
        book.totalPages,
        book.hasFormulas ? 'Yes' : 'No',
        book.hasTables ? 'Yes' : 'No',
        book.uploadDate || 'Unknown'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qdrant-books-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Books</p>
              <p className="text-3xl font-bold text-blue-600">{stats?.totalBooks || 0}</p>
            </div>
            <BookOpen className="h-12 w-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Chunks</p>
              <p className="text-3xl font-bold text-green-600">{stats?.totalPoints || 0}</p>
            </div>
            <FileText className="h-12 w-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Subjects</p>
              <p className="text-3xl font-bold text-purple-600">{stats?.uniqueSubjects || 0}</p>
            </div>
            <Database className="h-12 w-12 text-purple-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Class Levels</p>
              <p className="text-3xl font-bold text-orange-600">{stats?.uniqueClassLevels || 0}</p>
            </div>
            <BookOpen className="h-12 w-12 text-orange-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Classes</option>
              {stats?.classLevels?.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              )) || null}
            </select>

            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Subjects</option>
              {stats?.subjects?.map(subj => (
                <option key={subj} value={subj}>{subj}</option>
              )) || null}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredBooks.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>

            <button
              onClick={() => { mutateBooks(); mutateStats(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              onClick={handleClearDatabase}
              disabled={clearingDatabase || books.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {clearingDatabase ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {booksLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading books...</p>
          </div>
        ) : booksError ? (
          <div className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <p className="text-red-600 dark:text-red-400">Failed to load books</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No books found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Book Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Curriculum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Chunks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Features</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredBooks.map((book) => (
                  <tr key={book.bookId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookOpen className="h-5 w-5 text-blue-500 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{book.bookTitle}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{book.language}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{book.classLevel}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{book.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{book.curriculum}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{book.totalChunks}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{book.totalPages}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {book.hasFormulas && (
                          <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded">Formulas</span>
                        )}
                        {book.hasTables && (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">Tables</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDeleteBook(book.bookId, book.bookTitle)}
                        disabled={deletingBook === book.bookId}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {deletingBook === book.bookId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredBooks.length} of {books.length} books
        {stats && ` • ${stats.totalPoints} total chunks in database`}
      </div>
    </div>
  )
}

