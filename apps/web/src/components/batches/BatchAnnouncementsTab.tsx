'use client';

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Pin, 
  Trash2, 
  Plus, 
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function BatchAnnouncementsTab({ batchId }: { batchId: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const utils = trpc.useUtils();

  const { data: announcements, isLoading } = trpc.institutionAdmin.listBatchAnnouncements.useQuery({ batchId });

  const createMutation = trpc.institutionAdmin.createAnnouncement.useMutation({
    onSuccess: () => {
      toast.success('Announcement posted successfully');
      utils.institutionAdmin.listBatchAnnouncements.invalidate({ batchId });
      setTitle('');
      setBody('');
      setIsPinned(false);
      setIsComposing(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to post announcement');
    }
  });

  const deleteMutation = trpc.institutionAdmin.deleteAnnouncement.useMutation({
    onSuccess: () => {
      toast.success('Announcement deleted');
      utils.institutionAdmin.listBatchAnnouncements.invalidate({ batchId });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete announcement');
    }
  });

  const togglePinMutation = trpc.institutionAdmin.togglePinAnnouncement.useMutation({
    onSuccess: () => {
      toast.success('Announcement pin status updated');
      utils.institutionAdmin.listBatchAnnouncements.invalidate({ batchId });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update pin status');
    }
  });

  const pinnedCount = announcements?.filter(a => a.isPinned).length || 0;
  const canPin = pinnedCount < 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    if (isPinned && !canPin) {
      toast.error('Maximum of 3 pinned announcements reached');
      return;
    }

    createMutation.mutate({
      batchId,
      title: title.trim(),
      body: body.trim(),
      isPinned,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleTogglePin = (id: string, currentPinned: boolean) => {
    if (!currentPinned && !canPin) {
      toast.error('You can only pin up to 3 announcements.');
      return;
    }
    togglePinMutation.mutate({ id, isPinned: !currentPinned });
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Announcements</h3>
        {!isComposing && (
          <Button onClick={() => setIsComposing(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> New Announcement
          </Button>
        )}
      </div>

      {isComposing && (
        <Card className="border-primary/20 bg-primary/5">
          <form onSubmit={handleSubmit}>
            <CardHeader className="pb-4">
              <Input
                placeholder="Announcement Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                className="font-medium text-lg border-primary/20 bg-background"
                required
              />
            </CardHeader>
            <CardContent className="pb-4 space-y-4">
              <Textarea
                placeholder="Write your announcement here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={4}
                className="resize-none border-primary/20 bg-background"
                required
              />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pin-checkbox"
                  checked={isPinned}
                  onCheckedChange={(checked) => setIsPinned(!!checked)}
                  disabled={!canPin && !isPinned}
                />
                <label
                  htmlFor="pin-checkbox"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Pin to top of batch page
                </label>
              </div>
              {!canPin && !isPinned && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Maximum of 3 pinned announcements reached. Unpin an existing one to pin this.
                </p>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsComposing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Posting...' : 'Post Announcement'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No announcements posted yet.</p>
        </div>
      ) : (
        <div className="max-h-[380px] overflow-y-auto pr-2 space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className={announcement.isPinned ? "border-primary/50 shadow-sm relative overflow-hidden" : ""}>
              {announcement.isPinned && (
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              )}
              <CardContent className="p-4 sm:p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {announcement.isPinned && (
                        <Pin className="w-3.5 h-3.5 text-primary fill-primary/20 shrink-0" />
                      )}
                      <h4 className="font-semibold text-base truncate">{announcement.title}</h4>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="font-medium text-foreground/70">{announcement.authorName || 'Admin'}</span>
                      <span>•</span>
                      <span>{format(new Date(announcement.createdAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-2 break-words">
                      {announcement.body}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0 bg-muted/50 rounded-md p-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${announcement.isPinned ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => handleTogglePin(announcement.id, announcement.isPinned)}
                      disabled={togglePinMutation.isPending}
                      title={announcement.isPinned ? "Unpin" : "Pin announcement"}
                    >
                      <Pin className={`w-4 h-4 ${announcement.isPinned ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(announcement.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
