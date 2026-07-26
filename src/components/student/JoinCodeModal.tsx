'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useRazorpay } from '@/hooks/useRazorpay';

export function JoinCodeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<{ razorpayOrderId: string, amountPaise: number, batchName: string } | null>(null);
  const { openCheckout } = useRazorpay();
  
  const utils = api.useUtils();
  const joinBatch = api.student.joinBatchByCode.useMutation({
    onSuccess: (data) => {
      if (data.alreadyEnrolled) {
        toast.info("You're already enrolled in this batch.");
        handleClose();
      } else if (data.pendingPayment) {
        toast.info("You have a pending payment for this batch. Complete it from your dashboard.");
        utils.student.getEnrolledBatches.invalidate();
        handleClose();
      } else if (data.razorpayOrderId) {
        setCheckoutData({
          razorpayOrderId: data.razorpayOrderId,
          amountPaise: data.amountPaise!,
          batchName: data.batchName || 'Batch'
        });
      } else {
        toast.success("You've joined! Welcome to the batch.");
        utils.student.getEnrolledBatches.invalidate();
        handleClose();
      }
    },
    onError: (e) => {
      if (e.data?.code === 'NOT_FOUND') {
        setErrorMsg("That code doesn't match any active batch. Double-check and try again.");
      } else if (e.data?.code === 'FORBIDDEN') {
        setErrorMsg("This batch is no longer accepting new enrollments.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  });

  function handleClose() {
    setCode('');
    setCouponCode('');
    setErrorMsg(null);
    setCheckoutData(null);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length === 8) {
      setErrorMsg(null);
      joinBatch.mutate({ 
        code,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {})
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a Batch</DialogTitle>
          <DialogDescription>
            Enter the 8-character code shared by your instructor.
          </DialogDescription>
        </DialogHeader>
        {checkoutData ? (
          <div className="space-y-4 pt-4">
            <div className="p-4 bg-muted rounded-md text-center">
              <p className="text-sm text-muted-foreground mb-1">Batch Fee</p>
              <p className="text-3xl font-bold">₹{checkoutData.amountPaise / 100}</p>
              <p className="text-sm mt-2">{checkoutData.batchName}</p>
            </div>
            <Button 
              className="w-full h-12 text-lg font-medium"
              onClick={() => {
                openCheckout({
                  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                  amount: checkoutData.amountPaise,
                  currency: 'INR',
                  order_id: checkoutData.razorpayOrderId,
                  name: 'DigiClassroomPro',
                  description: checkoutData.batchName,
                  handler: async () => {
                    await utils.student.getEnrolledBatches.invalidate();
                    handleClose();
                  },
                  modal: {
                    ondismiss: () => {
                      handleClose();
                    }
                  }
                });
              }}
            >
              Pay ₹{checkoutData.amountPaise / 100}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setErrorMsg(null);
                }}
                maxLength={8}
                placeholder="Batch Code (e.g. A1B2C3D4)"
                autoComplete="off"
                className="text-center font-mono text-2xl tracking-widest uppercase h-14"
              />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground text-center">Have a discount code?</p>
              <Input
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setErrorMsg(null);
                }}
                maxLength={50}
                placeholder="Optional Discount Code"
                autoComplete="off"
                className="text-center font-mono text-lg uppercase h-12"
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-destructive font-medium text-center">{errorMsg}</p>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-medium"
              disabled={code.length < 8 || joinBatch.isPending}
            >
              {joinBatch.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Join Batch
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
