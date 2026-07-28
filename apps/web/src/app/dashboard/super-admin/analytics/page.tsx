import React from 'react';
import { PlatformStatsCards } from '@/components/super-admin/PlatformStatsCards';
import { InstitutionBreakdownTable } from '@/components/super-admin/InstitutionBreakdownTable';
import { TopContentList } from '@/components/super-admin/TopContentList';

export const metadata = {
  title: 'Platform Analytics | DigiClassroom Pro',
  description: 'Global analytics across all institutions',
};

export default function SuperAdminAnalyticsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Global metrics across all tenants and users on the DigiClassroom Pro platform.
        </p>
      </div>

      <PlatformStatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Institution Breakdown</h2>
          </div>
          <InstitutionBreakdownTable />
        </div>
        
        <div className="space-y-4">
          <TopContentList />
        </div>
      </div>
    </div>
  );
}
