'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function RazorpayKycSetup() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    category: 'education',
    subcategory: 'college',
    street1: '',
    city: '',
    state: '',
    postal_code: '',
  });

  const { data: statusData, isLoading, refetch } = api.institutionAdmin.getRazorpayKycStatus.useQuery();
  const setupMutation = api.institutionAdmin.setupRazorpayAccount.useMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSetup = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      
      const result = await setupMutation.mutateAsync(formData);
      
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl;
      } else {
        await refetch();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to setup Razorpay account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (statusData?.isLinked) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900">Razorpay Connected</h3>
              <p className="text-sm text-green-700">
                Your account ({statusData.accountId}) is linked to Razorpay for split payments.
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSetup} 
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resume KYC / View Dashboard <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup Payouts (Razorpay)</CardTitle>
        <CardDescription>
          Provide your business details to create a Razorpay linked account. 
          You will be redirected to Razorpay to complete your KYC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}
        
        {setupMutation.isSuccess && !setupMutation.data?.onboardingUrl && (
          <Alert className="bg-blue-50 border-blue-200">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Account Created</AlertTitle>
            <AlertDescription className="text-blue-700">
              Your account was created but no onboarding link was returned. Razorpay will email you to complete verification.
            </AlertDescription>
          </Alert>
        )}

        {(!setupMutation.isSuccess) && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Business Category</Label>
              <select 
                id="category" 
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="education">Education</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategory</Label>
              <select 
                id="subcategory" 
                name="subcategory"
                value={formData.subcategory}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="college">College</option>
                <option value="school">School</option>
                <option value="vocational_training">Vocational Training</option>
              </select>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="street1">Street Address</Label>
              <Input 
                id="street1" 
                name="street1"
                placeholder="123 Main St"
                value={formData.street1}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input 
                id="city" 
                name="city"
                placeholder="Mumbai"
                value={formData.city}
                onChange={handleChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input 
                id="state" 
                name="state"
                placeholder="Maharashtra"
                value={formData.state}
                onChange={handleChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code / PIN</Label>
              <Input 
                id="postal_code" 
                name="postal_code"
                placeholder="400001"
                value={formData.postal_code}
                onChange={handleChange}
              />
            </div>
          </div>
        )}
      </CardContent>
      {(!setupMutation.isSuccess) && (
        <CardFooter>
          <Button 
            onClick={handleSetup} 
            disabled={isSubmitting || !formData.street1 || !formData.city || !formData.state || !formData.postal_code}
            className="w-full sm:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Razorpay <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
