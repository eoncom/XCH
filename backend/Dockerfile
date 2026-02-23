FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (OpenSSL for Prisma + Python/build-tools for bcrypt + poppler for PDF→PNG conversion)
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

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies (OpenSSL for Prisma + Python/build-tools for bcrypt + poppler for PDF→PNG conversion)
RUN apk add --no-cache openssl python3 make g++ poppler-utils

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Skip Chromium download for puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install production dependencies only
RUN npm install --omit=dev --legacy-peer-deps

# Copy Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy Casbin configuration
COPY --from=builder /app/casbin /casbin

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port (internal Docker port; nginx proxies to this)
EXPOSE 3000

# Start: run migrations then launch app
ENTRYPOINT ["/docker-entrypoint.sh"]
