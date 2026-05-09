FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (legacy-peer-deps for react-leaflet compatibility)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# `NEXT_PUBLIC_*` doivent être disponibles au moment où `next build` tourne :
# Next.js inline ces valeurs dans les bundles JS au build (PAS au runtime).
# `.dockerignore` exclut volontairement `frontend/.env` pour ne pas baker de
# secret dans les layers d'image — on passe donc explicitement les vars via
# `docker-compose.yml` `build.args:` → `ARG` Dockerfile → `ENV` Dockerfile
# → `next build` qui les lit comme des env vars Node.
#
# Toute nouvelle var `NEXT_PUBLIC_*` ajoutée à frontend/.env.example DOIT
# aussi être déclarée ci-dessous + dans `docker-compose.yml` build.args (sinon
# valeur vide bundlée silencieusement, comportement inchangé pour code existant
# qui fallback sur valeur par défaut, mais chaque feature qui en dépend casse).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND
ARG NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT
ARG NEXT_PUBLIC_GLITCHTIP_RELEASE
ARG NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=${NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND} \
    NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT=${NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT} \
    NEXT_PUBLIC_GLITCHTIP_RELEASE=${NEXT_PUBLIC_GLITCHTIP_RELEASE} \
    NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS=${NEXT_PUBLIC_ENABLE_TEST_ERROR_ENDPOINTS}

# Build Next.js application
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="XCH Frontend" \
      org.opencontainers.image.description="XCH IT Management UI — Next.js" \
      org.opencontainers.image.version="1.1.1" \
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
