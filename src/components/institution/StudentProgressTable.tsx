'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface StudentProgressRow {
  userId: string;
  name: string;
  email: string;
  enrolledBatches: number;
  videosWatched: number;
  completedVideos: number;
  avgCompletion: number;
  lastActiveAt: Date | null;
}

interface StudentProgressTableProps {
  data: StudentProgressRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export function StudentProgressTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
}: StudentProgressTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 && !isLoading ? (
          <div className="text-center py-6 text-muted-foreground">
            No students enrolled yet. Add students via the Enrollments page.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Batches Enrolled</TableHead>
                  <TableHead className="text-right">Videos Watched</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Avg %</TableHead>
                  <TableHead className="text-right">Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((student) => (
                    <TableRow key={student.userId}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell className="text-muted-foreground">{student.email}</TableCell>
                      <TableCell className="text-right">{student.enrolledBatches}</TableCell>
                      <TableCell className="text-right">{student.videosWatched}</TableCell>
                      <TableCell className="text-right">{student.completedVideos}</TableCell>
                      <TableCell className="text-right">{student.avgCompletion.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {student.lastActiveAt
                          ? new Date(student.lastActiveAt).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total} entries
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
