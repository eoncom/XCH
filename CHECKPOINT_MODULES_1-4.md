# XCH - Checkpoint Modules 1-4

**Date** : 2025-12-31
**Phase** : Modules Core Backend implémentés

---

## ✅ MODULES TERMINÉS

### 1. Module AUTH (Complet)
- ✅ `auth.service.ts` - Login local, OIDC JIT, refresh tokens
- ✅ `auth.controller.ts` - Routes /login, /register, /refresh, /profile
- ✅ `local.strategy.ts` - Passport local (email/password)
- ✅ `jwt.strategy.ts` - Passport JWT
- ✅ `oidc.strategy.ts` - Passport OIDC (architecture prête)
- ✅ DTOs - LoginDto, RegisterDto, RefreshTokenDto
- ✅ Guards - JwtAuthGuard, LocalAuthGuard

### 2. Module RBAC (Casbin)
- ✅ `rbac.module.ts` - Casbin Enforcer avec TypeORM adapter
- ✅ `casbin/model.conf` - Modèle RBAC multi-tenant
- ✅ `casbin/policy.csv` - Policies 4 rôles (55 permissions)
- ✅ `casbin.guard.ts` - Guard vérification permissions
- ✅ `permissions.decorator.ts` - @Resource, @Action

### 3. Module USERS (CRUD)
- ✅ `users.service.ts` - CRUD users, gestion rôles
- ✅ `users.controller.ts` - Routes /users avec guards Casbin
- ✅ DTOs - CreateUserDto, UpdateUserDto
- ✅ Sécurité - Passwords bcrypt, isolation tenant

### 4. Module TENANTS (Config)
- ✅ `tenants.service.ts` - Config tenant, branding
- ✅ `tenants.controller.ts` - Routes /tenants/current
- ✅ DTOs - UpdateTenantDto
- ✅ Config - logoUrl, primaryColor, config JSON

### 5. Module SITES (CRUD + PostGIS)
- ✅ `sites.service.ts` - CRUD sites, queries PostGIS
- ✅ `sites.controller.ts` - Routes /sites avec recherche
- ✅ DTOs - CreateSiteDto, UpdateSiteDto, FilterSiteDto
- ✅ PostGIS - Coordonnées GPS, recherche proximité (nearby)
- ✅ Recherche - Full-text (nom, code, ville, adresse)
- ✅ Filtres - Status, healthStatus, search

### Support
- ✅ `prisma/seed.ts` - Seed tenant + 4 users
- ✅ `database.module.ts` - Prisma client global
- ✅ `app.module.ts` - Import tous modules

---

## 📁 STRUCTURE CRÉÉE

```
backend/src/
├── main.ts                         ✅
├── app.module.ts                   ✅ (modules importés)
├── config/
│   └── database.module.ts          ✅
├── modules/
│   ├── auth/                       ✅ Complet (10 fichiers)
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── strategies/
│   │   │   ├── local.strategy.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── oidc.strategy.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── refresh-token.dto.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       └── local-auth.guard.ts
│   ├── rbac/                       ✅ Complet
│   │   └── rbac.module.ts
│   ├── users/                      ✅ Complet (5 fichiers)
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   ├── tenants/                    ✅ Complet (4 fichiers)
│   │   ├── tenants.module.ts
│   │   ├── tenants.service.ts
│   │   ├── tenants.controller.ts
│   │   └── dto/
│   │       └── update-tenant.dto.ts
│   └── sites/                      ✅ Complet (7 fichiers)
│       ├── sites.module.ts
│       ├── sites.service.ts
│       ├── sites.controller.ts
│       └── dto/
│           ├── create-site.dto.ts
│           ├── update-site.dto.ts
│           └── filter-site.dto.ts
├── common/
│   ├── guards/
│   │   └── casbin.guard.ts         ✅
│   └── decorators/
│       └── permissions.decorator.ts ✅
└── casbin/
    ├── model.conf                  ✅
    └── policy.csv                  ✅

prisma/
├── schema.prisma                   ✅ (15 modèles)
└── seed.ts                         ✅
```

**Total fichiers créés** : ~40 fichiers

---

## 🚀 INSTALLATION & DÉMARRAGE

### Étape 1 : Installation dépendances

```bash
cd backend
npm install
```

### Étape 2 : Démarrer infrastructure

```bash
# Depuis racine projet
docker-compose up -d

# Vérifier services
docker-compose ps
# Doit montrer : postgres, redis, minio (running)
```

### Étape 3 : Initialiser DB

```bash
cd backend

# Générer client Prisma
npm run prisma:generate

# Créer migration initiale
npm run prisma:migrate -- --name init

# Seed (tenant + 4 users)
npm run prisma:seed
```

**Output attendu seed** :
```
✅ Tenant created: Délégation Île-de-France (cuid...)
✅ Admin user created: admin@xch.local
✅ User created: manager@xch.local (MANAGER)
✅ User created: tech@xch.local (TECHNICIEN)
✅ User created: viewer@xch.local (VIEWER)
🎉 Seeding completed!
```

### Étape 4 : Démarrer backend

```bash
npm run start:dev
```

**Output attendu** :
```
✅ Database connected
✅ Casbin RBAC initialized
[Nest] Application successfully started
```

