# Step 5: Upstash Redis Setup

## Overview
Set up Upstash serverless Redis for caching AI responses, sessions, and improving app performance.

---

## 5.1 Create Upstash Account

1. Go to [console.upstash.com](https://console.upstash.com)
2. Sign up with GitHub
3. Verify email

---

## 5.2 Create Redis Database

1. Click **Create Database**
2. **Name**: `digiclassroom-cache`
3. **Region**: `ap-south-1-1` (Mumbai)
4. **Type**: Regional (cheaper) or Global (faster worldwide)
5. **TLS**: Enabled (required for production)
6. Click **Create**

---

## 5.3 Get Connection Details

After creation, copy:

```env
# REST API (recommended for serverless)
UPSTASH_REDIS_REST_URL=https://apn1-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

# Standard Redis URL
REDIS_URL=rediss://default:xxx@apn1-xxx.upstash.io:6379
```

---

## 5.4 Install Upstash SDK

```bash
npm install @upstash/redis
```

---

## 5.5 Configure Redis Client

```typescript
// src/lib/cache/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache utility functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

export async function cacheSet(
  key: string, 
  value: unknown, 
  exSeconds = 3600
): Promise<void> {
  await redis.setex(key, exSeconds, value);
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}
```

---

## 5.6 Implement Caching Strategy

### Cache AI Tutor Responses:
```typescript
// src/lib/ai/cached-tutor.ts
import { redis } from '../cache/redis';
import { generateAIResponse } from './openai';

export async function getCachedAIResponse(
  question: string,
  context: { board: string; classLevel: number; subject: string }
) {
  // Create cache key from question hash
  const cacheKey = `ai:${context.board}:${context.classLevel}:${context.subject}:${hashQuestion(question)}`;
  
  // Try cache first
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    return { response: cached, fromCache: true };
  }
  
  // Generate new response
  const response = await generateAIResponse(question, context);
  
  // Cache for 24 hours
  await redis.setex(cacheKey, 86400, response);
  
  return { response, fromCache: false };
}

function hashQuestion(q: string): string {
  // Simple hash for cache key
  return Buffer.from(q.toLowerCase().trim()).toString('base64').slice(0, 32);
}
```

### Cache User Sessions:
```typescript
// Session caching
export async function cacheUserSession(userId: string, data: object) {
  await redis.setex(`session:${userId}`, 3600, data); // 1 hour
}

export async function getUserSession(userId: string) {
  return redis.get(`session:${userId}`);
}
```

---

## 5.7 Rate Limiting

```typescript
// src/lib/cache/rate-limit.ts
import { redis } from './redis';

export async function checkRateLimit(
  userId: string,
  limit: number = 30, // questions per day
  window: number = 86400 // 24 hours
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${userId}:${new Date().toISOString().split('T')[0]}`;
  
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, window);
  }
  
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}
```

---

## 5.8 Environment Variables

Add to Vercel:
```env
UPSTASH_REDIS_REST_URL=https://apn1-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx
REDIS_URL=rediss://default:xxx@apn1-xxx.upstash.io:6379
```

---

## ✅ Verification Checklist

- [ ] Upstash account created
- [ ] Database in Mumbai region
- [ ] Connection credentials saved
- [ ] Redis client configured
- [ ] Caching implemented
- [ ] Rate limiting tested

---

## 💰 Pricing

| Plan | Price | Commands/Day |
|------|-------|--------------|
| Free | ₹0 | 10,000 |
| Pay-as-you-go | ₹0.2/10K commands | Unlimited |
| Pro | ₹850/mo | 1M/day |

---

## Next Step
→ [Step 6: Expo Mobile App Setup](./06-expo-mobile-setup.md)
