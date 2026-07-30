import type { NextConfig } from 'next'
import path from 'path'

// Bundle analyzer setup
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})


const nextConfig: NextConfig = {
  // Standalone output: Next traces the files actually reachable at runtime and
  // emits a self-contained server, instead of the image shipping the whole
  // hoisted node_modules. `outputFileTracingRoot` points at the workspace root
  // so the tracer can follow deps hoisted above apps/web — without it, tracing
  // starts at apps/web and misses them.
  //
  // (An earlier note here claimed this conflicted with the custom webpack
  // config below. It does not: tracing runs after bundling and is independent
  // of splitChunks / output.globalObject.)
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Compile the shared workspace packages (TS source) directly.
  transpilePackages: ['@repo/shared', '@repo/core'],
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    "app.vinstitution.com",
    "desktop-9mdcf0m.taile7a3e3.ts.net"
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "vinstitution.com",
        "*.vinstitution.com",
        "desktop-9mdcf0m.taile7a3e3.ts.net",
        "recollect-resonate-clone.ngrok-free.dev"
      ]
    }
  },
  // Back-compat: the platform-owner surfaces were renamed admin → super-admin.
  // These 307 redirects keep any old /dashboard/admin/* or /api/admin/* URL
  // (bookmarks, external callers, missed links) working. 307 preserves the
  // HTTP method + body, so POST/PUT/DELETE API calls survive the redirect.
  // NOTE: this only rewrites the URL PATH — it does NOT touch the `admin` ROLE
  // (which is the institution administrator, distinct from super_admin).
  async redirects() {
    return [
      { source: '/dashboard/admin', destination: '/dashboard/super-admin', permanent: false },
      { source: '/dashboard/admin/:path*', destination: '/dashboard/super-admin/:path*', permanent: false },
      { source: '/api/admin', destination: '/api/super-admin', permanent: false },
      { source: '/api/admin/:path*', destination: '/api/super-admin/:path*', permanent: false },
    ];
  },
  // Security headers on every response. CSP is omitted here on purpose — it must
  // be tuned against inline scripts/styles and the RAG/embed widgets, so it
  // belongs in its own tested change. These are safe to apply unconditionally.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
  // Proxy all API traffic to the standalone API service. This keeps every
  // relative `/api/...` call (fetch + tRPC + better-auth) same-origin with the
  // web app, so cookies and server-side session checks work without CORS or
  // cross-subdomain cookies. The API remains a separately deployable service;
  // set API_URL to its origin (defaults to the local api dev port).
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3002'
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
    ]
  },
  serverExternalPackages: ['mysql2', 'pdf-parse', 'tesseract.js', 'pdf2pic'],
  ...(process.env.TURBOPACK !== '1' ? {
    webpack(config, { isServer, dev }) {
      // Ensure UMD/global wrappers use a Node-safe global
      if (isServer) {
        config.output = config.output || {};
        // Avoid 'self is not defined' in SSR by using globalThis
        // for libraries that expect 'self' or 'window'
        // See: https://webpack.js.org/configuration/output/#outputglobalobject
        // and common SSR vendor issues
        // @ts-ignore
        config.output.globalObject = 'globalThis';
      }


      // Enhanced code splitting and memory optimizations
      if (!dev && !isServer) {
        config.optimization.splitChunks = {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // Core React libraries
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
            },
            // UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|@heroicons)[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 15,
            },
            // Animation libraries
            animation: {
              test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
              name: 'animation',
              chunks: 'all',
              priority: 10,
            },
            // Other vendor libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 1,
            }
          }
        };
      }

      if (dev) {
        // Reduce bundle analysis in development
        config.infrastructureLogging = { level: 'warn' }
      }

      // Browser-only polyfill disables for OCR/PDF libs. MUST be scoped to the
      // client compile: applying fs/path/os: false to the SERVER build breaks
      // Next's own internals (next/dist/pages/_document.js), which surfaces as
      // "Module not found: Can't resolve '../shared/lib/utils'" — and blocks
      // outputFileTracingRoot. Keep these inside `if (!isServer)`.
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          canvas: false,
          fs: false,
          path: false,
          os: false,
          crypto: false,
          stream: false,
          util: false,
          buffer: false,
          events: false
        };

        // Fix for pdfjs-dist webpack issues in Next.js 15
        // Prevent "Object.defineProperty called on non-object" error
        config.resolve.alias = {
          ...config.resolve.alias,
          'pdfjs-dist/build/pdf.worker.entry': 'pdfjs-dist/build/pdf.worker.mjs',
        };
      }

      return config;
    }
  } : {})
}

export default withBundleAnalyzer(nextConfig)