**URLs** :
- API : `http://localhost:3001/api`
- Swagger : `http://localhost:3001/api/docs`

---

## 🧪 TESTS CURL

### 1. Login (obtenir token)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xch.local","password":"admin"}'
```

**Réponse attendue** :
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx...",
    "email": "admin@xch.local",
    "name": "Administrateur",
    "role": "ADMIN",
    "tenantId": "clx...",
    "tenant": {
      "id": "clx...",
      "name": "Délégation Île-de-France"
    }
  }
}
```

**Copier le `accessToken` pour les requêtes suivantes** → `TOKEN=eyJ...`

### 2. Get Profile

```bash
curl -X GET http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Create Site

```bash
curl -X POST http://localhost:3001/api/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SITE001",
    "name": "Chantier Test Paris",
    "address": "10 Rue de Rivoli",
    "city": "Paris",
    "postalCode": "75001",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "status": "ACTIVE",
    "healthStatus": "OK"
  }'
```

### 4. List Sites

```bash
curl -X GET http://localhost:3001/api/sites \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Search Sites

```bash
curl -X GET "http://localhost:3001/api/sites?search=Paris" \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Find Nearby Sites (PostGIS)

```bash
# Sites dans 10km autour de Paris
curl -X GET "http://localhost:3001/api/sites/nearby?latitude=48.8566&longitude=2.3522&radius=10" \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Get Users

```bash
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN"
```

### 8. Get Tenant Config

```bash
curl -X GET http://localhost:3001/api/tenants/current/config \
  -H "Authorization: Bearer $TOKEN"
```

### 9. Test RBAC (en tant que VIEWER)

```bash
# Login as viewer
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@xch.local","password":"admin"}'

# Copier token viewer → VIEWER_TOKEN=...

# Essayer créer site (doit échouer - 403 Forbidden)
curl -X POST http://localhost:3001/api/sites \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"TEST","name":"Test","address":"Test","city":"Test"}'

# Lire sites (doit fonctionner - 200 OK)
curl -X GET http://localhost:3001/api/sites \
  -H "Authorization: Bearer $VIEWER_TOKEN"
```

---

## ✅ RÉSULTATS ATTENDUS

### Fonctionnel
- ✅ Login local (email/password) → JWT tokens
- ✅ Refresh token → Nouveau access token
- ✅ RBAC Casbin : ADMIN full access, VIEWER read-only
- ✅ CRUD Users (create, read, update, delete)
- ✅ Config Tenant (read, update branding)
- ✅ CRUD Sites avec PostGIS (coordinates, nearby search)
- ✅ Recherche sites full-text
- ✅ Filtres sites (status, healthStatus, search)

### Sécurité
- ✅ JWT Guard sur toutes routes (sauf login/register)
- ✅ Casbin Guard vérifie permissions (roles vs resources)
- ✅ Isolation tenant (tenantId dans queries)
- ✅ Passwords bcrypt
- ✅ Validation DTOs (class-validator)

---

## 📋 PROCHAINS MODULES À DÉVELOPPER

### Module 5 : Assets (CRUD + QR codes)
- `assets.service.ts` - CRUD assets, génération QR
- `assets.controller.ts` - Routes + upload photos
- DTOs - CreateAssetDto, UpdateAssetDto, FilterAssetDto
- Service QR codes (qrcode library)
- Service MinIO (upload photos)

### Module 6 : Racks (CRUD + montage équipements)
- `racks.service.ts` - CRUD baies, montage équipements
- `racks.controller.ts` - Routes + vérification positions U
- DTOs - CreateRackDto, MountEquipmentDto
- Logique montage : vérif chevauchements, calcul occupation

### Module 7 : Tasks (CRUD + checklist)
- `tasks.service.ts` - CRUD tâches, checklist
- `tasks.controller.ts` - Routes + filtres
- DTOs - CreateTaskDto, UpdateTaskDto, FilterTaskDto

### Modules restants
- FloorPlans (upload + pins)
- Integrations (NetBox READ-ONLY, Uptime Kuma)

---

## 🐛 TROUBLESHOOTING

### Erreur : "Cannot find module '@prisma/client'"
```bash
cd backend
npm run prisma:generate
```

### Erreur : "Database connection failed"
```bash
# Vérifier Docker
docker-compose ps
docker-compose logs postgres

# Vérifier .env DATABASE_URL
cat ../.env | grep DATABASE_URL
```

### Erreur : "JWT secret not configured"
```bash
# Vérifier .env JWT_SECRET
echo "JWT_SECRET=your_secret_key_change_in_production" >> ../.env
```

### Casbin errors
```bash
# Vérifier fichiers casbin
ls backend/casbin/
# Doit contenir : model.conf, policy.csv
```

---

## 📊 MÉTRIQUES

**Lignes de code** : ~1500 lignes (estimé)
**Fichiers créés** : 40+
**Endpoints API** : 20+
**Temps développement** : ~2h (automatisé)

---

## ✨ PROCHAINE ÉTAPE

**Option 1** : Teste les modules actuels avec curl

**Option 2** : Continue développement modules 5-7 (Assets, Racks, Tasks)

**Quelle option ?**
