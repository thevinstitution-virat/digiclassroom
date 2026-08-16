import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, magicLink } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { db } from '../db';
import * as schema from '../db/schema';
import { syncFederatedSession } from '../lib/federation/jit';
import { sendEmail, emailLayout } from '../lib/email/send-email';
import { isDesignatedSuperAdmin } from '../lib/auth/super-admin-guard';
import { normaliseEmail } from '../lib/email/normalise';
import { AUTH_COOKIE_PREFIX } from '../lib/auth/auth-cookies';

// Federation toggle — when off, the existing email/password + Google paths are
// unchanged. See Vidyaverse Pro/docs/identity-federation-design.md §8.
const FEDERATION_ENABLED = process.env.FEDERATION_ENABLED === 'true';
// API origin — where the better-auth handler is served (api.<domain>).
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3002';
// Web origin — where user-facing pages live (app.<domain>). Email links
// (invitations, etc.) must land here, NOT on the API host.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_ORIGIN || 'http://localhost:3001';
// Parent domain for the session cookie so app.<domain> and api.<domain> share
// it (e.g. ".vinstitution.com"). Leave unset for same-origin/local dev.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;

// Two-trio federation: DigiClassroom is a shared service layer for BOTH control
// planes — Vidyaverse (formal institutions) and VDL (D2C coaching/library). Both
// IdPs emit the identical OIDC contract; each provider is inert until its env
// vars are present, so enabling one trio never disturbs the other.
// See Vidyaverse Pro/docs/two-trio-federation-design.md.
type ControlPlaneConfig = { providerId: 'vidyaverse' | 'vdl'; issuer?: string; clientId?: string; clientSecret?: string };

const CONTROL_PLANES: ControlPlaneConfig[] = [
    {
        providerId: 'vidyaverse',
        issuer: process.env.VIDYAVERSE_ISSUER,
        clientId: process.env.VIDYAVERSE_CLIENT_ID,
        clientSecret: process.env.VIDYAVERSE_CLIENT_SECRET,
    },
    {
        providerId: 'vdl',
        issuer: process.env.VDL_ISSUER,
        clientId: process.env.VDL_CLIENT_ID,
        clientSecret: process.env.VDL_CLIENT_SECRET,
    },
];

const oauthConfigs = CONTROL_PLANES.filter(
    (cp): cp is Required<ControlPlaneConfig> => Boolean(cp.issuer && cp.clientId && cp.clientSecret),
).map((cp) => ({
    providerId: cp.providerId,
    clientId: cp.clientId,
    clientSecret: cp.clientSecret,
    discoveryUrl: `${cp.issuer.replace(/\/$/, '')}/api/auth/.well-known/openid-configuration`,
    issuer: cp.issuer,
    scopes: ['openid', 'profile', 'email', 'offline_access', 'memberships', 'entitlements'],
    pkce: true,
    // MUST be the WEB origin, not BETTER_AUTH_URL. The SPA starts the flow through
    // the web app's /api/* rewrite, so better-auth's state/PKCE cookie is host-only
    // on app.<domain>. Sending the IdP callback to api.<domain> would drop that
    // cookie and fail with state_mismatch — and the session cookie would then be
    // set on a host the SPA can't read. The rewrite proxies this path to the same
    // handler, so the whole round-trip stays on one cookie host.
    redirectURI: `${APP_URL.replace(/\/$/, '')}/api/auth/oauth2/callback/${cp.providerId}`,
    mapProfileToUser: (profile: Record<string, unknown>) => {
        // This app requires verified email for its own signups, so a federated
        // identity must clear the same bar — otherwise SSO is a way around a gate
        // enforced everywhere else. It also makes linking-by-email safe below.
        if (!profile.email_verified) {
            throw new Error('This email address has not been verified with Vidyaverse.');
        }
        return {
            email: profile.email as string,
            name: (profile.name as string) ?? '',
            image: (profile.picture as string) ?? null,
            emailVerified: true,
        };
    },
}));

