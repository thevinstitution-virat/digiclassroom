'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, Megaphone } from 'lucide-react'
import { format } from 'date-fns'

export default function TeacherNoticesPage() {
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetAudience, setTargetAudience] = useState<'all' | 'students' | 'teachers'>('all')

  const { data, isLoading, refetch } = api.notices.getNotices.useQuery({ limit: 50, offset: 0 })
  const createNotice = api.notices.createNotice.useMutation({
    onSuccess: () => {
      setIsCreating(false)
      setTitle('')
      setContent('')
      refetch()
    }
  })
  const deleteNotice = api.notices.deleteNotice.useMutation({
    onSuccess: () => refetch()
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return
    createNotice.mutate({ title, content, targetAudience })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notices</h1>
          <p className="text-muted-foreground mt-2">Manage classroom announcements and notices.</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Create Notice</>}
        </Button>
      </div>

      {isCreating && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="bg-primary/10 pb-4">
            <CardTitle className="text-lg">New Announcement</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input 
                    placeholder="E.g., Tomorrow's Class Cancelled" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audience</label>
                  <Select value={targetAudience} onValueChange={(v: any) => setTargetAudience(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="students">Students Only</SelectItem>
                      <SelectItem value="teachers">Teachers Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea 
                  placeholder="Type your announcement here..." 
                  className="min-h-[100px]"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={createNotice.isPending}>
                {createNotice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish Notice
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.notices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <Megaphone className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p>No notices found.</p>
            </div>
          ) : (
            data?.notices.map(notice => (
              <Card key={notice.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{notice.title}</CardTitle>
                      <CardDescription className="mt-1">
                        By {notice.author_name} • {format(new Date(notice.created_at), 'PPP p')} • Audience: {notice.target_audience}
                      </CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if(confirm('Delete this notice?')) deleteNotice.mutate({ id: notice.id })
                      }}
                      disabled={deleteNotice.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap">{notice.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
