'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, RefreshCw, XCircle } from 'lucide-react';

export function BatchJoinCodePanel({ batchId }: { batchId: string }) {
  const utils = api.useUtils();
  const { data, isLoading } = api.institutionAdmin.getBatchJoinCode.useQuery({ batchId });

  const rotateCode = api.institutionAdmin.rotateBatchJoinCode.useMutation({
    onSuccess: (res) => {
      utils.institutionAdmin.getBatchJoinCode.invalidate({ batchId });
      toast.success('Join code rotated.');
    },
    onError: (e) => toast.error(e.message),
  });

  const disableCode = api.institutionAdmin.disableBatchJoinCode.useMutation({
    onSuccess: () => {
      utils.institutionAdmin.getBatchJoinCode.invalidate({ batchId });
      toast.success('Join code disabled.');
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 border-t mt-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const joinCode = data?.joinCode;

  return (
    <div className="pt-4 border-t mt-4 space-y-4">
      <h3 className="text-sm font-medium">Student Join Code</h3>
      
      {joinCode ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-md bg-muted/50">
            <div className="flex-1">
              <p className="text-2xl font-mono tracking-widest">{joinCode}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(joinCode);
                toast.success('Join code copied!');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={rotateCode.isPending}
              onClick={() => {
                if (confirm('This will invalidate the current code. Students with the old code cannot join. Continue?')) {
                  rotateCode.mutate({ batchId });
                }
              }}
            >
              {rotateCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Rotate Code
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              disabled={disableCode.isPending}
              onClick={() => disableCode.mutate({ batchId })}
            >
              {disableCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Disable
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border rounded-md border-dashed space-y-3">
          <p className="text-sm text-muted-foreground">
            Join code disabled. Students cannot join via code.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={rotateCode.isPending}
            onClick={() => rotateCode.mutate({ batchId })}
          >
            {rotateCode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Re-enable
          </Button>
        </div>
      )}
    </div>
  );
}
