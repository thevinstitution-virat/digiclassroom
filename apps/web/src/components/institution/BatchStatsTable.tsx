'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BatchStat {
  batchId: string;
  batchName: string;
  levelName: string;
  isActive: boolean;
  enrolledCount: number;
  videoCount: number;
  avgCompletion: number;
}

interface BatchStatsTableProps {
  data: BatchStat[];
  isLoading: boolean;
}

export function BatchStatsTable({ data, isLoading }: BatchStatsTableProps) {
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      if (sortDirection === 'asc') return a.avgCompletion - b.avgCompletion;
      return b.avgCompletion - a.avgCompletion;
    });
    return sorted;
  }, [data, sortDirection]);

  const toggleSort = () => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');

  const getCompletionColor = (pct: number) => {
    if (pct >= 75) return 'text-green-600 dark:text-green-500 font-semibold';
    if (pct >= 40) return 'text-amber-600 dark:text-amber-500 font-semibold';
    return 'text-red-600 dark:text-red-500 font-semibold';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 && !isLoading ? (
          <div className="text-center py-6 text-muted-foreground">
            No batches found.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                  <TableHead className="text-right">Videos</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={toggleSort} className="h-8 px-2 float-right flex items-center">
                      Avg Completion
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((batch) => (
                    <TableRow key={batch.batchId}>
                      <TableCell className="font-medium">{batch.batchName}</TableCell>
                      <TableCell>{batch.levelName}</TableCell>
                      <TableCell>
                        <Badge variant={batch.isActive ? 'default' : 'secondary'}>
                          {batch.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{batch.enrolledCount}</TableCell>
                      <TableCell className="text-right">{batch.videoCount}</TableCell>
                      <TableCell className={`text-right ${getCompletionColor(batch.avgCompletion)}`}>
                        {batch.avgCompletion.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
