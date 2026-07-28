'use client';

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { Pin, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function StudentBatchAnnouncements({ batchId }: { batchId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: announcements, isLoading } = trpc.student.getBatchAnnouncements.useQuery({ batchId });

  if (isLoading) {
    return (
      <div className="space-y-4 mb-8">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!announcements || announcements.length === 0) {
    return null;
  }

  const visibleAnnouncements = isExpanded ? announcements : announcements.slice(0, 3);
  const hiddenCount = announcements.length - 3;

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center gap-2 mb-2">
        <Megaphone className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Announcements</h2>
      </div>
      
      <div className="space-y-3">
        {visibleAnnouncements.map((announcement) => (
          <Card key={announcement.id} className={announcement.isPinned ? "border-primary/50 shadow-sm relative overflow-hidden" : "bg-muted/10 border-transparent shadow-none"}>
            {announcement.isPinned && (
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            )}
            <CardContent className="p-4 sm:p-5">
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
            </CardContent>
          </Card>
        ))}
      </div>

      {hiddenCount > 0 && (
        <div className="pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Show {hiddenCount} more announcement{hiddenCount === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
