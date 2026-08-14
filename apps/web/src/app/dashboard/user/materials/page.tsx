'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  Grid3X3,
  List,
  BookOpen,
  FileText,
  GraduationCap,
  Clock,
  Download,
  Eye,
  Tag,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PDFViewer from '@/components/materials/PDFViewer'
import { MaterialItem, EnhancedUserProfile } from '@/types/user-management'
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

const TYPE_GRAD: Record<string, string> = {
  notes: 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))',
  summaries: 'linear-gradient(135deg,var(--teal-light),var(--peacock-teal))',
  mind_maps: 'linear-gradient(135deg,var(--lotus-deep),var(--lotus-pink))',
  quizzes: 'linear-gradient(135deg,var(--kumkum),var(--saffron))',
  textbooks: 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))',
  reference: 'linear-gradient(135deg,var(--turmeric),var(--gold))',
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

function MaterialCard({ material, viewMode, onView, onDownload, getTypeIcon }: MaterialCardProps) {
  const TypeIcon = getTypeIcon(material.type)
  const grad = TYPE_GRAD[material.type] || TYPE_GRAD.reference

  if (viewMode === 'list') {
    return (
      <div className="card lift" style={{ padding: 18, cursor: 'pointer' }} onClick={onView}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="plinth" style={{ width: 48, height: 48, flex: 'none', background: grad }}>
            <TypeIcon className="h-6 w-6" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{material.title}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{material.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
              <span style={{ fontWeight: 600 }}>{material.subject}</span><span>·</span>
              <span>{(material.fileSize / 1024 / 1024).toFixed(1)} MB</span><span>·</span>
              <span>{material.downloadCount} downloads</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onView() }} aria-label="View"><Eye className="h-4 w-4" /></button>
            <button className="iconbtn" onClick={(e) => { e.stopPropagation(); onDownload() }} aria-label="Download"><Download className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card lift" style={{ padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={onView}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="plinth" style={{ width: 44, height: 44, background: grad }}>
          <TypeIcon className="h-[22px] w-[22px]" />
        </span>
        <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)', textTransform: 'capitalize' }}>{material.metadata.difficulty}</span>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>{material.subject}</div>
      <h4 style={{ margin: '4px 0 3px', fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{material.title}</h4>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{material.description}</p>

      {material.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {material.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag" style={{ background: 'var(--panel-2)', color: 'var(--muted)', border: '1px solid var(--line)' }}>
              <Tag className="h-3 w-3" /> {t}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 14, marginTop: 'auto' }}>
        <span style={{ fontWeight: 600 }}>{(material.fileSize / 1024 / 1024).toFixed(1)} MB</span>
        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{material.type.replace('_', ' ')}</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onView() }}>
          <Eye className="h-4 w-4" /> View
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onDownload() }}>
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
    </div>
  )
}

export default function MaterialsPage() {
  const { user } = useBetterAuthUser()
  const [userProfile, setUserProfile] = useState<EnhancedUserProfile | null>(null)
  const [showPDFViewer, setShowPDFViewer] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

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

  const subjectChips = ['all', ...availableSubjects]

  return (
    <div className="dcs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(20px,2.4vw,26px)', fontWeight: 800, color: 'var(--ink)' }}>Study Materials</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              {userProfile ? `Access your ${userProfile.board} Class ${userProfile.class} materials` : 'Access your study materials'}
            </p>
          </div>
          {userProfile && (
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)' }}>{userProfile.board} · Class {userProfile.class}</span>
              {userProfile.stream && <span className="tag" style={{ background: 'var(--panel-2)', color: 'var(--muted)', border: '1px solid var(--line)' }}>{userProfile.stream}</span>}
            </div>
          )}
        </div>

        {/* Subject chips + search + controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {subjectChips.map((s) => (
              <button key={s} className={`chip ${selectedSubject === s ? 'on' : ''}`} onClick={() => setSelectedSubject(s)}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: 200, maxWidth: 280, flex: 1 }}>
              <Search className="h-[19px] w-[19px]" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="field"
                style={{ paddingLeft: 40 }}
                placeholder="Search materials…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {materialTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="iconbtn" onClick={() => setDashboardState(prev => ({ ...prev, viewMode: 'grid' }))} aria-label="Grid view" style={{ background: dashboardState.viewMode === 'grid' ? 'var(--chip-bg)' : 'var(--panel)', color: dashboardState.viewMode === 'grid' ? 'var(--accent-text)' : 'var(--ink)' }}>
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button className="iconbtn" onClick={() => setDashboardState(prev => ({ ...prev, viewMode: 'list' }))} aria-label="List view" style={{ background: dashboardState.viewMode === 'list' ? 'var(--chip-bg)' : 'var(--panel)', color: dashboardState.viewMode === 'list' ? 'var(--accent-text)' : 'var(--ink)' }}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Materials Grid/List */}
        {dashboardState.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spin" style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%', border: '3px solid var(--line)', borderBottomColor: 'var(--accent-primary)' }} />
              <p style={{ color: 'var(--muted)' }}>Loading materials…</p>
            </div>
          </div>
        ) : dashboardState.error ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <span className="plinth" style={{ width: 56, height: 56, margin: '0 auto 14px', background: 'linear-gradient(135deg,var(--kumkum),var(--lotus-deep))' }}>
              <FileText className="h-7 w-7" />
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>Error loading materials</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>{dashboardState.error}</p>
            <button className="btn btn-primary" onClick={fetchMaterials}>Try again</button>
          </div>
        ) : dashboardState.filteredMaterials.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <span className="plinth" style={{ width: 56, height: 56, margin: '0 auto 14px', background: 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))' }}>
              <BookOpen className="h-7 w-7" />
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>No materials found</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: dashboardState.viewMode === 'grid' ? 'repeat(auto-fill,minmax(250px,1fr))' : '1fr', gap: 16 }}>
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
      </div>

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
