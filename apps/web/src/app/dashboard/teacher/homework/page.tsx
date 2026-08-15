'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, FileText, Calendar as CalendarIcon, Users } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export default function TeacherHomeworkPage() {
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)

  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)

  const [viewingSubmissionsFor, setViewingSubmissionsFor] = useState<string | null>(null)

  // Fetch classes via standard API
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

  const { data, isLoading, refetch } = api.homework.getHomeworksForClass.useQuery(
    { classId: selectedClassId || '' },
    { enabled: !!selectedClassId }
  )

  const createHomework = api.homework.createHomework.useMutation({
    onSuccess: () => {
      setIsCreating(false)
      setTitle('')
      setDescription('')
      setDueDate(undefined)
      refetch()
    }
  })

  const deleteHomework = api.homework.deleteHomework.useMutation({
    onSuccess: () => refetch()
  })

  const { data: submissionsData, isLoading: isLoadingSubmissions } = api.homework.getHomeworkSubmissions.useQuery(
    { homeworkId: viewingSubmissionsFor || '' },
    { enabled: !!viewingSubmissionsFor }
  )

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !selectedClassId || !dueDate) return
    createHomework.mutate({ classId: selectedClassId, title, description, dueDate })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Homework</h1>
          <p className="text-muted-foreground mt-2">Assign homework and view student submissions.</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedClassId || ''} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setIsCreating(!isCreating)} disabled={!selectedClassId}>
            {isCreating ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Assign</>}
          </Button>
        </div>
      </div>

      {isCreating && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="bg-primary/10 pb-4">
            <CardTitle className="text-lg">New Assignment</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input 
                    placeholder="E.g., Chapter 4 Reading" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-medium">Due Date</label>
                  <Input
                    type="date"
                    onChange={(e) => setDueDate(new Date(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Instructions</label>
                <Textarea 
                  placeholder="Additional details for the homework..." 
                  className="min-h-[100px]"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={createHomework.isPending || !dueDate}>
                {createHomework.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign Homework
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {selectedClassId ? (
        isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {data?.homeworks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p>No homework assigned for this class yet.</p>
              </div>
            ) : (
              data?.homeworks.map(hw => (
                <Card key={hw.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">{hw.title}</CardTitle>
                        <CardDescription className="mt-1">
                          Due: {format(new Date(hw.due_date), 'PPP')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setViewingSubmissionsFor(viewingSubmissionsFor === hw.id ? null : hw.id)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Submissions
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if(confirm('Delete this homework?')) deleteHomework.mutate({ id: hw.id })
                          }}
                          disabled={deleteHomework.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {hw.description && (
                      <p className="text-foreground whitespace-pre-wrap mb-4">{hw.description}</p>
                    )}
                    
                    {viewingSubmissionsFor === hw.id && (
                      <div className="mt-4 p-4 bg-muted/40 rounded-lg border">
                        <h4 className="font-semibold mb-3">Completed By:</h4>
                        {isLoadingSubmissions ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : submissionsData?.submissions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No submissions yet.</p>
                        ) : (
                          <ul className="space-y-2">
                            {submissionsData?.submissions.map(sub => (
                              <li key={sub.id} className="flex justify-between text-sm">
                                <span>{sub.student_name}</span>
                                <span className="text-muted-foreground">{format(new Date(sub.submitted_at), 'PPP p')}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Select a class to view or assign homework.</p>
        </div>
      )}
    </div>
  )
}
