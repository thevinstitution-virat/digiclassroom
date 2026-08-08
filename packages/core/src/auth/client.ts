import { createAuthClient } from "better-auth/react";
import { organizationClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    // Same-origin: /api/auth is proxied to the API service by the web rewrite,
    // so the session cookie is set on (and sent from) the web origin.
    baseURL:
        typeof window !== "undefined"
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
    plugins: [
        organizationClient(),
        magicLinkClient()
    ]
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    // `requestPasswordReset`, not `forgetPassword`.
    //
    // better-auth renamed this: 1.6.x serves POST /api/auth/request-password-reset
    // and no longer serves /forget-password at all. The old name was still
    // exported here behind a `// @ts-ignore` — which is precisely what hid the
    // breakage, because the compiler HAD flagged it
    // ("Property 'forgetPassword' does not exist", recorded in
    // apps/web/audit/ts-baseline-phase2a.txt). Suppressed error, shipped 404,
    // password reset dead in production for every user.
    requestPasswordReset,
    resetPassword,
    organization,
    useListOrganizations,
    useActiveOrganization
} = authClient;
