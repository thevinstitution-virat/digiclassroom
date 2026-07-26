'use client'

import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Megaphone, FileText, CheckCircle2, Circle } from 'lucide-react'
import { format } from 'date-fns'

export function StudentNoticesWidget() {
  const { data, isLoading } = api.notices.getNotices.useQuery({ limit: 5, offset: 0 })

  if (isLoading || !data?.notices || data.notices.length === 0) {
    return null; // Return null if disabled or empty
  }

  return (
    <Card className="border-blue-200 shadow-sm">
      <CardHeader className="bg-blue-50/50 pb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Recent Announcements</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {data.notices.map((notice) => (
          <div key={notice.id} className="border-b last:border-0 pb-4 last:pb-0">
            <h4 className="font-semibold text-foreground">{notice.title}</h4>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
              {notice.content}
            </p>
            <div className="text-xs text-slate-400 mt-2">
              {format(new Date(notice.created_at), 'MMM d, yyyy')} • {notice.author_name}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function StudentHomeworkWidget() {
  const { data, isLoading, refetch } = api.homework.getMyHomeworks.useQuery({ limit: 10, offset: 0 })

  const submitHomework = api.homework.submitHomework.useMutation({
    onSuccess: () => refetch()
  })

  if (isLoading || !data?.homeworks || data.homeworks.length === 0) {
    return null;
  }

  const pendingHomework = data.homeworks.filter(hw => !hw.is_submitted)

  if (pendingHomework.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 shadow-sm">
      <CardHeader className="bg-orange-50/50 pb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-lg">Pending Homework</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {pendingHomework.slice(0, 5).map((hw) => (
          <div key={hw.id} className="flex items-start justify-between gap-4 border border-border/60 rounded-lg p-3">
            <div>
              <h4 className="font-medium text-foreground text-sm">{hw.title}</h4>
              <p className="text-xs text-red-500 mt-1">Due: {format(new Date(hw.due_date), 'MMM d, yyyy')}</p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-8"
              onClick={() => submitHomework.mutate({ homeworkId: hw.id })}
              disabled={submitHomework.isPending}
            >
              {submitHomework.isPending ? 'Marking...' : 'Mark Done'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
