'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Eye,
  Download,
  Shield,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'

// Types
interface VerificationDocument {
  id: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  documentType: string
  fileName: string
  fileSize: number
  filePath: string
  mimeType: string
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  uploadedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  rejectionReason: string | null
  verificationStatus: string
  emailDomain: string | null
  isEducationalDomain: boolean
}

interface PageState {
  documents: VerificationDocument[]
  loading: boolean
  error: string | null
  filter: 'all' | 'pending' | 'approved' | 'rejected'
  searchQuery: string
  selectedDocument: VerificationDocument | null
  showReviewDialog: boolean
  reviewAction: 'approve' | 'reject' | null
  rejectionReason: string
  submitting: boolean
}

export default function TeacherVerificationPage() {
  const [state, setState] = useState<PageState>({
    documents: [],
    loading: true,
    error: null,
    filter: 'pending',
    searchQuery: '',
    selectedDocument: null,
    showReviewDialog: false,
    reviewAction: null,
    rejectionReason: '',
    submitting: false
  })

  useEffect(() => {
    fetchDocuments()
  }, [state.filter])

  const fetchDocuments = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const params = new URLSearchParams({
        status: state.filter === 'all' ? '' : state.filter
      })
      
      const response = await fetch(`/api/super-admin/teacher-verification/documents?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          documents: result.data.documents,
          loading: false
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to fetch documents',
          loading: false
        }))
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to fetch documents',
        loading: false
      }))
    }
  }

  const handleReviewClick = (document: VerificationDocument, action: 'approve' | 'reject') => {
    setState(prev => ({
      ...prev,
      selectedDocument: document,
      reviewAction: action,
      showReviewDialog: true,
      rejectionReason: ''
    }))
  }

  const handleReviewSubmit = async () => {
    if (!state.selectedDocument || !state.reviewAction) return
    
    // Validate rejection reason
    if (state.reviewAction === 'reject' && !state.rejectionReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }

    try {
      setState(prev => ({ ...prev, submitting: true }))
      
      const response = await fetch('/api/super-admin/teacher-verification/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: state.selectedDocument.id,
          teacherId: state.selectedDocument.teacherId,
          action: state.reviewAction,
          rejectionReason: state.reviewAction === 'reject' ? state.rejectionReason : undefined
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Close dialog and refresh list
        setState(prev => ({
          ...prev,
          showReviewDialog: false,
          selectedDocument: null,
          reviewAction: null,
          rejectionReason: '',
          submitting: false
        }))
        
        // Refresh documents list
        fetchDocuments()
      } else {
        alert(`Failed to ${state.reviewAction} document: ${result.error}`)
        setState(prev => ({ ...prev, submitting: false }))
      }
    } catch (error) {
      console.error('Error reviewing document:', error)
      alert('Failed to submit review')
      setState(prev => ({ ...prev, submitting: false }))
    }
  }

  const handleViewDocument = (document: VerificationDocument) => {
    // Open document in new tab
    window.open(`/api/super-admin/teacher-verification/view/${document.id}`, '_blank')
  }

  // Filter documents by search query
  const filteredDocuments = state.documents.filter(doc => {
    if (!state.searchQuery)
  return true
    const query = state.searchQuery.toLowerCase()
    return (
      doc.teacherName.toLowerCase().includes(query) ||
      doc.teacherEmail.toLowerCase().includes(query) ||
      doc.documentType.toLowerCase().includes(query)
    )
  })

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  // Get verification status badge
  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'unverified':
        return <Badge variant="outline" className="text-muted-foreground">Unverified</Badge>
      case 'verified_email':
        return <Badge className="bg-primary/15 text-primary border-primary/40">Email Verified</Badge>
      case 'verified_document':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Document Verified</Badge>
      case 'verified_manual':
        return <Badge className="bg-primary/15 text-primary border-primary/40">Manually Verified</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024)
  return `${bytes} B`
    if (bytes < 1024 * 1024)
  return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Teacher Verification Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Review and approve teacher verification documents
            </p>
          </div>
          
          <Button
            onClick={fetchDocuments}
            disabled={state.loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                <Button
                  key={filter}
                  onClick={() => setState(prev => ({ ...prev, filter }))}
                  variant={state.filter === filter ? 'default' : 'outline'}
                  size="sm"
                  className="capitalize"
                >
                  {filter}
                </Button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by teacher name, email, or document type..."
                  value={state.searchQuery}
                  onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {state.error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <span>{state.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Documents</CardTitle>
          <CardDescription>
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground/60 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No documents found</h3>
              <p className="text-muted-foreground">
                {state.filter === 'pending' 
                  ? 'No pending verification documents' 
                  : `No ${state.filter} documents found`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Verification Status</TableHead>
                    <TableHead>Document Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{doc.teacherName}</div>
                          <div className="text-sm text-muted-foreground">{doc.teacherEmail}</div>
                          {doc.isEducationalDomain && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {doc.emailDomain}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {doc.documentType.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium truncate max-w-[200px]">{doc.fileName}</div>
                          <div className="text-muted-foreground">{formatFileSize(doc.fileSize)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getVerificationBadge(doc.verificationStatus)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(doc.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.uploadedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleViewDocument(doc)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          {doc.status === 'pending' && (
                            <>
                              <Button
                                onClick={() => handleReviewClick(doc, 'approve')}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                onClick={() => handleReviewClick(doc, 'reject')}
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={state.showReviewDialog} onOpenChange={(open) => {
        if (!open) {
          setState(prev => ({
            ...prev,
            showReviewDialog: false,
            selectedDocument: null,
            reviewAction: null,
            rejectionReason: ''
          }))
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {state.reviewAction === 'approve' ? 'Approve' : 'Reject'} Verification Document
            </DialogTitle>
            <DialogDescription>
              {state.reviewAction === 'approve' 
                ? 'This will upgrade the teacher to "Document Verified" status.'
                : 'Please provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>
          
          {state.selectedDocument && (
            <div className="space-y-4">
              <div className="bg-muted/40 p-4 rounded-lg space-y-2">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Teacher:</span>
                  <p className="font-medium">{state.selectedDocument.teacherName}</p>
                  <p className="text-sm text-muted-foreground">{state.selectedDocument.teacherEmail}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Document:</span>
                  <p className="capitalize">{state.selectedDocument.documentType.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-muted-foreground">{state.selectedDocument.fileName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Current Status:</span>
                  <div className="mt-1">{getVerificationBadge(state.selectedDocument.verificationStatus)}</div>
                </div>
              </div>

              {state.reviewAction === 'reject' && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Rejection Reason *
                  </label>
                  <Textarea
                    value={state.rejectionReason}
                    onChange={(e) => setState(prev => ({ ...prev, rejectionReason: e.target.value }))}
                    placeholder="Please explain why this document is being rejected..."
                    rows={4}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setState(prev => ({
                ...prev,
                showReviewDialog: false,
                selectedDocument: null,
                reviewAction: null,
                rejectionReason: ''
              }))}
              disabled={state.submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={state.submitting}
              className={state.reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {state.submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {state.reviewAction === 'approve' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

