import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/trpc/client';
import { useRazorpay } from '@/hooks/useRazorpay';

interface ActiveBatch {
  batchId: string;
  batchName: string;
  domain: { id: string; name: string };
  course: { id: string; name: string };
  level: { id: string; name: string };
  videoCount: number;
  completedCount: number;
  enrollmentStatus?: string;
  pendingOrder?: {
    razorpayOrderId: string;
    amountPaise: number;
  } | null;
  maxStudents?: number | null;
  enrollmentCount?: number;
}

interface BatchCardProps {
  batch: ActiveBatch;
  onNavigate: (batchId: string) => void;
}

export function BatchCard({ batch, onNavigate }: BatchCardProps) {
  const progressPercent = batch.videoCount > 0 
    ? Math.round((batch.completedCount / batch.videoCount) * 100)
    : 0;

  const utils = api.useUtils();
  const { openCheckout } = useRazorpay();
  const resumePayment = api.student.resumeOrReplacePaymentOrder.useMutation({
    onSuccess: (data) => {
      openCheckout({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amountPaise,
        currency: 'INR',
        order_id: data.razorpayOrderId,
        name: 'DigiClassroomPro',
        description: batch.batchName,
        handler: async () => {
          await utils.student.getEnrolledBatches.invalidate();
        }
      });
    }
  });

  const isPendingPayment = batch.enrollmentStatus === 'pending_payment';

  if (isPendingPayment) {
    return (
      <Card className="flex flex-col h-full border-amber-200 bg-amber-50/50">
        <CardHeader>
          <div className="text-sm text-amber-700/80 mb-1">
            {batch.domain.name} / {batch.course.name} / {batch.level.name}
          </div>
          <CardTitle className="text-xl line-clamp-2 text-amber-900">{batch.batchName}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="text-sm text-amber-800 flex items-center justify-center h-full py-4 text-center">
            Payment pending. Complete your payment to start learning.
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-amber-600 hover:bg-amber-700 text-white" 
            onClick={() => resumePayment.mutate({ batchId: batch.batchId })}
            disabled={resumePayment.isPending}
          >
            {resumePayment.isPending ? "Loading..." : "Complete Payment"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="text-sm text-muted-foreground mb-1">
          {batch.domain.name} / {batch.course.name} / {batch.level.name}
        </div>
        <CardTitle className="text-xl line-clamp-2">{batch.batchName}</CardTitle>
        {batch.maxStudents !== null && batch.maxStudents !== undefined && (
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {batch.maxStudents - (batch.enrollmentCount || 0) <= 0
                ? "Full"
                : batch.maxStudents - (batch.enrollmentCount || 0) <= 5
                  ? `Almost full (${batch.maxStudents - (batch.enrollmentCount || 0)} left)`
                  : `${batch.maxStudents - (batch.enrollmentCount || 0)} seats left`}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {batch.videoCount > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{batch.completedCount} / {batch.videoCount} Videos Completed</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground flex items-center justify-center h-full py-4">
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              No videos yet
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={() => onNavigate(batch.batchId)}
          disabled={batch.videoCount === 0}
        >
          {batch.videoCount > 0 && batch.completedCount > 0 ? "Continue Learning" : "Start Learning"}
        </Button>
      </CardFooter>
    </Card>
  );
}
