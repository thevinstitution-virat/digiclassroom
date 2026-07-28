import type { NextConfig } from 'next'

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

export default nextConfig
