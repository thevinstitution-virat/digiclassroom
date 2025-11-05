'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, UserMinus, BookOpen, X } from 'lucide-react'

interface Student {
  id: string
  email: string
  firstName: string
  lastName: string
  classId: string | null
  className: string | null
  gradeLevel: number | null
  enrolledAt: string
}

interface TeacherClass {
  id: string
  name: string
  gradeLevel: number
  studentCount: number
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [assignToClass, setAssignToClass] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass)
    } else {
      fetchStudents()
    }
  }, [selectedClass])

  const fetchData = async () => {
    try {
      // Fetch classes
      const classesRes = await fetch('/api/teacher/classes')
      const classesData = await classesRes.json()
      if (classesData.success) {
        setClasses(classesData.data.classes)
      }

      // Fetch all students
      const studentsRes = await fetch('/api/teacher/students')
      const studentsData = await studentsRes.json()
      if (studentsData.success) {
        setStudents(studentsData.data.students)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async (classId?: string) => {
    try {
      const url = classId ? `/api/teacher/students?classId=${classId}` : '/api/teacher/students'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setStudents(data.data.students)
      }
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/teacher/students/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent,
          classId: assignToClass,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setShowAssignModal(false)
        setSelectedStudent('')
        setAssignToClass('')
        fetchData()
      } else {
        alert(data.error || 'Failed to assign student')
      }
    } catch (error) {
      console.error('Error assigning student:', error)
      alert('Failed to assign student')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveStudent = async (studentId: string, classId: string) => {
    if (!confirm('Are you sure you want to remove this student from the class?')) return

    try {
      const response = await fetch('/api/teacher/students/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, classId }),
      })

      const data = await response.json()

      if (data.success) {
        fetchData()
      } else {
        alert(data.error || 'Failed to remove student')
      }
    } catch (error) {
      console.error('Error removing student:', error)
      alert('Failed to remove student')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-600 mt-2">View and manage students in your classes</p>
        </div>
        <Button onClick={() => setShowAssignModal(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Assign Student
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} (Grade {cls.gradeLevel})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      {students.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-600 mb-4">
              {selectedClass ? 'No students in this class yet' : 'Assign students to your classes to get started'}
            </p>
            <Button onClick={() => setShowAssignModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Student
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Students ({students.length})</CardTitle>
            <CardDescription>
              {selectedClass ? 'Students in selected class' : 'All students across your classes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {student.firstName[0]}{student.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {student.firstName} {student.lastName}
                      </h4>
                      <p className="text-sm text-gray-600">{student.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {student.className && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <BookOpen className="h-4 w-4" />
                        <span>{student.className}</span>
                      </div>
                    )}
                    {student.classId && (
                      <button
                        onClick={() => handleRemoveStudent(student.id, student.classId!)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from class"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Student Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Assign Student to Class</CardTitle>
                <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription>Select a student and class to assign</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAssignStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student *
                  </label>
                  <select
                    required
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName} ({student.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class *
                  </label>
                  <select
                    required
                    value={assignToClass}
                    onChange={(e) => setAssignToClass(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} (Grade {cls.gradeLevel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? 'Assigning...' : 'Assign Student'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

