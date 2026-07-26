'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Settings2, Loader2, Check } from 'lucide-react'

interface OrgPlanEditorProps {
  orgId: string
  initialPlan: 'starter' | 'pro' | 'enterprise'
  initialStatus: 'active' | 'inactive' | 'trial' | 'pending' | 'expired' | 'cancelled'
  initialFee: number
}

export default function OrgPlanEditor({ orgId, initialPlan, initialStatus, initialFee }: OrgPlanEditorProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [plan, setPlan] = useState(initialPlan)
  const [status, setStatus] = useState(initialStatus)
  const [feeRate, setFeeRate] = useState((initialFee * 100).toString()) // convert 0.05 to "5" for % display

  const updateMutation = trpc.superAdmin.updateOrganizationPlan.useMutation({
    onSuccess: () => {
      setIsOpen(false)
      router.refresh()
    }
  })

  const handleSave = () => {
    const parsedFee = parseFloat(feeRate) / 100
    if (isNaN(parsedFee) || parsedFee < 0 || parsedFee > 1) {
      alert("Invalid fee rate percentage. Must be between 0 and 100.")
      return
    }

    updateMutation.mutate({
      orgId,
      subscriptionPlan: plan,
      subscriptionStatus: status,
      platformFeeRate: parsedFee
    })
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <Settings2 className="h-4 w-4" /> Edit Plan & Fee
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Edit Organization Plan</h2>
        
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Plan</label>
            <select 
              value={plan}
              onChange={(e) => setPlan(e.target.value as any)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Status</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="trial">Trial</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Platform Fee Rate (%)</label>
            <Input 
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={feeRate}
              onChange={(e) => setFeeRate(e.target.value)}
              className="border-gray-300 dark:border-gray-700 dark:bg-gray-800"
            />
            <p className="mt-1 text-xs text-gray-500">Currently {(parseFloat(feeRate) || 0)}% (Saved as {(parseFloat(feeRate) / 100).toFixed(4)})</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
