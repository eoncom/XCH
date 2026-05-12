# Stack Technique XCH

Version : 1.1.1
Mise a jour : 2026-04-06

## Vue d'ensemble

XCH est une application web full-stack TypeScript avec architecture monolithe modulaire.

**Principe** : Stack JavaScript/TypeScript moderne pour productivite maximale et type-safety bout en bout.

---

## Backend

### Framework principal

**NestJS 10** (Node.js + TypeScript)
- Architecture modulaire (controllers, services, repositories)
- Dependency injection native
- 15+ modules metier (sites, assets, racks, tasks, contacts, expenses, notifications, etc.)
- Filtre d'exceptions global (Prisma errors -> HTTP codes)
- Pagination serveur sur tous les endpoints de liste

### Base de donnees

**PostgreSQL 15** + **PostGIS**
- Extension PostGIS pour geospatialisation (carte chantiers, coordonnees GPS)
- Support JSON/JSONB pour metadonnees flexibles
- Row-Level Security (RLS) pour isolation multi-tenant

**ORM : Prisma**
- Type-safety DB <-> API
- Migrations versionnees (prisma migrate deploy)
- Client TypeScript auto-genere
- ~20 modeles (Tenant, User, Site, Asset, Rack, Task, FloorPlan, Pin, Contact, Expense, BillingEntity, NotificationConfig, NotificationLog, Division, Delegation, UserScope, etc.)

### Cache

**Redis 7**
- Cache applicatif
- Sessions utilisateurs
- Rate limiting

### Stockage fichiers

**MinIO** (on-premise, API S3-compatible)
- Buckets : xch-storage, plans, photos, exports, qrcodes, xch-backups
- Nettoyage automatique a la suppression (cascade)

### Permissions

**Casbin**
- Moteur RBAC policy-based
- 4 roles : ADMIN, MANAGER, TECHNICIEN, VIEWER
- Policies persistees PostgreSQL (TypeORM adapter)

### Authentification

**Passport.js**
- Strategy `local` : email/password (bcrypt)
- Strategy `oidc` : OpenID Connect (Microsoft Entra ID, Keycloak)
- JWT tokens : access (15min) + refresh (7j)
- Invitation par email : token 72h
- Reset password : token 1h

### Notifications

**Nodemailer** (Email SMTP)
- Templates HTML configurables
- Fallback console log en developpement

**Microsoft Teams** (Webhooks)
- Adaptive Cards pour messages riches

**Configuration multi-scope**
- Heritage tenant > division > delegation
- 7 types d'evenements configurables
- Logs avec statut succes/erreur

### Generation documents

- **QR Codes** : `qrcode` (Node.js)
- **PDF** : `Puppeteer` (rendu HTML -> PDF)
- **CSV/Excel** : `papaparse` + `xlsx`
- **Export ZIP** : plans PDF avec pins + equipements en baies

---

## Frontend

### Framework

**Next.js 15** (React 19 + TypeScript 5.7)
- App Router
- PWA manifest + icons
- Responsive design mobile-first

### UI

**shadcn/ui** + **Tailwind CSS 3.4**
- Composants React modernes (Radix UI sous-jacent)
- Dark mode natif
- AlertDialog pour confirmations (remplace window.confirm)

### State Management

**Zustand** : etat global (user, tenant config)
**TanStack Query 5** : server state (cache API, pagination, sync automatique)

### Cartes interactives

**Leaflet** + **React Leaflet**
- Clustering avec markers personnalises
- Popups, geolocalisation

### Visualisation plans

**Konva.js** (React Konva)
- Canvas HTML5 interactif (zoom/pan)
- Drag & drop pins avec formes distinctives par type
- Heatmap Wi-Fi (modele FSPL Friis, 4 bandes)
- Export PNG avec legende

### Formulaires

**React Hook Form** + **Zod**
- Validation declarative
- Type-safety

### Animations

**Framer Motion**
- Transitions fluides entre pages/etats

---

## Infrastructure

### Docker Compose

Services :
- `backend` : NestJS (image Docker optimisee, bcrypt pre-compile)
- `frontend` : Next.js (image Docker optimisee)
- `postgres` : PostgreSQL 15 + PostGIS
- `redis` : Redis 7 Alpine
- `minio` : MinIO + minio-init (creation buckets)
- `backend-worker` : Worker XCH natif (sondes ICMP/HTTP/TCP via BullMQ, ADR-014)
- `nginx` : Reverse proxy (profil optionnel, pour deployments sans proxy externe)

### Reverse proxy

**Nginx integre** (profil Docker `proxy`) ou **Nginx Proxy Manager** externe
- Routing : /api/* -> backend, /storage/* -> minio, /* -> frontend
- SSL/TLS configurable

### CI/CD

**GitHub Actions**
- Tests E2E Playwright
- Push/PR sur main et develop

### Monitoring

**Surveillance native XCH (ADR-014 + ADR-016)**
- Worker NestJS dédié partageant l'image backend (`node dist/main --worker`)
- Sondes ICMP / HTTP / TCP (CAP_NET_RAW pour ICMP réel, fallback TCP:80)
- BullMQ + scheduler @Cron 30s, retry exponentiel sur erreurs transitoires
- HealthAggregationService recompute Site.healthStatus en temps réel sur transition
- Notifications MONITOR_DOWN / MONITOR_UP via NotificationConfigService (héritage délégation)
- SSRF defense en profondeur : validateUrl/validateHost + safe-lookup DNS hook
- Aucune dépendance monitoring externe (ADR-016)

---

## Resume des choix

| Composant | Technologie |
|-----------|-------------|
| Backend | NestJS 10 + TypeScript |
| Frontend | Next.js 15 + React 19 |
| Database | PostgreSQL 15 + PostGIS |
| ORM | Prisma (migrations versionnees) |
| Cache | Redis 7 |
| Storage | MinIO (S3-compatible) |
| Auth | Passport (local + OIDC) |
| Permissions | Casbin (RBAC 4 roles) |
| UI | shadcn/ui + Tailwind CSS |
| Cartes | Leaflet |
| Plans | Konva.js |
| Notifications | Nodemailer + Teams webhooks |
| QR | qrcode + @zxing/browser |
| PDF | Puppeteer |
| Surveillance | Worker XCH natif (BullMQ + ICMP/HTTP/TCP) |
| Reverse proxy | Nginx / Nginx Proxy Manager |
| CI/CD | GitHub Actions |
| Deploiement | Docker Compose |
