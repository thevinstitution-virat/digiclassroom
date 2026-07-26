import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function BatchCouponsTab({ batchId }: { batchId: string }) {
  const utils = api.useUtils();
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const coupons = api.institutionAdmin.listBatchCoupons.useQuery({ batchId });

  const createCoupon = api.institutionAdmin.createBatchCoupon.useMutation({
    onSuccess: () => {
      toast.success('Coupon created successfully');
      utils.institutionAdmin.listBatchCoupons.invalidate({ batchId });
      setCode('');
      setDiscountValue('');
      setUsageLimit('');
      setExpiresAt('');
      setIsCreating(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCoupon = api.institutionAdmin.deleteBatchCoupon.useMutation({
    onSuccess: () => {
      toast.success('Coupon deleted');
      utils.institutionAdmin.listBatchCoupons.invalidate({ batchId });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountValue) return;

    createCoupon.mutate({
      batchId,
      code,
      discountType,
      discountValue: parseFloat(discountValue),
      usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
  };

  return (
    <div className="space-y-6 overflow-y-auto p-4 flex-1">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Discount Coupons</h3>
        <Button onClick={() => setIsCreating(!isCreating)} variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Coupon
        </Button>
      </div>

      {isCreating && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <Input
                    placeholder="e.g. SUMMER50"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={discountType} onValueChange={(val: any) => setDiscountType(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={discountType === 'percentage' ? "e.g. 50" : "e.g. 1000"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Usage Limit (Optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 100"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Expiry Date (Optional)</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCoupon.isPending}>
                  {createCoupon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {coupons.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : coupons.data?.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
          No coupons created yet.
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium font-mono">{c.code}</TableCell>
                  <TableCell>
                    {c.discountType === 'percentage' 
                      ? `${c.discountValue}%` 
                      : `₹${c.discountValue}`}
                  </TableCell>
                  <TableCell>
                    {c.usageCount} {c.usageLimit ? `/ ${c.usageLimit}` : 'uses'}
                  </TableCell>
                  <TableCell>
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCoupon.mutate({ batchId, id: c.id })}
                      disabled={deleteCoupon.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
