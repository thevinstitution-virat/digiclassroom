import type { NextConfig } from 'next'

// Bundle analyzer setup
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
// Webpack access for DefinePlugin workaround
const webpack = require('webpack')

const nextConfig: NextConfig = {
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
  experimental: {
    webpackMemoryOptimizations: true
  },
  serverExternalPackages: ['mysql2', 'pdf-parse', 'tesseract.js', 'pdf2pic'],
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
    // Enable cache in production only; disable in dev to avoid stale chunk errors on Windows
    if (dev) {
      config.cache = false
    } else {
      config.cache = {
        type: 'filesystem',
        cacheDirectory: require('path').resolve('.next/cache/webpack')
      }
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
          // Authentication
          auth: {
            test: /[\\/]node_modules[\\/](@clerk)[\\/]/,
            name: 'auth',
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
      config.optimization.removeAvailableModules = false;
      config.optimization.removeEmptyChunks = false;
      config.optimization.splitChunks = false;
      // Disable persistent cache to prevent 'Cannot find module ./*.js' on Windows
      config.infrastructureLogging = { level: 'warn' }
    }
    
    // Existing fallbacks for OCR and PDF processing
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

    return config;
  }
}

export default withBundleAnalyzer(nextConfig)