const federationPlugins =
    FEDERATION_ENABLED && oauthConfigs.length > 0 ? [genericOAuth({ config: oauthConfigs })] : [];

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET || 'change-me-to-a-random-64-char-secret',
    // Public URL of the auth handler (api.<domain>). Explicit so generated
    // links and OAuth callbacks resolve correctly behind the split.
    baseURL: BETTER_AUTH_URL,
    // The `db` pool above is Postgres (packages/core/src/db/index.ts, migrated off
    // mysql2 in Phase 4) and every table this adapter touches (user/session/account/
    // verification) is already pgTable with native boolean columns — this provider
    // flag was never updated to match. It only gated which fallback path the adapter
    // used (extra round-trips instead of native RETURNING/ilike), so flipping it is
    // a pure correctness/perf fix, not a schema or data change.
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema
    }),
    // A user who signed up here directly and later arrives via Vidyaverse must
    // land on the SAME account, not a duplicate that strands their progress and
    // org membership. Safe because these are the trio's own IdPs and any identity
    // they haven't verified is rejected in mapProfileToUser above.
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ['vidyaverse', 'vdl'],
            allowDifferentEmails: false,
        },
    },
    trustedOrigins: [
        APP_URL,
        'https://desktop-9mdcf0m.taile7a3e3.ts.net',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3334',
        'https://app.vinstitution.com'
    ].filter((v, i, a) => a.indexOf(v) === i),
    advanced: {
        // Distinct per app across the trio. Especially relevant here: once
        // crossSubDomainCookies is on, all three apps' cookies live on the same
        // parent domain, where better-auth's shared default name would collide.
        // Read everywhere via lib/auth/auth-cookies.ts — keep the two in step.
        cookiePrefix: AUTH_COOKIE_PREFIX,
        // Share the session cookie across app.<domain> and api.<domain> when a
        // parent COOKIE_DOMAIN is configured (production). No-op for local dev.
        ...(COOKIE_DOMAIN
            ? { crossSubDomainCookies: { enabled: true, domain: COOKIE_DOMAIN } }
            : {}),
    },
    // Throttle credential-stuffing and email-bomb abuse on the auth endpoints.
    // Per-IP, in-memory (per instance); the generous global ceiling keeps normal
    // app traffic flowing while the custom rules clamp the sensitive paths. The
    // client IP must arrive via X-Forwarded-For behind the proxy split.
    rateLimit: {
        enabled: true,
        window: 60,
        max: 120,
        customRules: {
            '/sign-in/email': { window: 60, max: 8 },
            '/sign-up/email': { window: 60, max: 5 },
            // Renamed in better-auth 1.6.x; '/forget-password' 404s, so a rule
            // guarding that path would throttle nothing.
            '/request-password-reset': { window: 900, max: 5 },
            '/reset-password': { window: 900, max: 8 },
            '/sign-in/magic-link': { window: 900, max: 5 },
        },
    },
    emailAndPassword: {
        enabled: true,
        // OIDC-via-Vidyaverse is now the only account-creation path (2026-08-06
        // identity reset). Sign-IN stays enabled -- the super-admin's break-glass
        // recovery path and any future password-reset-issued credential still
        // need it -- only new local sign-ups are blocked.
        disableSignUp: true,
        // Hard gate (B2B2C): users cannot sign in until they verify their email.
        // The verification email is sent on sign-up (emailVerification.sendOnSignUp)
        // and re-sent on a blocked sign-in attempt. OAuth/federated users arrive
        // pre-verified from the provider, so this only gates email/password signups.
        requireEmailVerification: true,
        sendResetPassword: async ({ user, token }) => {
            // Build the link from APP_URL, NOT better-auth's `url`. The client
            // passes a relative `redirectTo: '/reset-password'`, which better-auth
            // resolves against baseURL (= BETTER_AUTH_URL, the API host), yielding
            // api.<domain>/reset-password?token=… — a 404, because the reset PAGE
            // lives on the web app (app.<domain>). This is the same rule the
            // invitation email already follows (${APP_URL}/accept-invitation/…).
            const resetUrl = `${APP_URL.replace(/\/$/, '')}/reset-password?token=${token}`;
            await sendEmail({
                to: user.email,
                subject: 'Reset your DigiClassroom Pro password',
                html: emailLayout({
                    heading: 'Reset your password',
                    body: 'We received a request to reset your password. Click below to choose a new one. This link expires shortly.',
                    ctaLabel: 'Reset Password',
                    ctaUrl: resetUrl,
                }),
            });
        }
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url }) => {
            await sendEmail({
                to: user.email,
                subject: 'Verify your DigiClassroom Pro email',
                html: emailLayout({
                    heading: 'Verify your email',
                    body: 'Welcome to DigiClassroom Pro! Confirm your email address to activate your account.',
                    ctaLabel: 'Verify Email',
                    ctaUrl: url,
                }),
            });
        }
    },
    // Only register Google when REAL credentials are configured. Registering it
    // unconditionally makes better-auth render the sign-in button and send users
    // to Google with a placeholder client_id — a broken, confusing auth path.
    socialProviders: (() => {
        const clientId =
            process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        const isReal = (v?: string) =>
            Boolean(v && !v.startsWith('your_') && !v.toLowerCase().includes('placeholder'));
        return isReal(clientId) && isReal(clientSecret)
            ? { google: { clientId: clientId as string, clientSecret: clientSecret as string } }
            : {};
    })(),
    plugins: [
        ...federationPlugins,
        organization({
            allowUserToCreateOrganization: async (user) => {
                // Only super admins can create institutions directly
                return user.role === 'super_admin';
            },
            organizationLimit: 3,
            creatorRole: 'owner',
            async sendInvitationEmail(data) {
                const acceptUrl = `${APP_URL}/accept-invitation/${data.invitation.id}`;
                await sendEmail({
                    to: data.email,
                    subject: `You're invited to join ${data.organization.name} on DigiClassroom Pro`,
                    html: emailLayout({
                        heading: `Join ${data.organization.name}`,
                        body: `${data.inviter.user.email} invited you to join <strong>${data.organization.name}</strong> as <strong>${data.role}</strong> on DigiClassroom Pro.`,
                        ctaLabel: 'Accept Invitation',
                        ctaUrl: acceptUrl,
                    }),
                });
            }
        }),
        magicLink({
            // Magic link SIGNS IN existing users only — it must not create them.
            //
            // The plugin defaults `disableSignUp` to false and calls
            // internalAdapter.createUser, so without this flag anyone could type
            // any address, receive a link, and be provisioned an account. That
            // would silently reopen the door `emailAndPassword.disableSignUp`
            // was set to close (see the 2026-08-06 identity reset): local signup
            // shut on the front entrance while magic link stood open at the side.
            disableSignUp: true,
            sendMagicLink: async ({ email, url }) => {
                // The raw token is intentionally NOT logged (security).
                await sendEmail({
                    to: email,
                    subject: 'Your DigiClassroom Pro sign-in link',
                    html: emailLayout({
                        heading: 'Sign in to DigiClassroom Pro',
                        body: "Click below to sign in. This link is single-use and expires shortly. If you didn't request it, ignore this email.",
                        ctaLabel: 'Sign In',
                        ctaUrl: url,
                    }),
                });
            }
        })
    ],
    user: {
        additionalFields: {
            role: {
                type: 'string',
                required: false,
                defaultValue: 'student',
                // SECURITY: clients may NOT set their own role at signup/update.
                // Role is assigned server-side only (create hook / federation JIT /
                // admin APIs), so a crafted `role: 'super_admin'` payload is ignored.
                input: false
            },
            classId: {
                type: 'string',
                required: false
            }
        }
    },
    databaseHooks: {
        user: {
            create: {
                before: async (rawUser: {
                    email: string;
                    role?: string;
                    [key: string]: unknown;
                }) => {
                    // 0. Store the address canonically. Harmless on MySQL (already
                    //    case-insensitive by collation) and load-bearing on Postgres,
                    //    where a mixed-case row would make link-by-email miss and
                    //    duplicate the account instead of linking it.
                    //    (isDesignatedSuperAdmin below already compares case-
                    //    insensitively on its own — it does not depend on this.)
                    const user = { ...rawUser, email: normaliseEmail(rawUser.email) };

                    // 1. Platform owner from env — the ONLY way to ever become super_admin.
                    //    For an existing account use scripts/set-super-admin.ts (one-time).
                    if (isDesignatedSuperAdmin(user.email)) {
                        return { data: { ...user, role: 'super_admin' } };
                    }

                    // 2. SECURITY: strip any super_admin role that arrived from elsewhere
                    //    (a forged signup payload or a forged federation claim). Nobody
                    //    except the designated owner can hold super_admin — downgrade.
                    if (user.role === 'super_admin') {
                        return { data: { ...user, role: 'student' } };
                    }

                    // 3. Federated / OAuth accounts: preserve a non-student role the JIT
                    //    pipeline assigned (teacher, admin, …). It can never be super_admin
                    //    (handled above).
                    if (user.role && user.role !== 'student') {
                        return { data: user };
                    }

                    // 4. All other new signups default to 'student'. Role elevation
                    //    (teacher approval, org_admin assignment) happens through dedicated
                    //    admin flows, not at signup.
                    return { data: { ...user, role: 'student' } };
                }
            }
        },
        session: {
            create: {
                after: async (session) => {
                    if (!FEDERATION_ENABLED) return;
                    try {
                        await syncFederatedSession(session.userId);
                    } catch (err) {
                        console.error('[federation] syncFederatedSession failed:', err);
                    }
                }
            }
        }
    }
});

/**
 * Robust session resolver for monorepo split architecture (@repo/web on 3001, @repo/api on 3002).
 * Tries in-memory auth.api.getSession first, then falls back to fetching /api/auth/get-session over HTTP.
 */
export async function getSafeSession(headersList: any) {
    try {
        const session = await auth.api.getSession({ headers: headersList });
        if (session?.user) {
            return session;
        }
    } catch (err) {
        // Fallthrough to HTTP fallback
    }

    const cookieHeader = typeof headersList?.get === 'function'
        ? headersList.get('cookie')
        : (headersList?.cookie || '');
    
    if (!cookieHeader) {
        return null;
    }

    try {
        const apiUrl = process.env.API_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3002';
        const res = await fetch(`${apiUrl}/api/auth/get-session`, {
            headers: {
                cookie: cookieHeader,
            },
            cache: 'no-store',
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.user && data?.session) {
                return data;
            }
        }
    } catch (err) {
        console.error('[getSafeSession] HTTP fallback failed:', err);
    }

    return null;
}

