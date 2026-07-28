'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { CheckCircle2, Copy, Check, Receipt, ShoppingBag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatAmount(paise: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : currency
  return `${symbol}${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function truncatePaymentId(id: string): string {
  // e.g. "pay_QxZ7…r9Kt"
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function PurchaseSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyPurchases() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-muted rounded-full p-4 mb-4">
        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No purchases yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        When you pay for a batch, your receipt will appear here. Free batch
        enrollments are not shown.
      </p>
    </div>
  )
}

// ── Receipt card ───────────────────────────────────────────────────────────────

interface ReceiptCardProps {
  orderId:           string
  batchName:         string
  orgName:           string
  amountPaise:       number
  currency:          string
  razorpayPaymentId: string
  capturedAt:        Date | string | null
  status?:           'captured' | 'refunded' | string
}

function ReceiptCard({
  batchName,
  orgName,
  amountPaise,
  currency,
  razorpayPaymentId,
  capturedAt,
  status,
}: ReceiptCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(razorpayPaymentId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        {/* Top row: meta + amount */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">{orgName}</p>
              <p className="font-semibold text-sm leading-snug line-clamp-2">
                {batchName}
              </p>
            </div>
          </div>
            <div className="shrink-0 text-right">
              <span className="text-xl font-bold tabular-nums">
                {formatAmount(amountPaise, currency)}
              </span>
              {status === 'refunded' ? (
                <Badge
                  variant="secondary"
                  className="mt-1 block text-center bg-orange-50 text-orange-700 border-orange-200"
                >
                  Refunded
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="mt-1 block text-center bg-green-50 text-green-700 border-green-200"
                >
                  Paid
                </Badge>
              )}
            </div>
        </div>

        {/* Bottom row: date + payment ID */}
        <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-xs text-muted-foreground">
            {formatDate(capturedAt)}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-muted-foreground">
              {truncatePaymentId(razorpayPaymentId)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              title="Copy payment ID"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function PurchasesClient() {
  const { data, isLoading, isError } = api.student.getMyPurchases.useQuery()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold leading-tight">Payment History</h1>
          <p className="text-sm text-muted-foreground">
            Receipts for all paid batch enrollments
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="space-y-3">
          <PurchaseSkeleton />
          <PurchaseSkeleton />
          <PurchaseSkeleton />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive py-8 text-center">
          Failed to load purchase history. Please refresh and try again.
        </p>
      )}

      {!isLoading && !isError && data?.length === 0 && <EmptyPurchases />}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="space-y-3">
          {data.map(purchase => (
            <ReceiptCard
              key={purchase.orderId}
              orderId={purchase.orderId}
              batchName={purchase.batchName}
              orgName={purchase.orgName}
              amountPaise={purchase.amountPaise}
              currency={purchase.currency ?? 'INR'}
              razorpayPaymentId={purchase.razorpayPaymentId}
              capturedAt={purchase.capturedAt}
            />
          ))}
          <p className="text-xs text-center text-muted-foreground pt-2">
            {data.length} receipt{data.length !== 1 ? 's' : ''} · Free batch
            enrollments are not shown
          </p>
        </div>
      )}
    </div>
  )
}
