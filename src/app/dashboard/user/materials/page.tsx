'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  Grid3X3,
  List,
  BookOpen,
  FileText,
  GraduationCap,
  Clock,
  Download,
  Eye,
  Bookmark,
  Tag,
  Sparkles,
  Crown,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import PDFViewer from '@/components/materials/PDFViewer'
import { MaterialItem, MaterialsFilter, OnboardingFormData, EnhancedUserProfile } from '@/types/user-management'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'

// Dashboard State Interface
interface DashboardState {
  materials: MaterialItem[]
  filteredMaterials: MaterialItem[]
  loading: boolean
  error: string | null
  selectedMaterial?: MaterialItem
  viewMode: 'grid' | 'list'
  sortBy: 'title' | 'date' | 'downloads' | 'relevance'
  sortOrder: 'asc' | 'desc'
}

// Material Card Component
interface MaterialCardProps {
  material: MaterialItem
  viewMode: 'grid' | 'list'
  onView: () => void
  onDownload: () => void
  getTypeIcon: (type: string) => any
  getTypeColor: (type: string) => string
}

function MaterialCard({
  material,
  viewMode,
  onView,
  onDownload,
  getTypeIcon,
  getTypeColor
}: MaterialCardProps) {
  const TypeIcon = getTypeIcon(material.type)

  if (viewMode === 'list') {
    return (
      <Card className="bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02]" onClick={onView}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 flex items-center justify-center shadow-lg">
                <TypeIcon className="h-7 w-7 text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-orange-600 transition-colors duration-200">
                {material.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
                {material.description}
              </p>
              <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">{material.subject}</span>
                <span>•</span>
                <span>{(material.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                <span>•</span>
                <span>{material.downloadCount} downloads</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex flex-wrap gap-2">
                {material.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} className="bg-gradient-to-r from-orange-500/10 to-blue-500/10 text-orange-600 border-orange-200 text-xs px-3 py-1 rounded-full">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); onView(); }} 
                  className="h-10 w-10 p-0 rounded-xl hover:bg-orange-50 hover:text-orange-600 transition-all duration-200"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); onDownload(); }} 
                  className="h-10 w-10 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-105" onClick={onView}>
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 flex items-center justify-center shadow-lg">
              <TypeIcon className="h-6 w-6 text-white" />
            </div>
            <Badge className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-200 text-xs px-3 py-1 rounded-full">
              {material.metadata.difficulty}
            </Badge>
          </div>

          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2 mb-3 group-hover:text-orange-600 transition-colors duration-200">
            {material.title}
          </h3>

          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
            {material.description}
          </p>
        </div>

        <div className="mt-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-200 text-xs px-3 py-1 rounded-full">
                {material.subject}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {material.type.replace('_', ' ')}
              </span>
            </div>

            {material.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {material.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 text-gray-600 border-gray-200 text-xs px-2 py-1 rounded-full">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {material.tags.length > 3 && (
                  <Badge className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 text-gray-600 border-gray-200 text-xs px-2 py-1 rounded-full">
                    +{material.tags.length - 3} more
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">{(material.fileSize / 1024 / 1024).toFixed(1)} MB</span>
              <span className="font-medium">{material.downloadCount} downloads</span>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-10 rounded-xl border-orange-200 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200"
                onClick={(e) => { e.stopPropagation(); onView(); }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button
                size="sm"
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MaterialsPage() {
  const { user } = useBetterAuthUser()
  const [userProfile, setUserProfile] = useState<EnhancedUserProfile | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPDFViewer, setShowPDFViewer] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')

  const [dashboardState, setDashboardState] = useState<DashboardState>({
    materials: [],
    filteredMaterials: [],
    loading: true,
    error: null,
    viewMode: 'grid',
    sortBy: 'relevance',
    sortOrder: 'desc'
  })

  const materialTypes = [
    { value: 'notes', label: 'Notes', icon: FileText },
    { value: 'summaries', label: 'Summaries', icon: BookOpen },
    { value: 'mind_maps', label: 'Mind Maps', icon: GraduationCap },
    { value: 'quizzes', label: 'Quizzes', icon: Clock },
    { value: 'textbooks', label: 'Textbooks', icon: BookOpen },
    { value: 'reference', label: 'Reference', icon: FileText }
  ]

  const getTypeIcon = (type: string) => {
    const typeConfig = materialTypes.find(t => t.value === type)
    return typeConfig?.icon || FileText
  }

  const getTypeColor = (type: string) => {
    const colors = {
      notes: 'bg-blue-50 text-blue-600',
      summaries: 'bg-green-50 text-green-600',
      mind_maps: 'bg-purple-50 text-purple-600',
      quizzes: 'bg-orange-50 text-orange-600',
      textbooks: 'bg-indigo-50 text-indigo-600',
      reference: 'bg-gray-50 text-gray-600'
    }
    return colors[type as keyof typeof colors] || colors.reference
  }

  const availableSubjects = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies']

  const fetchMaterials = async () => {
    // Mock data for demonstration
    const mockMaterials: MaterialItem[] = [
      {
        id: '1',
        title: 'Advanced Mathematics Notes',
        description: 'Comprehensive notes covering algebra, geometry, and calculus',
        subject: 'Mathematics',
        type: 'notes',
        fileUrl: '/materials/math-notes.pdf',
        fileSize: 2048000,
        downloadCount: 156,
        tags: ['algebra', 'geometry', 'calculus'],
        metadata: {
          difficulty: 'medium',
          duration: '2 hours',
          author: 'Dr. Smith'
        }
      }
    ]

    setDashboardState(prev => ({
      ...prev,
      materials: mockMaterials,
      filteredMaterials: mockMaterials,
      loading: false
    }))
  }

  const handleMaterialClick = (material: MaterialItem) => {
    setDashboardState(prev => ({ ...prev, selectedMaterial: material }))
    setShowPDFViewer(true)
  }

  const handleDownload = (material: MaterialItem) => {
    console.log('Downloading:', material.title)
  }

  useEffect(() => {
    fetchMaterials()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Study Materials
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {userProfile ? `Access your ${userProfile.board} Class ${userProfile.class} materials` : 'Access your study materials'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {userProfile && (
            <>
              <Badge variant="outline" className="text-xs">
                {userProfile.board} • Class {userProfile.class}
              </Badge>
              {userProfile.stream && (
                <Badge variant="outline" className="text-xs">
                  {userProfile.stream}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-md border border-white/20 dark:border-gray-700/20">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search materials, topics, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {availableSubjects.map(subject => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {materialTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-1 border rounded-md">
              <Button
                variant={dashboardState.viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDashboardState(prev => ({ ...prev, viewMode: 'grid' }))}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={dashboardState.viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDashboardState(prev => ({ ...prev, viewMode: 'list' }))}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Materials Grid/List */}
      {dashboardState.loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading materials...</p>
          </div>
        </div>
      ) : dashboardState.error ? (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-md border border-white/20 dark:border-gray-700/20 text-center">
          <div className="h-16 w-16 mx-auto mb-4 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
            <FileText className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Error Loading Materials
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {dashboardState.error}
          </p>
          <Button
            onClick={fetchMaterials}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-sm"
          >
            Try Again
          </Button>
        </div>
      ) : dashboardState.filteredMaterials.length === 0 ? (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-md border border-white/20 dark:border-gray-700/20 text-center">
          <div className="h-16 w-16 mx-auto mb-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Materials Found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      ) : (
        <div className={`grid gap-6 ${
          dashboardState.viewMode === 'grid' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
            : 'grid-cols-1'
        }`}>
          {dashboardState.filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              viewMode={dashboardState.viewMode}
              onView={() => handleMaterialClick(material)}
              onDownload={() => handleDownload(material)}
              getTypeIcon={getTypeIcon}
              getTypeColor={getTypeColor}
            />
          ))}
        </div>
      )}

      {/* PDF Viewer Modal */}
      {showPDFViewer && dashboardState.selectedMaterial && (
        <PDFViewer
          material={dashboardState.selectedMaterial}
          isOpen={showPDFViewer}
          onClose={() => setShowPDFViewer(false)}
          onDownload={() => handleDownload(dashboardState.selectedMaterial!)}
        />
      )}
    </div>
  )
}
