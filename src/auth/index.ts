import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, magicLink } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { db } from '../db';
import * as schema from '../db/schema';
import { syncFederatedSession } from '../lib/federation/jit';
import { sendEmail, emailLayout } from '../lib/email/send-email';
import { isDesignatedSuperAdmin } from '../lib/auth/super-admin-guard';

// Federation toggle — when off, the existing email/password + Google paths are
// unchanged. See Vidyaverse Pro/docs/identity-federation-design.md §8.
const FEDERATION_ENABLED = process.env.FEDERATION_ENABLED === 'true';
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

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
    redirectURI: `${BETTER_AUTH_URL}/api/auth/oauth2/callback/${cp.providerId}`,
    mapProfileToUser: (profile: Record<string, unknown>) => ({
        email: profile.email as string,
        name: (profile.name as string) ?? '',
        image: (profile.picture as string) ?? null,
        emailVerified: !!profile.email_verified,
    }),
}));

const federationPlugins =
    FEDERATION_ENABLED && oauthConfigs.length > 0 ? [genericOAuth({ config: oauthConfigs })] : [];

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'mysql',
        schema
    }),
    trustedOrigins: [
        'https://desktop-9mdcf0m.taile7a3e3.ts.net',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3334',
        'https://app.vinstitution.com'
    ],
    emailAndPassword: {
        enabled: true,
        // Hard gate (B2B2C): users cannot sign in until they verify their email.
        // The verification email is sent on sign-up (emailVerification.sendOnSignUp)
        // and re-sent on a blocked sign-in attempt. OAuth/federated users arrive
        // pre-verified from the provider, so this only gates email/password signups.
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
            await sendEmail({
                to: user.email,
                subject: 'Reset your DigiClassroom Pro password',
                html: emailLayout({
                    heading: 'Reset your password',
                    body: 'We received a request to reset your password. Click below to choose a new one. This link expires shortly.',
                    ctaLabel: 'Reset Password',
                    ctaUrl: url,
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
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET as string,
        },
    },
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
                const acceptUrl = `${BETTER_AUTH_URL}/accept-invitation/${data.invitation.id}`;
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
                before: async (user: {
                    email: string;
                    role?: string;
                    [key: string]: unknown;
                }) => {
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
        // @ts-ignore
                        await syncFederatedSession(session.userId);
                    } catch (err) {
                        console.error('[federation] syncFederatedSession failed:', err);
                    }
                }
            }
        }
    }
});
