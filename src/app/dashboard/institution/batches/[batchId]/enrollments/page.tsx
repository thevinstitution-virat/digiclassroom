'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { EnrollmentManager } from '@/components/enrollments/EnrollmentManager';

export default function BatchEnrollmentsPage() {
  const { batchId } = useParams<{ batchId: string }>();

  const batch = api.batches.getById.useQuery({ id: batchId });

  if (batch.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!batch.data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Batch not found.</div>
    );
  }

  return (
    <div className="space-y-6 p-6">

      {/* Breadcrumb + header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-3 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/institution/batches">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Batches
          </Link>
        </Button>

        <h1 className="text-2xl font-bold tracking-tight">Enrollments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{batch.data.name}</p>
      </div>

      <EnrollmentManager batchId={batchId} batchName={batch.data.name} />

    </div>
  );
}
