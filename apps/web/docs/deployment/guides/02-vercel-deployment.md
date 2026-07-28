# Step 2: Vercel Deployment Guide

## Overview
Deploy DigiClassroom Pro to Vercel with auto-deployment from GitHub, optimized for Indian users with Mumbai edge servers.

---

## 2.1 Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended for seamless integration)
3. Authorize Vercel to access your GitHub repositories

---

## 2.2 Install Vercel CLI

```powershell
# Install globally
npm i -g vercel

# Login to Vercel
vercel login
```

---

## 2.3 Connect GitHub Repository

### Option A: Via Vercel Dashboard (Recommended)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select `DigiClassroom-Pro` from your GitHub repos
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (leave as-is)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Click **Deploy**

### Option B: Via CLI
```powershell
cd "J:\DigiClassroom Pro"

# Link to Vercel project
vercel link

# Deploy to production
vercel --prod
```

---

## 2.4 Environment Variables

Go to: `Project Settings > Environment Variables`

Add all required variables:

### Authentication (Clerk)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Database (PlanetScale)
```
DATABASE_URL=mysql://xxx:xxx@aws.connect.psdb.cloud/virat_gyankosh?ssl={"rejectUnauthorized":true}
```

### Vector Database (Qdrant Cloud)
```
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=xxx
QDRANT_COLLECTION_NAME=ncert-books-enhanced
```

### Cache (Upstash Redis)
```
REDIS_URL=rediss://xxx@xxx.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### AI Services
```
OPENAI_API_KEY=sk-proj-xxx
```

### Application
```
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

> [!IMPORTANT]
> Set variables for **Production**, **Preview**, and **Development** environments as needed.

---

## 2.5 Update next.config.ts for Vercel

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,
  
  // Optimize images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.clerk.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Disable X-Powered-By header
  poweredByHeader: false,
  
  // Enable compression
  compress: true,
  
  // Optimize for Vercel Edge
  experimental: {
    // Enable PPR for faster page loads
    ppr: true,
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 2.6 Custom Domain Setup

### Add Domain in Vercel:
1. Go to `Project Settings > Domains`
2. Click **Add Domain**
3. Enter your domain: `digiclassroom.in`
4. Follow DNS configuration instructions

### Cloudflare DNS (Recommended for India):
```
Type    Name    Content              Proxy
CNAME   @       cname.vercel-dns.com  ✓
CNAME   www     cname.vercel-dns.com  ✓
```

### SSL Certificate:
Vercel automatically provisions SSL certificates. Your site will be HTTPS.

---

## 2.7 Edge Functions for India

Create edge-optimized API routes for faster response in India:

```typescript
// src/app/api/health/route.ts
export const runtime = 'edge';
export const preferredRegion = ['bom1']; // Mumbai

export async function GET() {
  return Response.json({ status: 'ok', region: 'bom1' });
}
```

Add to frequently-used API routes:
```typescript
// Add to any API route for edge optimization
export const runtime = 'edge';
export const preferredRegion = ['bom1']; // Mumbai edge
```

---

## 2.8 Vercel Analytics (Optional)

Enable built-in analytics:

```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Install packages:
```bash
npm install @vercel/analytics @vercel/speed-insights
```

---

## 2.9 Auto-Deploy Workflow

With GitHub connected, deployments happen automatically:

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production | `your-domain.com` |
| `development` | Preview | `dev-xxx.vercel.app` |
| Feature branches | Preview | `feature-xxx.vercel.app` |

---

## 2.10 Vercel.json Configuration (Optional)

Create `vercel.json` for advanced settings:

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["bom1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=60, stale-while-revalidate=300" }
      ]
    }
  ]
}
```

---

## ✅ Verification Checklist

- [ ] Vercel account created
- [ ] GitHub repository connected
- [ ] Environment variables configured
- [ ] Custom domain added (if available)
- [ ] SSL certificate active
- [ ] Test deployment successful
- [ ] Analytics enabled (optional)

---

## 💰 Cost Breakdown

| Plan | Price | Includes |
|------|-------|----------|
| Hobby (Free) | ₹0 | 100GB bandwidth, basic analytics |
| Pro | ₹1,700/mo | 1TB bandwidth, advanced features |
| Enterprise | Custom | Unlimited, SLA, support |

**Start with Free tier, upgrade when needed!**

---

## Next Step
→ [Step 3: PlanetScale Database Migration](./03-planetscale-setup.md)
