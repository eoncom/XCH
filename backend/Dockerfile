FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (OpenSSL for Prisma + Python/build-tools for bcrypt + poppler for PDF)
RUN apk add --no-cache openssl python3 make g++ poppler-utils

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Skip Chromium download for puppeteer (not needed in Docker)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="XCH Backend" \
      org.opencontainers.image.description="XCH IT Management API — NestJS" \
      org.opencontainers.image.version="1.1.1" \
      org.opencontainers.image.vendor="eoncom"

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Runtime dependencies only — bcrypt native addon is copied from builder
RUN apk add --no-cache openssl poppler-utils

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm install --omit=dev --legacy-peer-deps

# Copy Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy bcrypt native addon from builder (avoids python3/make/g++ in prod)
COPY --from=builder /app/node_modules/bcrypt ./node_modules/bcrypt

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy Casbin configuration
COPY --from=builder /app/casbin /casbin

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
