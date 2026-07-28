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
        // @ts-ignore
    forgetPassword,
    resetPassword,
    organization,
    useListOrganizations,
    useActiveOrganization
} = authClient;
