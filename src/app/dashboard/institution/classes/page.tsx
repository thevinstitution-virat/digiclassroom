'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import { GraduationCap, Plus, Pencil, Trash2, ChevronRight, Loader2 } from 'lucide-react'

interface ClassItem {
  id: string
  name: string
  level: number | null
  sections: SectionItem[]
}

interface SectionItem {
  id: string
  name: string
  classId: string
}

export default function ClassesManagement() {
  const { user, isLoaded } = useBetterAuthUser()
  const router = useRouter()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddClassModal, setShowAddClassModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassLevel, setNewClassLevel] = useState('')
  const [addingSectionToClassId, setAddingSectionToClassId] = useState<string | null>(null)
  const [newSectionName, setNewSectionName] = useState('')
  const [saving, setSaving] = useState(false)

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/institution/classes')
      if (res.ok) {
        const data = await res.json()
        setClasses(data.classes || [])
      }
    } catch (err) {
      console.error('Failed to load classes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadClasses() }, [loadClasses])

  const handleAddClass = async () => {
    if (!newClassName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/institution/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName, level: newClassLevel ? parseInt(newClassLevel) : null })
      })
      if (res.ok) {
        setNewClassName('')
        setNewClassLevel('')
        setShowAddClassModal(false)
        loadClasses()
      }
    } catch (err) {
      console.error('Failed to add class:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddSection = async (classId: string) => {
    if (!newSectionName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/institution/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, name: newSectionName })
      })
      if (res.ok) {
        setNewSectionName('')
        setAddingSectionToClassId(null)
        loadClasses()
      }
    } catch (err) {
      console.error('Failed to add section:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Delete this class and all its sections? This cannot be undone.')) return
    try {
      await fetch(`/api/institution/classes?id=${classId}`, { method: 'DELETE' })
      loadClasses()
    } catch (err) {
      console.error('Failed to delete class:', err)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-emerald-500" />
            Classes & Sections
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage the academic hierarchy for your institution</p>
        </div>
        <button
          onClick={() => setShowAddClassModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Add New Class</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class Name</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Class 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level (optional)</label>
                <input
                  type="number"
                  value={newClassLevel}
                  onChange={(e) => setNewClassLevel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 10"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddClassModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleAddClass} disabled={saving || !newClassName.trim()} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classes List */}
      {classes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Classes Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Start by adding classes for your institution's academic structure.</p>
          <button
            onClick={() => setShowAddClassModal(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"
          >
            Create First Class
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Class Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                    {cls.level || '#'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cls.name}</h3>
                    <span className="text-xs text-gray-500">{cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddingSectionToClassId(addingSectionToClassId === cls.id ? null : cls.id)}
                    className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />Section
                  </button>
                  <button onClick={() => handleDeleteClass(cls.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sections */}
              {cls.sections.length > 0 && (
                <div className="px-6 py-3 divide-y divide-gray-100 dark:divide-gray-700">
                  {cls.sections.map((section) => (
                    <div key={section.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{section.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Section inline */}
              {addingSectionToClassId === cls.id && (
                <div className="px-6 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Section name (e.g. A, B, Science)"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSection(cls.id)}
                  />
                  <button onClick={() => handleAddSection(cls.id)} disabled={saving || !newSectionName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
                    Add
                  </button>
                  <button onClick={() => { setAddingSectionToClassId(null); setNewSectionName(''); }} className="px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
