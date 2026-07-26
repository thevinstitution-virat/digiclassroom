'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowUpDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function BatchAnalyticsClient({ batchId }: { batchId: string }) {
  const { data, isLoading } = api.institutionAdmin.getBatchAnalytics.useQuery({ batchId });
  const [filter, setFilter] = useState('all');
  const [sortCol, setSortCol] = useState<'name' | 'completion' | 'quizAvg' | 'engagementScore' | 'riskScore'>('engagementScore');
  const [sortDesc, setSortDesc] = useState(true);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <div>No data found.</div>;

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDesc(!sortDesc);
    else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  let filteredStudents = data.students;
  if (filter === 'high_risk') filteredStudents = data.students.filter(s => s.riskLevel === 'high');
  else if (filter === 'medium_risk') filteredStudents = data.students.filter(s => s.riskLevel === 'medium');
  else if (filter === 'top') filteredStudents = data.students.filter(s => s.engagementScore >= 80);
  else if (filter === 'inactive') filteredStudents = data.students.filter(s => {
    const lastActive = s.lastActive ? new Date(s.lastActive) : null;
    return !lastActive || (Date.now() - lastActive.getTime()) > 7 * 24 * 3600 * 1000;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let valA: any = a[sortCol];
    let valB: any = b[sortCol];
    if (valA === null) valA = 0;
    if (valB === null) valB = 0;
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    }
    return sortDesc ? valB - valA : valA - valB;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">Avg Completion</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.kpis.avgCompletion.toFixed(1)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">Avg Quiz Score</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.kpis.avgQuizScore.toFixed(1)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">At-Risk Students</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-500">{data.kpis.atRiskCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">Active Today</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.kpis.activeTodayCount}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Student Analytics</CardTitle>
              <CardDescription>Detailed engagement and risk metrics per student</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="high_risk">High risk</TabsTrigger>
              <TabsTrigger value="medium_risk">Medium risk</TabsTrigger>
              <TabsTrigger value="top">Top performers</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                      Name <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('completion')}>
                      Completion <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('quizAvg')}>
                      Quiz Avg <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('engagementScore')}>
                      Engagement <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('riskScore')}>
                      Risk <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudents.map(student => (
                    <TableRow key={student.userId}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/institution/analytics/${batchId}/student/${student.userId}`} className="text-primary hover:underline">
                          {student.name}
                        </Link>
                        {student.streakDays > 2 && <Badge variant="secondary" className="ml-2 text-xs">🔥 {student.streakDays}</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${student.completion}%` }} />
                          </div>
                          <span className="text-sm">{student.completion.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.quizAvg !== null ? `${student.quizAvg.toFixed(1)}%` : '-'}</TableCell>
                      <TableCell>{student.engagementScore.toFixed(0)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          student.riskLevel === 'high' ? 'destructive' :
                          student.riskLevel === 'medium' ? 'secondary' : 'default'
                        }>
                          {student.riskScore.toFixed(0)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
