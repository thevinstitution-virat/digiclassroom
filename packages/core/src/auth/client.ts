import { createAuthClient } from "better-auth/react";
import { organizationClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    // The better-auth handler lives on the API host (api.<domain>). Point the
    // client there; NEXT_PUBLIC_API_URL is inlined into the web bundle at build
    // time. Falls back to same-origin for local/proxied dev.
    baseURL:
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== "undefined"
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"),
    // Send/receive the session cookie across subdomains.
    fetchOptions: {
        credentials: "include",
    },
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
