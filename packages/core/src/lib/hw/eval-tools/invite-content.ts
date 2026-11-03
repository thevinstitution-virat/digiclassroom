// The pure parts of rater invitations: the validity period, the sign-up link and the email. No database, so they are testable alone.

import { emailLayout } from '@/lib/email/send-email';

export const INVITE_VALID_DAYS = 30;

export const normaliseInviteEmail = (e: string): string => e.trim().toLowerCase();

export const defaultAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_ORIGIN || 'http://localhost:3001';

/** The page the invitee opens: the sign-up form with their address filled in (`email`), and /evaluate after they sign in (`redirect_url`, which the form reads). */
export function signUpLink(email: string, appUrl: string = defaultAppUrl()): string {
  return `${appUrl.replace(/\/$/, '')}/sign-up?email=${encodeURIComponent(email)}&redirect_url=${encodeURIComponent('/evaluate')}`;
}

export function inviteEmailContent(i: { pseudonym: string; link: string; expiresAt: Date }): { subject: string; html: string } {
  const until = i.expiresAt.toISOString().slice(0, 10);
  return {
    subject: 'You are invited to help evaluate handwriting reading and marking / मूल्यांकन में मदद का निमंत्रण',
    html: emailLayout({
      heading: 'Help us test the handwriting reader and the AI marker',
      body: `You are invited as an evaluator. Create your account with THIS email address, then confirm your email: your evaluator access is added automatically. In the work you will be known only as "${i.pseudonym}". The invitation is valid until ${until}. ` +
        `आपको मूल्यांकनकर्ता के रूप में बुलाया गया है। इसी ईमेल पते से खाता बनाएँ और ईमेल की पुष्टि करें; आपकी पहुँच अपने-आप जुड़ जाएगी। काम में आपको सिर्फ़ "${i.pseudonym}" नाम से जाना जाएगा। निमंत्रण ${until} तक मान्य है।`,
      ctaLabel: 'Create your account',
      ctaUrl: i.link,
    }),
  };
}

