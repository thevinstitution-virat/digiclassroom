import { redirect } from 'next/navigation';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { PrintButton } from './PrintButton';

export default async function CertificatePage({ params }: { params: { certificateId: string } }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/sign-in');
  const userId = session.user.id;

  const [row] = await db
    .select({
      certificate: schema.certificates,
      batchName: schema.batches.name,
      orgName: schema.organization.name,
      studentName: schema.user.name,
      domainName: schema.taxonomyDomains.name,
      courseName: schema.taxonomyCourses.name,
      levelName: schema.taxonomyLevels.name,
    })
    .from(schema.certificates)
    .innerJoin(schema.batches, eq(schema.batches.id, schema.certificates.batchId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.certificates.orgId))
    .innerJoin(schema.user, eq(schema.user.id, schema.certificates.userId))
    .innerJoin(schema.taxonomyLevels, eq(schema.taxonomyLevels.id, schema.batches.levelId))
    .innerJoin(schema.taxonomyCourses, eq(schema.taxonomyCourses.id, schema.taxonomyLevels.courseId))
    .innerJoin(schema.taxonomyDomains, eq(schema.taxonomyDomains.id, schema.taxonomyCourses.domainId))
    .where(and(
      eq(schema.certificates.id, params.certificateId),
      eq(schema.certificates.userId, userId)
    ))
    .limit(1);

  if (!row) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center mt-12">
        <h1 className="text-2xl font-bold mb-2">Certificate Not Found</h1>
        <p className="text-muted-foreground mb-6">This certificate does not exist or you don't have access to it.</p>
        <Button asChild>
          <Link href="/dashboard/student/certificates">Back to Certificates</Link>
        </Button>
      </div>
    );
  }

  // Formatting date
  const dateStr = row.certificate.issuedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      {/* Print CSS Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-certificate, #printable-certificate * {
            visibility: visible;
          }
          #printable-certificate {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100vh;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      <div className="max-w-5xl mx-auto space-y-6 print:hidden">
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/student/certificates">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      <div className="mt-8 flex justify-center w-full">
        <div 
          id="printable-certificate" 
          className="relative bg-white text-slate-900 border-8 border-double border-slate-200 p-12 md:p-24 shadow-2xl overflow-hidden"
          style={{ width: '1056px', height: '816px', maxWidth: '100%', aspectRatio: '11/8' }}
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0f172a 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="relative z-10 flex flex-col h-full items-center text-center justify-center space-y-8">
            <div className="uppercase tracking-[0.2em] text-sm font-semibold text-slate-500 mb-4">
              {row.orgName}
            </div>

            <h1 className="text-5xl md:text-6xl font-serif text-slate-800 tracking-tight">
              Certificate of Completion
            </h1>

            <div className="text-lg text-slate-600 mt-8 mb-4">
              This is to certify that
            </div>

            <div className="text-4xl font-bold text-slate-900 border-b-2 border-slate-200 pb-2 px-12 inline-block">
              {row.studentName}
            </div>

            <div className="text-lg text-slate-600 mt-6 max-w-2xl leading-relaxed">
              has successfully completed all requirements and videos for the batch
              <br />
              <strong className="text-slate-800 mt-2 block text-2xl">{row.batchName}</strong>
              <span className="text-sm text-slate-500 block mt-2">({row.domainName} / {row.courseName} / {row.levelName})</span>
            </div>

            <div className="w-full flex justify-between items-end mt-auto pt-16 px-12">
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-2 italic">Issued on</div>
                <div className="font-medium text-slate-800 border-t border-slate-300 pt-2 w-48">
                  {dateStr}
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-2 italic">Certificate ID</div>
                <div className="font-mono text-sm text-slate-800 border-t border-slate-300 pt-2 w-64">
                  {row.certificate.certificateNumber}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
