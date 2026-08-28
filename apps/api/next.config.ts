import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Headless API app: serves only route handlers under src/app/api (REST + tRPC
// + better-auth). No UI pages. Deploys independently as api.<domain>.
const nextConfig: NextConfig = {
  // Standalone output for Docker/Coolify (emits .next/standalone/server.js).
  output: 'standalone',
  // Compile the shared workspace packages (TS source) directly.
  transpilePackages: ['@repo/shared', '@repo/core'],
  typescript: {
    // Matches the web app: don't fail the production build on type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Security headers on every API response. CSP is omitted on purpose — this is
  // a headless JSON API with no HTML/inline scripts to constrain. Mirrors the web
  // app's set (apps/web/next.config.ts); X-Frame-Options is DENY here because API
  // responses are never framed. Applied unconditionally, safe for all callers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
  // Native/heavy deps that must stay external to the server bundle.
  serverExternalPackages: ['mysql2', 'pdf-parse', 'tesseract.js', 'pdf2pic'],
  ...(process.env.TURBOPACK !== '1'
    ? {
        webpack(config, { isServer }: { isServer: boolean }) {
          if (isServer) {
            config.output = config.output || {}
            // Avoid 'self is not defined' in SSR for libraries expecting a browser global.
            config.output.globalObject = 'globalThis'
          }
          return config
        },
      }
    : {}),
}

// GlitchTip is self-hosted and needs no source-map upload, so it is disabled
// (also avoids requiring @sentry/cli / an auth token at build time).
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
  disableLogger: true,
})
