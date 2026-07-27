# ============================================================================
# DigiClassroom Pro — Coolify production (Next.js standalone).
# Requires `output: 'standalone'` in next.config.ts.
# In Coolify: Build Pack = Dockerfile, Base Directory = /, Ports Exposes = 3000.
# NEXT_PUBLIC_* are inlined into the bundle at BUILD time — add them in Coolify
# as env vars (passed as build args below).
# ============================================================================

# ---- deps: full install (incl. devDeps, which `next build` needs) ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
# HUSKY=0 skips the `prepare` git-hook script (no .git in the image).
ENV HUSKY=0
COPY package.json package-lock.json ./
# --include=dev: Coolify injects NODE_ENV=production, which makes npm drop
# devDependencies (typescript, tailwind, etc.) that the build requires.
RUN npm ci --include=dev

# ---- builder ---------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* must exist at build time to be baked into the client bundle.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_API_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_GOOGLE_API_KEY=$NEXT_PUBLIC_GOOGLE_API_KEY \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

RUN npm run build

# ---- runner (production) — LAST stage, so it's Coolify's default target -----
FROM node:20-alpine AS production
RUN apk add --no-cache curl ca-certificates tzdata libc6-compat
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=UTC
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone output: a minimal self-contained server (server.js) + traced deps.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/uploads /app/logs /app/tmp && \
    chown -R nextjs:nodejs /app/uploads /app/logs /app/tmp
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
