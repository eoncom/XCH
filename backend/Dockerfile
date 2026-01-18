FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (OpenSSL for Prisma + Python/build-tools for bcrypt)
RUN apk add --no-cache openssl python3 make g++

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

# Install runtime dependencies (OpenSSL for Prisma + Python/build-tools for bcrypt)
RUN apk add --no-cache openssl python3 make g++

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

# Expose port
EXPOSE 3002

# Start application
CMD ["npm", "run", "start:prod"]
