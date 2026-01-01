# Stack Technique XCH

Date : 2025-12-31
Version : 1.0

## Vue d'ensemble

XCH est une application web full-stack TypeScript avec architecture monolithe modulaire.

**Principe** : Stack JavaScript/TypeScript moderne pour productivité maximale et type-safety bout en bout.

---

## Backend

### Framework principal

**NestJS 10+** (Node.js + TypeScript)
- Architecture modulaire (controllers, services, repositories)
- Dependency injection native
- Excellente intégration TypeScript
- Écosystème mature (validation, auth, queue, cache)

**Justification** : Séparation of concerns naturelle, scalabilité modulaire, DX exceptionnelle.

### Base de données

**PostgreSQL 15+**
- SGBD relationnel robuste (ACID complet)
- Extension **PostGIS** pour géospatialisation (carte chantiers, coordonnées GPS)
- Support JSON/JSONB pour métadonnées flexibles
- Row-Level Security (RLS) pour isolation multi-tenant

**ORM : Prisma**
- Type-safety DB ↔ API
- Migrations versionnées
- Client TypeScript auto-généré
- Relations complexes simplifiées

**Justification** : PostGIS essentiel pour carte, Prisma meilleur DX TypeScript.

### Cache & Queue

**Redis 7+**
- Cache applicatif (recherches, intégrations externes)
- Sessions utilisateurs (JWT refresh tokens)
- Queue jobs asynchrones (BullMQ)
- Rate limiting

**BullMQ**
- Queue Redis-backed
- Jobs asynchrones (exports PDF, génération QR, sync intégrations)
- Retry automatique
- Dashboard monitoring

**Justification** : Redis ultra-performant pour cache/sessions, BullMQ robuste pour jobs longs.

### Stockage fichiers

**MinIO** (on-premise) ou **AWS S3** (cloud)
- API S3-compatible (portabilité)
- Buckets : `plans`, `photos`, `exports`, `qrcodes`
- URLs pré-signées (sécurité)
- Versioning fichiers

**Justification** : Compatibilité S3 garantit portabilité on-premise ↔ cloud.

### Permissions

**Casbin**
- Moteur RBAC/ABAC policy-based
- Policies persistées PostgreSQL (TypeORM adapter)
- Performance (cache policies en mémoire)
- Extensibilité ABAC (permissions contextuelles)

**Justification** : Séparation logique permissions, audit trail, évolutivité.

### Authentification

**Passport.js**
- Strategy `local` : Email/password (bcrypt)
- Strategy `oidc` : OpenID Connect (Microsoft Entra ID, Keycloak...)
- JWT tokens : Access token (15min) + Refresh token (7j)

**Provisioning** : Just-In-Time (création auto users OIDC)

**Justification** : Flexibilité auth locale (MVP) → SSO entreprise (production).

### Génération documents

**QR Codes** : `qrcode` (Node.js)
**PDF** : `Puppeteer` (rendu HTML → PDF)
- Templates brandés (logo délégation)
- Rapports chantiers, étiquettes QR, schémas baies

**Justification** : Puppeteer flexible pour templates HTML complexes.

---

## Frontend

### Framework

**Next.js 14+** (React + TypeScript)
- Server-Side Rendering (SSR) + Static Site Generation (SSG)
- Routing file-based
- API routes (Backend-For-Frontend si besoin)
- Image optimization native
- PWA support

**Justification** : Performance SEO, PWA natif, écosystème React mature.

### UI Library

**shadcn/ui** + **Tailwind CSS**
- Composants React modernes (Radix UI sous-jacent)
- Accessibilité (ARIA, keyboard navigation)
- Customisation complète (branding délégation)
- Dark mode natif
- Mobile-first

**Justification** : Composants production-ready, pas de vendor lock-in (code copié dans projet).

### State Management

**Zustand** : État global léger (user, tenant config)
**TanStack Query** : Server state (cache API, sync automatique, optimistic updates)

**Justification** : Simplicité vs Redux, TanStack Query gère sync serveur.

### Cartes interactives

