'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, Calendar as CalendarIcon, Check, X, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export default function TeacherAttendancePage() {
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [date, setDate] = useState<Date>(new Date())
  const [attendanceType, setAttendanceType] = useState<'regular' | 'live'>('regular')

  const [students, setStudents] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'present'|'absent'|'late'>>({})

  // Fetch classes
  useEffect(() => {
    fetch('/api/teacher/classes')
      .then(r => r.json())
      .then(d => {
        if (d.data?.items) {
          setClasses(d.data.items)
          if (d.data.items.length > 0) setSelectedClassId(d.data.items[0].id)
        }
      })
  }, [])

  // Fetch students for selected class
  useEffect(() => {
    if (!selectedClassId) return
    setLoadingStudents(true)
    fetch(`/api/teacher/students?classId=${selectedClassId}`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.students) {
          setStudents(d.data.students)
          // Default all to present initially if no record exists
          const initialMap: Record<string, 'present'|'absent'|'late'> = {}
          d.data.students.forEach((s: any) => initialMap[s.id] = 'present')
          setAttendanceMap(initialMap)
        }
      })
      .finally(() => setLoadingStudents(false))
  }, [selectedClassId])

  const dateStr = format(date, 'yyyy-MM-dd')

  const { data: existingRecords, isLoading: loadingRecords, refetch } = api.attendance.getAttendanceRecords.useQuery(
    { classId: selectedClassId || '', date: dateStr, type: attendanceType },
    { enabled: !!selectedClassId }
  )

  // Merge existing records into the local state
  useEffect(() => {
    if (existingRecords?.records && existingRecords.records.length > 0) {
      setAttendanceMap(prev => {
        const next = { ...prev }
        existingRecords.records.forEach(r => {
          next[r.user_id] = r.status
        })
        return next
      })
    }
  }, [existingRecords])

  const markAttendance = api.attendance.markAttendance.useMutation({
    onSuccess: () => {
      refetch()
      alert("Attendance saved successfully!")
    },
    onError: (err) => {
      alert(`Failed to save attendance: ${err.message}`)
    }
  })

  const handleSave = () => {
    if (!selectedClassId) return
    const records = Object.entries(attendanceMap).map(([userId, status]) => ({
      userId,
      status
    }))
    markAttendance.mutate({ classId: selectedClassId, date: dateStr, type: attendanceType, records })
  }

  const handleMarkAll = (status: 'present' | 'absent' | 'late') => {
    setAttendanceMap(prev => {
      const next = { ...prev }
      students.forEach(s => next[s.id] = status)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-2">Log student attendance for your classes.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Class</label>
              <Select value={selectedClassId || ''} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
              <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={dateStr}
                onChange={(e) => setDate(new Date(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Session Type</label>
              <Select value={attendanceType} onValueChange={(v: any) => setAttendanceType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Session Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular Offline Class</SelectItem>
                  <SelectItem value="live">Live Online Class</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClassId ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Student List</CardTitle>
              <CardDescription>Mark attendance for {format(date, "PPP")}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleMarkAll('present')}>All Present</Button>
              <Button variant="outline" size="sm" onClick={() => handleMarkAll('absent')}>All Absent</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStudents || loadingRecords ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : students.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                No students enrolled in this class.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg divide-y">
                  {students.map(student => (
                    <div key={student.id} className="flex items-center justify-between p-4 hover:bg-muted/40">
                      <div>
                        <p className="font-medium">{student.firstName} {student.lastName}</p>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                        <Button
                          type="button"
                          variant={attendanceMap[student.id] === 'present' ? 'default' : 'ghost'}
                          size="sm"
                          className={cn("w-24", attendanceMap[student.id] === 'present' && "bg-green-600 hover:bg-green-700")}
                          onClick={() => setAttendanceMap(prev => ({...prev, [student.id]: 'present'}))}
                        >
                          <Check className="mr-1 h-4 w-4" /> Present
                        </Button>
                        <Button
                          type="button"
                          variant={attendanceMap[student.id] === 'late' ? 'default' : 'ghost'}
                          size="sm"
                          className={cn("w-24", attendanceMap[student.id] === 'late' && "bg-yellow-500 hover:bg-yellow-600")}
                          onClick={() => setAttendanceMap(prev => ({...prev, [student.id]: 'late'}))}
                        >
                          <Clock className="mr-1 h-4 w-4" /> Late
                        </Button>
                        <Button
                          type="button"
                          variant={attendanceMap[student.id] === 'absent' ? 'default' : 'ghost'}
                          size="sm"
                          className={cn("w-24", attendanceMap[student.id] === 'absent' && "bg-red-500 hover:bg-red-600")}
                          onClick={() => setAttendanceMap(prev => ({...prev, [student.id]: 'absent'}))}
                        >
                          <X className="mr-1 h-4 w-4" /> Absent
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={markAttendance.isPending} size="lg">
                    {markAttendance.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Attendance
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center p-12 text-muted-foreground">
          Please select a class to mark attendance.
        </div>
      )}
    </div>
  )
}
