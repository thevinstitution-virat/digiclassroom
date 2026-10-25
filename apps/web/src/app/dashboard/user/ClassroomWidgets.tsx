'use client'

import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Megaphone } from 'lucide-react'
import { format } from 'date-fns'

export function StudentNoticesWidget() {
  const { data, isLoading } = api.notices.getNotices.useQuery({ limit: 5, offset: 0 })

  if (isLoading || !data?.notices || data.notices.length === 0) {
    return null; // Return null if disabled or empty
  }

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="bg-primary/10 pb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
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
            <div className="text-xs text-muted-foreground mt-2">
              {format(new Date(notice.created_at), 'MMM d, yyyy')} • {notice.author_name}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
