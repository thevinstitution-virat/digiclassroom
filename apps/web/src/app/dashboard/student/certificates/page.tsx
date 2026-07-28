import { redirect } from 'next/navigation';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { CalendarIcon, GraduationCap } from 'lucide-react';

export default async function StudentCertificatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/sign-in');
  const userId = session.user.id;

  // Fetch certificates directly via Drizzle (Server Component)
  const rows = await db
    .select({
      certificate: schema.certificates,
      batchName: schema.batches.name,
      orgName: schema.organization.name
    })
    .from(schema.certificates)
    .innerJoin(schema.batches, eq(schema.batches.id, schema.certificates.batchId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.certificates.orgId))
    .where(eq(schema.certificates.userId, userId))
    .orderBy(desc(schema.certificates.issuedAt));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Certificates</h1>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mb-4 opacity-20" />
            <p>You haven't earned any certificates yet.</p>
            <p className="text-sm mt-1">Complete all videos in a batch to earn your first certificate!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.map(r => (
            <Card key={r.certificate.id} className="flex flex-col">
              <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                <CardTitle className="text-xl">{r.batchName}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">{r.orgName}</div>
              </CardHeader>
              <CardContent className="pt-6 flex-1 flex flex-col">
                <div className="space-y-3 mb-6 flex-1 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {r.certificate.certificateNumber}
                    </span>
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Issued: {r.certificate.issuedAt.toLocaleDateString()}
                  </div>
                </div>
                <Button asChild className="w-full" variant="outline">
                  <Link href={`/dashboard/student/certificates/${r.certificate.id}`}>
                    View Certificate
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
