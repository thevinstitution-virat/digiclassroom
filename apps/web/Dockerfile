# ============================================================================
# DigiClassroom — web (frontend). Monorepo build, run via `next start`.
#
# Why not `output: 'standalone'`? In an npm-workspace monorepo the shared deps
# are hoisted to the repo-root node_modules, which Next's standalone tracer
# (rooted at apps/web) can't see, and the fix (outputFileTracingRoot) breaks
# this app's custom webpack build. So we ship a pruned node_modules + run
# `next start` — deterministic, and unaffected by the tracing/webpack issues.
#
# Build CONTEXT must be the REPO ROOT. In Coolify:
#   Build Pack = Dockerfile, Base Directory = / ,
#   Dockerfile Location = apps/web/Dockerfile, Ports Exposes = 3000.
# NEXT_PUBLIC_* are inlined at BUILD time — pass them as build args.
# Debian-slim base (not Alpine) to avoid musl native-binding surprises.
# ============================================================================

# ---- deps: full workspace install (incl. devDeps, needed by the build) ------
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --include=dev

# ---- builder: build @repo/web ----------------------------------------------
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
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

# ---- pruner: strip devDependencies, keep only runtime deps ------------------
FROM node:20-slim AS pruner
WORKDIR /app
COPY --from=builder /app ./
RUN npm prune --omit=dev

# ---- runner ----------------------------------------------------------------
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=UTC
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Keep node_modules at the repo root (same relative position as the monorepo)
# so Node's module resolution walk-up from apps/web finds it. Do NOT flatten.
COPY --from=pruner --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=pruner --chown=nextjs:nodejs /app/packages ./packages
COPY --from=pruner --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json

RUN mkdir -p /app/apps/web/uploads /app/apps/web/logs /app/apps/web/tmp && \
    chown -R nextjs:nodejs /app/apps/web/uploads /app/apps/web/logs /app/apps/web/tmp
USER nextjs

WORKDIR /app/apps/web
EXPOSE 3000

# next is resolved from the hoisted /app/node_modules via the workspace bin.
CMD ["node", "../../node_modules/next/dist/bin/next", "start", "-p", "3000"]
