FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (legacy-peer-deps for react-leaflet compatibility)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="XCH Frontend" \
      org.opencontainers.image.description="XCH IT Management UI — Next.js" \
      org.opencontainers.image.version="1.0.0-rc1" \
      org.opencontainers.image.vendor="eoncom"

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install production dependencies only (no TypeScript needed — config is .mjs)
RUN npm install --omit=dev --legacy-peer-deps

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3001

CMD ["npm", "run", "start"]
