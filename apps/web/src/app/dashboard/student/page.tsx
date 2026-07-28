'use client';

import React from 'react';
import { trpc } from '@/lib/trpc/client';
import { BatchCard } from '@/components/student/BatchCard';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { JoinCodeModal } from '@/components/student/JoinCodeModal';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const { data: batches, isLoading, error } = trpc.student.getEnrolledBatches.useQuery(undefined);

  React.useEffect(() => {
    if (error) {
      toast.error('Could not load your courses');
      console.error(error);
    }
  }, [error]);

  const handleNavigate = (batchId: string) => {
    router.push(`/dashboard/student/batch/${batchId}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground mt-2">
            Pick up where you left off
          </p>
        </div>
        {batches && batches.length > 0 && (
          <Button onClick={() => setJoinModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Join Another Batch
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col h-[220px] rounded-xl border bg-card text-card-foreground shadow">
              <div className="p-6 space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-6 w-full" />
              </div>
              <div className="p-6 pt-0 mt-auto">
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-center border rounded-xl bg-muted/50">
          <p className="text-muted-foreground mb-4">Failed to load courses</p>
          <button 
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : !batches || batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center border rounded-xl bg-muted/50 p-6">
          <h3 className="text-lg font-semibold mb-2">No active courses enrolled</h3>
          <p className="text-muted-foreground mb-4">
            You don't have any active course enrollments yet.
          </p>
          <Button variant="default" onClick={() => setJoinModalOpen(true)}>
            Have a join code? Enter it here
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map(batch => (
            <BatchCard 
              key={batch.batchId} 
              batch={batch} 
              onNavigate={handleNavigate} 
            />
          ))}
        </div>
      )}

      <JoinCodeModal open={joinModalOpen} onClose={() => setJoinModalOpen(false)} />
    </div>
  );
}
