import { createAuthClient } from "better-auth/react";
import { organizationClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    // Talk to the SAME origin that served the page (works on any dev port —
    // 3000 / 3001). A hard-coded NEXT_PUBLIC_APP_URL drifts from the
    // actual dev-server port and breaks sign-in with ERR_CONNECTION_REFUSED.
    baseURL:
        typeof window !== "undefined"
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
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
    forgetPassword,
    resetPassword,
    organization,
    useListOrganizations,
    useActiveOrganization
} = authClient;
