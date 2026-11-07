// src/app/dashboard/layout.tsx — turns evaluator-only accounts away from every dashboard page (roadmap task 3.2).
//
// An invited volunteer whose only role is "evaluator" has one page, /evaluate. /dashboard (the router page) already sends them
// there; this layout covers a typed or bookmarked /dashboard/... address. It asks /api/me, the same authority the router page
// uses, once per full page load (a layout is not re-rendered when moving between pages inside it). Anything that goes wrong
// asking leaves the page as it was: nobody is locked out by a failed lookup.

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { MathJaxScripts } from '@/components/providers/MathJaxScripts';

async function isEvaluatorOnly(): Promise<boolean> {
  try {
    const incoming = await headers();
    const host = incoming.get('host') ?? 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const res = await fetch(`${protocol}://${host}/api/me`, {
      headers: { cookie: incoming.get('cookie') ?? '', 'x-org-id': incoming.get('x-org-id') ?? '' },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { evaluatorOnly?: boolean };
    return data.evaluatorOnly === true;
  } catch {
    return false;
  }
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // redirect() works by throwing, so it is called outside the try/catch above.
  if (await isEvaluatorOnly()) redirect('/evaluate');
  // Formula rendering (MathJax) is needed here, not on the landing page or the sign-in pages.
  return (
    <>
      <MathJaxScripts />
      {children}
    </>
  );
}
