# ────────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
#   Install only production node_modules so the cache is reused when only source
#   files change.
# ────────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# libc compatibility needed by some native addons
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
# BuildKit cache mount: npm package cache persists between builds even when
# package.json changes, so only changed packages are re-downloaded.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --prefer-offline

# ────────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder
#   Compile TypeScript, run Next.js build, produce the standalone bundle.
# ────────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Build-time env vars (no secrets in the image)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ────────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner
#   Minimal production image using the standalone Next.js output.
#   Final image size is typically 100-200 MB instead of 1+ GB.
# ────────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Build-time metadata injected by GitHub Actions
ARG GIT_BRANCH=local
ARG GIT_SHA=unknown

LABEL org.opencontainers.image.source="https://github.com/avneetpandey82/lip-sync" \
    org.opencontainers.image.revision="${GIT_SHA}" \
    org.opencontainers.image.ref.name="${GIT_BRANCH}"

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs

# Copy the standalone server bundle (contains its own node_modules subset)
COPY --from=builder /app/.next/standalone ./

# Copy static assets (CSS, JS chunks, images)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the public directory (favicons, 3D models, audio files, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# next/standalone produces a self-contained server.js at the root
CMD ["node", "server.js"]