**Leaflet**
- Open-source (pas de coût API vs Mapbox)
- Clustering avec **Supercluster**
- Markers personnalisés par santé chantier
- Popups, géolocalisation, recherche adresse

**Alternatives** : Mapbox GL JS (payant mais plus fluide), OpenLayers (lourd)

**Justification** : Leaflet équilibre fonctionnalités/simplicité/coût.

### Visualisation plans

**Konva.js** (React Konva)
- Canvas HTML5 interactif
- Zoom/pan fluides
- Drag & drop pins
- Export images (PNG, PDF via backend)

**Justification** : Performance canvas, interactions riches, React integration.

### Scan QR mobile

**html5-qrcode**
- Accès caméra native (getUserMedia API)
- Détection QR en temps réel
- Compatible PWA

**Justification** : Pas besoin app native, fonctionne dans navigateur.

### Validation formulaires

**React Hook Form** + **Zod**
- Validation déclarative (schema Zod)
- Performance (uncontrolled inputs)
- Type-safety formulaires

**Justification** : Zod cohérent avec Prisma schemas, RHF performant.

---

## DevOps & Infrastructure

### Containerisation

**Docker** + **Docker Compose**

Services :
- `app` : NestJS + Next.js (monolithe)
- `postgres` : PostgreSQL 15 + PostGIS
- `redis` : Redis 7
- `minio` : MinIO (stockage S3-compatible)
- `traefik` : Reverse proxy (HTTPS, Let's Encrypt)

**Justification** : Simplicité déploiement, portabilité, reproductibilité.

### CI/CD

**GitLab CI** (prioritaire)
- Self-hosted, air-gap compatible
- Runners on-premise
- Registry Docker interne

Stages :
1. `test` : Lint, tests unitaires, E2E, coverage
2. `build` : Build images Docker
3. `deploy` : Staging auto, production manual

**GitHub Actions** (optionnel)
- Compatibilité projets open-source
- Workflows identiques (.yml)

**Justification** : GitLab pour entreprise self-hosted, GitHub pour communauté.

### Monitoring & Logs

**Logs** : Structured logging (JSON)
- Winston (backend)
- Pino (alternative haute performance)

**Errors** : Sentry (monitoring erreurs production)
**Metrics** : Prometheus + Grafana (optionnel)

**Justification** : Sentry capture erreurs temps réel, logs structurés searchables.

### Sécurité

**HTTPS** : Let's Encrypt (Traefik auto-renewal)
**Secrets** : Variables environnement (Docker secrets, GitLab CI variables)
**Scan vulnérabilités** :
- Trivy (images Docker)
- Semgrep (SAST code)
- npm audit (dependencies)

**Justification** : Sécurité par défaut, automatisation scans.

---

## Architecture Multi-tenant

**Stratégie** : Row-Level Security (RLS) avec `tenant_id`

Toutes les entités principales :
```prisma
model Site {
  id        String @id
  tenantId  String  // Isolation
  tenant    Tenant @relation(fields: [tenantId], references: [id])
  // ...

  @@index([tenantId])
}
```

**PostgreSQL RLS** :
```sql
ALTER TABLE "Site" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Site"
  USING (tenant_id = current_setting('app.current_tenant_id')::text);
```

**Middleware NestJS** :
```typescript
await prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
```

**MVP** : Un seul tenant actif, architecture prête.

**Justification** : Compatible Prisma, backup simple, performance excellente.

---

## PWA (Progressive Web App)

**Configuration Next.js PWA** :
```json
{
  "manifest": {
    "name": "XCH",
    "short_name": "XCH",
    "theme_color": "#0070f3",
    "background_color": "#ffffff",
    "display": "standalone",
    "scope": "/",
    "start_url": "/"
  }
}
```

**Fonctionnalités** :
- ✅ Installation écran d'accueil
- ✅ Mode offline basique (cache pages consultées)
- ✅ Notifications push
- ✅ Accès caméra (scan QR, photos)
- ✅ Géolocalisation

**Service Worker** :
- Cache stratégies : Network-first (API), Cache-first (assets statiques)
- Offline fallback (page consultation dernières données)

**Justification** : Expérience mobile native sans app stores, mise à jour automatique.

---

## Tests

### Backend

**Framework** : Jest + Supertest
- Tests unitaires services/repositories
- Tests intégration (controllers + DB)
- Tests E2E (API complète)
- Coverage minimum : 80%

### Frontend

**Framework** : Vitest + React Testing Library
- Tests unitaires composants
- Tests intégration pages
- Mocks API (MSW)

**E2E** : Playwright
- Scénarios utilisateurs complets
- Tests cross-browser (Chrome, Firefox, Safari)
- Tests mobile (viewport responsive)

**Justification** : Jest standard Node.js, Playwright meilleur E2E moderne.

---

## Performance

**Cibles** :
- Temps chargement pages < 3s
- Actions utilisateur < 1s
- Recherche < 500ms
- Carte 100 chantiers < 2s

**Optimisations** :
- Cache Redis agressif
- Pagination (50 items/page)
- Lazy loading images
- Code splitting Next.js
- Indexes PostgreSQL (tenant_id, foreign keys, full-text search)
- CDN assets statiques (optionnel)

---

## Déploiement

### On-premise

**Requirements** :
- Docker 24+
- Docker Compose 2.20+
- 4 CPU, 8 GB RAM minimum
- 100 GB stockage

**Commandes** :
```bash
git clone https://gitlab.internal.company.com/xch/xch.git
cd xch
cp .env.example .env
# Éditer .env (DB passwords, JWT secret, etc.)
docker-compose up -d
# Accès : https://localhost
```

**Backup** :
```bash
docker-compose exec postgres pg_dump -U xch xch > backup_$(date +%Y%m%d).sql
docker-compose exec minio mc mirror /data /backup
```

### Cloud (optionnel)

**Providers** : AWS, Azure, GCP
- App : ECS, AKS, Cloud Run
- DB : RDS PostgreSQL, Azure Database, Cloud SQL
- Storage : S3, Azure Blob, GCS
- Cache : ElastiCache Redis, Azure Cache

**Justification** : Architecture Docker portable on-premise ↔ cloud.

---

## Scalabilité future

**Horizontal scaling** :
- Load balancer (Traefik, Nginx)
- Multiple instances app (Docker Swarm, Kubernetes)
- PostgreSQL read replicas
- Redis cluster (HA)

**Vertical scaling** :
- PostgreSQL : Connection pooling (PgBouncer)
- App : Worker threads, clustering Node.js

**Microservices (si nécessaire)** :
- Modules NestJS extractibles en services séparés
- Communication : REST, gRPC ou message queue (RabbitMQ)

---

## Résumé des choix

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Backend** | NestJS + TypeScript | Architecture modulaire, type-safety |
| **Frontend** | Next.js + React | SSR, PWA natif, performance |
| **Database** | PostgreSQL + PostGIS | Relationnel robuste + géospatial |
| **ORM** | Prisma | Type-safety DB, migrations |
| **Cache/Queue** | Redis + BullMQ | Performance, jobs async |
| **Storage** | MinIO / S3 | Portabilité on-premise ↔ cloud |
| **Auth** | Passport (local + OIDC) | Flexibilité MVP → SSO |
| **Permissions** | Casbin | RBAC/ABAC policy-based |
| **UI** | shadcn/ui + Tailwind | Composants modernes, customisation |
| **Cartes** | Leaflet | Open-source, clustering |
| **Plans** | Konva.js | Canvas interactif |
| **QR** | qrcode + html5-qrcode | Génération + scan web |
| **PDF** | Puppeteer | Templates HTML flexibles |
| **CI/CD** | GitLab CI (+ GitHub Actions) | Self-hosted, air-gap ready |
| **Deployment** | Docker Compose | Simplicité, portabilité |

---

## Prochaines étapes

1. ✅ Stack validée
2. ⏳ Schéma base de données détaillé (Prisma schema)
3. ⏳ Structure projet complète (monorepo, modules)
4. ⏳ Roadmap développement avec agents
5. ⏳ Développement MVP

---

**Dernière mise à jour** : 2025-12-31 par Architecte Lead
