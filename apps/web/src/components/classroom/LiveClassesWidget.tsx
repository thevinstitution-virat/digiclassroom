'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Video, Calendar, Clock, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

export function LiveClassesWidget({ classId, isTeacher, tenantId }: { classId: string, isTeacher: boolean, tenantId?: string }) {
  const utils = api.useUtils()
  const { data: classes, isLoading } = api.liveClasses.listByClass.useQuery({ classId, tenantId })

  const { mutate: scheduleClass, isLoading: isScheduling } = api.liveClasses.schedule.useMutation({
    onSuccess: () => {
      toast.success('Live class scheduled successfully!')
      utils.liveClasses.listByClass.invalidate({ classId, tenantId })
      setNewClass({ title: '', scheduledStartTime: '', durationMinutes: 60 })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to schedule live class')
    }
  })

  const [newClass, setNewClass] = useState({
    title: '',
    scheduledStartTime: '',
    durationMinutes: 60
  })

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClass.title || !newClass.scheduledStartTime) {
      toast.error('Please fill in all required fields')
      return
    }
    
    // Zoom API expects UTC time but typical HTML datetime-local input is local time.
    // The native date constructor will parse it relative to the browser timezone.
    const startTimeIso = new Date(newClass.scheduledStartTime).toISOString()

    scheduleClass({
      classId,
      title: newClass.title,
      scheduledStartTime: startTimeIso,
      durationMinutes: newClass.durationMinutes,
      tenantId
    })
  }

  return (
    <div className="space-y-6">
      {isTeacher && (
        <Card className="border-indigo-500/20 shadow-lg shadow-indigo-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Schedule Live Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div className="space-y-2">
                <Label>Topic</Label>
                <Input 
                  value={newClass.title} 
                  onChange={(e) => setNewClass({ ...newClass, title: e.target.value })} 
                  placeholder="e.g. Chapter 4 Review Session"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input 
                    type="datetime-local" 
                    value={newClass.scheduledStartTime} 
                    onChange={(e) => setNewClass({ ...newClass, scheduledStartTime: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (Minutes)</Label>
                  <Input 
                    type="number" 
                    min="15" 
                    max="300"
                    value={newClass.durationMinutes} 
                    onChange={(e) => setNewClass({ ...newClass, durationMinutes: parseInt(e.target.value) || 60 })} 
                  />
                </div>
              </div>
              <Button type="submit" disabled={isScheduling} className="w-full bg-indigo-600 hover:bg-indigo-700">
                {isScheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Zoom Meeting
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Video className="w-5 h-5" /> Upcoming Live Classes
        </h3>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : classes?.length === 0 ? (
          <div className="text-center p-8 border rounded-lg bg-slate-50/50 text-muted-foreground">
            No upcoming live classes scheduled.
          </div>
        ) : (
          <div className="grid gap-4">
            {classes?.map((c: any) => (
              <Card key={c.id} className="overflow-hidden hover:border-slate-300 transition-colors">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">{c.title}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(c.scheduledStartTime), 'PPp')}
                      </span>
                      <span>{c.durationMinutes} mins</span>
                    </div>
                  </div>
                  <div>
                    {isTeacher ? (
                      <Button asChild variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                        <a href={c.startUrl} target="_blank" rel="noopener noreferrer">
                          Start Meeting <ExternalLink className="ml-2 w-4 h-4" />
                        </a>
                      </Button>
                    ) : (
                      <Button asChild variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                        <a href={c.joinUrl} target="_blank" rel="noopener noreferrer">
                          Join Class <ExternalLink className="ml-2 w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
