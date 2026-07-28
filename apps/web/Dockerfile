# ============================================================================
# DigiClassroom — web (frontend) — Next.js standalone, monorepo build.
# Build CONTEXT must be the REPO ROOT (so packages/* are available).
# In Coolify: Build Pack = Dockerfile, Base Directory = / ,
#   Dockerfile Location = apps/web/Dockerfile, Ports Exposes = 3000.
# NEXT_PUBLIC_* are inlined at BUILD time — pass them as build args.
# ============================================================================

# ---- deps: install the whole workspace (incl. devDeps for the build) --------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
ENV HUSKY=0
# Copy the root manifest + every workspace manifest so npm can resolve the graph.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/shared/package.json ./packages/shared/package.json
# --include=dev: Coolify sets NODE_ENV=production, which would drop devDeps.
RUN npm ci --include=dev

# ---- builder ---------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* must exist at build time to be baked into the client bundle.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_API_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_FEDERATION_ENABLED
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_GOOGLE_API_KEY=$NEXT_PUBLIC_GOOGLE_API_KEY \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_FEDERATION_ENABLED=$NEXT_PUBLIC_FEDERATION_ENABLED

RUN npm run build --workspace=@repo/web

# ---- runner (production) — LAST stage, Coolify's default target -------------
FROM node:20-alpine AS production
RUN apk add --no-cache curl ca-certificates tzdata libc6-compat
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=UTC
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Monorepo standalone layout (outputFileTracingRoot = repo root):
#   .next/standalone/apps/web/server.js  + /node_modules + /packages
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

RUN mkdir -p /app/apps/web/uploads /app/apps/web/logs /app/apps/web/tmp && \
    chown -R nextjs:nodejs /app/apps/web/uploads /app/apps/web/logs /app/apps/web/tmp
USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
