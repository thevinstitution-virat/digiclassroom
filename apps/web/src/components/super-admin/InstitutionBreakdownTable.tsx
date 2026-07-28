'use client';

import React from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function InstitutionBreakdownTable() {
  const { data, isLoading, error } = trpc.superAdminAnalytics.getInstitutionBreakdown.useQuery();

  if (isLoading) {
    return (
      <div className="border rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Institution</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Active Batches</TableHead>
              <TableHead className="text-right">Total Students</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-600 rounded-lg">
        Failed to load institution breakdown
      </div>
    );
  }

  return (
    <div className="border rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Institution</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Active Batches</TableHead>
            <TableHead className="text-right">Total Students</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                No institutions found.
              </TableCell>
            </TableRow>
          ) : (
            data.map((inst) => (
              <TableRow key={inst.id}>
                <TableCell className="font-medium">{inst.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {inst.type.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{inst.activeBatches}</TableCell>
                <TableCell className="text-right">{inst.totalStudents}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
