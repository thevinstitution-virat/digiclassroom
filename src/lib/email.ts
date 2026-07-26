import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY not set — email dispatch will be skipped')
}

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'DigiClassroomPro <no-reply@digiclassroompro.in>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://digiclassroompro.in'

/** Resend batch API hard limit */
const CHUNK_SIZE = 100
/** Pause between chunks to stay well within Resend rate limits */
const CHUNK_DELAY_MS = 250

// ── HTML template ──────────────────────────────────────────────────────────────

function buildAnnouncementHtml(
  orgName: string,
  title: string,
  body: string,
  batchUrl: string,
): string {
  // Escape user-supplied content — never trust IA input inside innerHTML
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:10px;padding:36px 32px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">
          ${esc(orgName)}
        </p>
        <h1 style="margin:0 0 20px;font-size:21px;font-weight:700;color:#111827;line-height:1.3">
          ${esc(title)}
        </h1>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#374151;white-space:pre-wrap">
          ${esc(body)}
        </p>
        <a href="${esc(batchUrl)}"
           style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
                  padding:11px 22px;border-radius:7px;font-size:14px;font-weight:600">
          Open in Classroom →
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 0 0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6">
        You're receiving this because you're enrolled in a batch at ${esc(orgName)}.<br>
        To stop receiving emails, contact your institution admin.
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface AnnouncementEmailParams {
  students: Array<{ email: string; name: string | null }>
  title: string
  body: string
  orgName: string
  batchId: string
}

/**
 * Sends an announcement email to every opted-in student in a batch.
 * Chunks into batches of 100 to respect Resend's batch API limit.
 *
 * NOTE: On Vercel Edge/Serverless, call this inside `waitUntil()` from
 * `@vercel/functions` so the runtime doesn't terminate mid-send.
 * On a self-hosted Node.js server, fire-and-forget is safe.
 */
export async function sendAnnouncementEmails(
  params: AnnouncementEmailParams,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return  // gracefully skip when unconfigured

  const { students, title, body, orgName, batchId } = params
  if (students.length === 0) return

  const batchUrl = `${APP_URL}/dashboard/student/batch/${batchId}`
  const html = buildAnnouncementHtml(orgName, title, body, batchUrl)
  const subject = `[${orgName}] ${title}`

  const emails = students.map(s => ({
    from: FROM_EMAIL,
    to: s.email,
    subject,
    html,
  }))

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE)
    const { error } = await resend.batch.send(chunk)
    if (error) {
      // Log and continue — a single chunk failure shouldn't abort remaining chunks
      console.error('[email] Resend batch error', { chunkOffset: i, batchId, error })
    }
    if (i + CHUNK_SIZE < emails.length) {
      await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS))
    }
  }

  console.log(`[email] Announcement dispatched to ${students.length} student(s) for batch ${batchId}`)
}
