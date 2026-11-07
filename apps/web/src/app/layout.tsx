import type { Metadata } from "next";

import { TRPCProvider } from '@/lib/trpc/provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { NotificationProvider } from '@/components/providers/notification-provider'
// Global CSS entry
import "./globals.css";
// Bring in additional global styles explicitly (avoid @import inside CSS)
import "../styles/vg-design-system.css";
import "../styles/vg-animations.css";
import "../styles/apple-landing.css";
import "../styles/whatsapp-chat.css";
// Landing-only, scoped under `.dcl` — a faithful port of the redesign mock.
import "../styles/landing-indic.css";
// Dashboards-only, scoped under `.dcd` — a faithful port of the redesign mock.
import "../styles/dashboards-indic.css";
// Student-app-only, scoped under `.dcs` — a faithful port of the redesign mock.
import "../styles/student-indic.css";
// Indic design system — vendored from PDLMS (canonical source of truth).
// Do not edit files under design/indic/; edit them in PDLMS and re-run
// `node shared/design/indic/sync-indic.mjs`. Order is load-bearing: pigments,
// then this app's accent picked from them, then the system that consumes both,
// then the bridge that maps the accent onto shadcn's semantic tokens.
import "../design/indic/indic-tokens.css";
import "../design/indic/indic-app.css";
import "../design/indic/indic-design-system.css";
import "../styles/indic-bridge.css";
// Self-hosted fonts, imported here rather than from CSS so Next and Vite
// resolve them identically across the trio. Must precede indic-fonts.css.
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/yatra-one/400.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "../design/indic/indic-fonts.css";

export const metadata: Metadata = {
  title: "Virat Gyankosh - AI-Powered Educational Platform",
  description: "Revolutionizing personalized learning through intelligent AI agents and multi-tenant role-based access control",
  keywords: ["education", "AI", "learning", "tutoring", "personalized learning"],
  authors: [{ name: "Virat Gyankosh Team" }],
  openGraph: {
    title: "Virat Gyankosh - AI-Powered Educational Platform",
    description: "Revolutionizing personalized learning through intelligent AI agents",
    type: "website",
  },
  icons: {
    // Mandala mark, generated per-app from the Indic tokens
    // (shared/design/indic/build-indic-css.mjs) and synced into public/.
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Fonts are self-hosted via @fontsource (see imports above) — no
            render-blocking request to fonts.googleapis.com. */}
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
