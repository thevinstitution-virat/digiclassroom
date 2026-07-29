/**
 * Session cookie naming — single source of truth for DigiClassroom.
 *
 * All three apps in the trio currently use better-auth's default (`better-auth.*`).
 * That is harmless while cookies stay host-scoped, but single logout requires the
 * apps to share a `.vinstitution.com` parent — and DCP already sets
 * `crossSubDomainCookies` when COOKIE_DOMAIN is configured, so it is the app most
 * likely to hit the collision first.
 *
 * NOTE: changing AUTH_COOKIE_PREFIX invalidates every existing session — better-auth
 * will not recognise a cookie stored under the old name. Deploy it deliberately.
 */

/** Must match `advanced.cookiePrefix` in packages/core/src/auth/index.ts. */
export const AUTH_COOKIE_PREFIX = 'better-auth';

export const SESSION_COOKIE = `${AUTH_COOKIE_PREFIX}.session_token`;
export const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;
export const ACTIVE_ORG_COOKIE = `${AUTH_COOKIE_PREFIX}.active_organization`;
export const SECURE_ACTIVE_ORG_COOKIE = `__Secure-${ACTIVE_ORG_COOKIE}`;

/** Secure first — that is what production actually sets. */
export const ACTIVE_ORG_COOKIE_NAMES: readonly string[] = [
    SECURE_ACTIVE_ORG_COOKIE,
    ACTIVE_ORG_COOKIE,
];
