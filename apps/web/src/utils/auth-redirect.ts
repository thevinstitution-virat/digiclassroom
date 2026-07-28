/**
 * Resolve a post-auth redirect target to an absolute URL on the web origin.
 *
 * better-auth resolves a relative `callbackURL` against its own baseURL, which
 * is the API host (api.<domain>) — so a bare "/dashboard" would land the user on
 * api.<domain>/dashboard, which serves no pages. Anchoring it to the web origin
 * keeps the user on the app.
 *
 * Absolute values are passed through unchanged; better-auth still validates them
 * against trustedOrigins, so a hostile ?redirect_url= cannot become an open
 * redirect.
 */
export function toAppUrl(target: string): string {
    if (typeof window === 'undefined') return target;
    try {
        return new URL(target, window.location.origin).toString();
    } catch {
        return new URL('/dashboard', window.location.origin).toString();
    }
}
