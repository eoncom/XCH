# CHECKPOINT : Modules 6-8 (Assets, Racks, Tasks)

**Date :** 2025-12-31
**Phase :** Développement Backend - Phase 2
**Modules livrés :** Assets, Racks, Tasks

---

## 📦 LIVRABLES

### Module 6 : Assets (Inventaire équipements)

**8 fichiers créés :**

```
backend/src/modules/assets/
├── assets.module.ts              # Module NestJS
├── assets.controller.ts          # API REST (CRUD + QR codes)
├── assets.service.ts             # Logique métier + validation
├── dto/
│   ├── create-asset.dto.ts       # DTO création
│   ├── update-asset.dto.ts       # DTO mise à jour
│   └── filter-asset.dto.ts       # DTO filtrage avancé

backend/src/common/services/
├── qrcode.service.ts             # Service génération QR codes (global)
```

**Fonctionnalités :**
- ✅ CRUD complet assets (11 types : PRINTER, IPAD, SWITCH, FIREWALL, etc.)
- ✅ Validation obligatoire numéro de série pour types critiques (PRINTER, IPAD, TABLET, SWITCH, FIREWALL, TEAMS_ROOM)
- ✅ Génération QR codes sécurisés (token unique non-devinable)
- ✅ Filtrage avancé : recherche, type, statut, site, rack, sans S/N, sans localisation
- ✅ Bulk operations : génération QR multiples, export inventaire
- ✅ Relation avec Sites et Racks (montage équipement)

**QR Code System :**
- Format URL : `https://xch.app/assets/{assetId}/verify?token={secureToken}`
- Token : 3 parties aléatoires + timestamp (non-guessable)
- Stockage : `qrCodeToken` + `qrCodeUrl` dans table Asset
- Utilisation : Scan QR → Vérification auth → Affichage détails asset

---

### Module 7 : Racks (Baies 4U-42U)

**6 fichiers créés :**

```
backend/src/modules/racks/
├── racks.module.ts               # Module NestJS
├── racks.controller.ts           # API REST (CRUD + montage)
├── racks.service.ts              # Logique métier + détection overlap
├── dto/
│   ├── create-rack.dto.ts        # DTO création
│   ├── update-rack.dto.ts        # DTO mise à jour
│   └── mount-equipment.dto.ts    # DTO montage équipement
```

**Fonctionnalités :**
- ✅ CRUD complet baies (4U à 42U)
- ✅ Montage équipements avec validation stricte :
  - Vérification position dans limites baie (1 ≤ positionU ≤ heightU)
  - **Détection overlap complexe** (chevauchement avec équipements existants)
  - Calcul fin de position (positionU + heightU - 1)
- ✅ Démontage équipement (libération espace)
- ✅ Recherche espaces disponibles (continuous spaces ≥ hauteur requise)
- ✅ Visualisation occupation baie (liste équipements + positions)
- ✅ Relation bidirectionnelle avec Assets

**Algorithme Overlap Detection :**
```typescript
// Pour chaque équipement existant, vérifie si nouvel équipement chevauche
const overlaps = rack.assets.filter(existingAsset => {
  const existingStart = existingAsset.rackPositionU;
  const existingEnd = existingStart + existingAsset.rackHeightU - 1;
  const newStart = mountDto.positionU;
  const newEnd = newStart + mountDto.heightU - 1;

  return (
    (newStart >= existingStart && newStart <= existingEnd) ||  // Début dans existant
    (newEnd >= existingStart && newEnd <= existingEnd) ||      // Fin dans existant
    (newStart <= existingStart && newEnd >= existingEnd)       // Englobe existant
  );
});
```

---

### Module 8 : Tasks (Tâches + Checklist)

**7 fichiers créés :**

```
backend/src/modules/tasks/
├── tasks.module.ts               # Module NestJS
├── tasks.controller.ts           # API REST (CRUD + filtres)
├── tasks.service.ts              # Logique métier + checklist
├── dto/
│   ├── create-task.dto.ts        # DTO création
│   ├── update-task.dto.ts        # DTO mise à jour
│   ├── filter-task.dto.ts        # DTO filtrage avancé
│   └── update-checklist.dto.ts   # DTO gestion checklist
```

**Fonctionnalités :**
- ✅ CRUD complet tâches (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
- ✅ Priorités (LOW, MEDIUM, HIGH, URGENT)
- ✅ **Gestion checklist dynamique** (JSON flexible) :
  - Items : `{ id, text, checked, order }`
  - Calcul auto completion : `{ total, completed, percent }`
- ✅ Filtrage avancé : statut, priorité, site, asset, assigné, non-assigné, en retard
- ✅ Auto-complétion : `completedAt` automatique si statut = DONE
- ✅ Endpoints stats : `/my-tasks`, `/overdue`, `/stats/by-status`
- ✅ Relations : Site, Asset, User (créateur + assigné)

**Checklist System :**
```typescript
// Exemple checklist
{
  "checklist": [
    { "id": "1", "text": "Verify network connectivity", "checked": true, "order": 1 },
    { "id": "2", "text": "Test equipment", "checked": false, "order": 2 },
    { "id": "3", "text": "Update documentation", "checked": false, "order": 3 }
  ]
}

// Retour API avec completion
{
  ...taskData,
  "checklistCompletion": {
    "total": 3,
    "completed": 1,
    "percent": 33
  }
}
```

---

## 🗂️ STRUCTURE COMPLÈTE BACKEND (après Phase 2)

```
backend/
├── prisma/
│   ├── schema.prisma             # 15 modèles (Tenant, User, Site, Asset, Rack, Task...)
│   └── seed.ts                   # Seed tenant IDF + 4 users
├── casbin/
│   ├── model.conf                # Modèle RBAC Casbin
│   └── policy.csv                # 55 policies (4 rôles)
├── src/
│   ├── main.ts                   # Bootstrap NestJS
│   ├── app.module.ts             # Root module (8 modules importés)
│   ├── config/
│   │   └── database.module.ts    # Prisma client global
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts       # Auth guard
│   │   │   └── casbin.guard.ts         # RBAC guard
│   │   ├── decorators/
│   │   │   └── permissions.decorator.ts # @Resource/@Action
│   │   └── services/
│   │       └── qrcode.service.ts       # QR code generation
│   └── modules/
│       ├── auth/                 # Module 1 (10 fichiers)
│       ├── rbac/                 # Module 2 (4 fichiers)
│       ├── users/                # Module 3 (5 fichiers)
│       ├── tenants/              # Module 4 (4 fichiers)
│       ├── sites/                # Module 5 (7 fichiers)
│       ├── assets/               # Module 6 (8 fichiers) ✨ NOUVEAU
│       ├── racks/                # Module 7 (6 fichiers) ✨ NOUVEAU
│       └── tasks/                # Module 8 (7 fichiers) ✨ NOUVEAU
├── .env.example                  # Variables environnement
├── docker-compose.yml            # PostgreSQL + Redis + MinIO
└── package.json                  # Dependencies NestJS

TOTAL : ~70 fichiers créés
```

---

## 🧪 TESTS RAPIDES

### Prérequis

```bash
# 1. Démarrer services Docker
cd backend
docker-compose up -d

# 2. Installer dépendances
npm install

# 3. Migration + seed base
npx prisma migrate dev
npx prisma db seed

# 4. Démarrer serveur
npm run start:dev
```

**Serveur :** http://localhost:3000
**Swagger :** http://localhost:3000/api

---

### 1. Authentification (obtenir token)

```bash
# Login admin
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@xch.local",
    "password": "admin"
  }'

# Réponse
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { "id": "...", "email": "admin@xch.local", "role": "ADMIN" }
}
```

**💡 Copier `accessToken` pour les requêtes suivantes** → Remplacer `YOUR_TOKEN` par ce token.

---

### 2. Module Assets (Inventaire)

#### Créer un asset (imprimante)

```bash
curl -X POST http://localhost:3000/assets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PRINTER",
    "brand": "HP",
    "model": "LaserJet Pro M404n",
    "serialNumber": "CNBCD12345",
    "status": "IN_STOCK"
  }'
```

**⚠️ Note :** `serialNumber` est **obligatoire** pour types : PRINTER, IPAD, TABLET, SWITCH, FIREWALL, TEAMS_ROOM.

#### Créer un switch (sans S/N → erreur attendue)

```bash
curl -X POST http://localhost:3000/assets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SWITCH",
    "brand": "Cisco",
    "model": "Catalyst 2960"
  }'

# Erreur attendue : 400 Bad Request
# "Serial number is required for asset type: SWITCH"
```

#### Lister assets avec filtres

```bash
# Tous les assets
curl http://localhost:3000/assets \
  -H "Authorization: Bearer YOUR_TOKEN"

# Assets de type PRINTER
curl "http://localhost:3000/assets?type=PRINTER" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Assets sans numéro de série
curl "http://localhost:3000/assets?withoutSerialNumber=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Recherche par texte (brand, model, serialNumber)
curl "http://localhost:3000/assets?search=cisco" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Générer QR code pour un asset

```bash
# Remplacer {assetId} par l'ID de l'asset créé
curl -X POST http://localhost:3000/assets/{assetId}/qr-code \
  -H "Authorization: Bearer YOUR_TOKEN"

# Réponse
{
  "assetId": "clxxxxx",
  "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
  "qrUrl": "https://xch.app/assets/clxxxxx/verify?token=abc123xyz789...",
  "token": "abc123xyz789def456timestamp"
}
```

**💡 Usage :**
- `qrCodeDataUrl` : Image PNG en base64 (afficher dans `<img src="...">`)
- `qrUrl` : URL à scanner avec app mobile
- Scanner → Auth requise → Affiche détails asset

---

### 3. Module Racks (Baies)

#### Créer une baie 42U

```bash
curl -X POST http://localhost:3000/racks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RACK-A1",
    "heightU": 42,
    "location": "Salle serveur A",
    "status": "ACTIVE"
  }'

# Réponse → copier "id" pour tests montage
```

#### Créer un switch à monter

```bash
curl -X POST http://localhost:3000/assets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SWITCH",
    "brand": "Cisco",
    "model": "Catalyst 2960-X",
    "serialNumber": "FOC1234567A",
    "heightU": 1
  }'

# Réponse → copier "id" pour montage
```

#### Monter le switch dans la baie (position U10)

```bash
# Remplacer {rackId} et assetId par les IDs copiés
curl -X POST http://localhost:3000/racks/{rackId}/mount \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "{assetId}",
    "positionU": 10,
    "heightU": 1
  }'
```

#### Tenter montage overlap (erreur attendue)

```bash
# Créer un 2e switch
curl -X POST http://localhost:3000/assets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SWITCH",
    "brand": "Cisco",
    "model": "Catalyst 3750",
    "serialNumber": "FOC9876543B",
    "heightU": 2
  }'

# Tenter montage position U10 (overlap avec switch existant)
curl -X POST http://localhost:3000/racks/{rackId}/mount \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "{newAssetId}",
    "positionU": 10,
    "heightU": 2
  }'

# Erreur attendue : 400 Bad Request
# "Position overlaps with existing equipment: Catalyst 2960-X"
```

#### Trouver espaces disponibles

```bash
# Chercher espace pour équipement 4U
curl "http://localhost:3000/racks/{rackId}/available-spaces?requiredHeightU=4" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Réponse : liste des positions disponibles continues
[
  { "startPositionU": 1, "endPositionU": 9, "heightU": 9 },
  { "startPositionU": 11, "endPositionU": 42, "heightU": 32 }
]
```

#### Visualiser occupation baie

```bash
curl http://localhost:3000/racks/{rackId} \
  -H "Authorization: Bearer YOUR_TOKEN"

# Réponse détaillée
{
  "id": "clxxx",
  "name": "RACK-A1",
  "heightU": 42,
  "assets": [
    {
      "id": "clyyy",
      "model": "Catalyst 2960-X",
      "rackPositionU": 10,
      "rackHeightU": 1,
      "serialNumber": "FOC1234567A"
    }
  ],
  "availableU": 41,
  "occupiedU": 1
}
```

#### Démonter équipement

```bash
curl -X DELETE http://localhost:3000/racks/{rackId}/unmount/{assetId} \
  -H "Authorization: Bearer YOUR_TOKEN"

# Asset est démontée (rackId, rackPositionU, rackHeightU → null)
```

---

### 4. Module Tasks (Tâches + Checklist)

#### Créer une tâche simple

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Installer switch chantier Boulogne",
    "description": "Monter et configurer Catalyst 2960-X en position U10",
    "status": "TODO",
    "priority": "HIGH",
    "dueDate": "2025-02-15T10:00:00Z"
  }'
```

#### Créer une tâche avec checklist

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Installation iPad Teams Room",
    "description": "Setup iPad Pro pour salle de réunion",
    "status": "TODO",
    "priority": "MEDIUM",
    "checklist": [
      { "id": "1", "text": "Vérifier numéro de série iPad", "checked": false, "order": 1 },
      { "id": "2", "text": "Installer support mural", "checked": false, "order": 2 },
      { "id": "3", "text": "Configurer compte Teams", "checked": false, "order": 3 },
      { "id": "4", "text": "Tester appel vidéo", "checked": false, "order": 4 }
    ]
  }'

# Réponse → copier "id" pour mise à jour checklist
```

#### Lire tâche avec completion checklist

```bash
curl http://localhost:3000/tasks/{taskId} \
  -H "Authorization: Bearer YOUR_TOKEN"

# Réponse
{
  "id": "clzzz",
  "title": "Installation iPad Teams Room",
  "checklist": [ ... ],
  "checklistCompletion": {
    "total": 4,
    "completed": 0,
    "percent": 0
  }
}
```

#### Mettre à jour checklist (cocher items)

```bash
curl -X PATCH http://localhost:3000/tasks/{taskId}/checklist \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checklist": [
      { "id": "1", "text": "Vérifier numéro de série iPad", "checked": true, "order": 1 },
      { "id": "2", "text": "Installer support mural", "checked": true, "order": 2 },
      { "id": "3", "text": "Configurer compte Teams", "checked": false, "order": 3 },
      { "id": "4", "text": "Tester appel vidéo", "checked": false, "order": 4 }
    ]
  }'

# Re-lire tâche → checklistCompletion.percent = 50
```

#### Filtrer tâches

```bash
# Tâches assignées à moi
curl http://localhost:3000/tasks/my-tasks \
  -H "Authorization: Bearer YOUR_TOKEN"

# Tâches en retard
curl http://localhost:3000/tasks/overdue \
  -H "Authorization: Bearer YOUR_TOKEN"

# Tâches statut TODO priorité HIGH
curl "http://localhost:3000/tasks?status=TODO&priority=HIGH" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Tâches non-assignées
curl "http://localhost:3000/tasks?unassigned=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Compléter tâche (auto-set completedAt)

```bash
curl -X PATCH http://localhost:3000/tasks/{taskId} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE"
  }'

# Réponse : completedAt est auto-rempli avec date actuelle
{
  "id": "clzzz",
  "status": "DONE",
  "completedAt": "2025-12-31T14:23:00.000Z"
}
```

#### Stats tâches par statut

```bash
curl http://localhost:3000/tasks/stats/by-status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Réponse
{
  "TODO": 5,
  "IN_PROGRESS": 2,
  "DONE": 12,
  "BLOCKED": 1,
  "CANCELLED": 0
}
```

---

## 🎯 FONCTIONNALITÉS CLÉS VALIDÉES

### Assets
- ✅ Validation numéro de série (types critiques)
- ✅ QR codes sécurisés (token unique + URL verification)
- ✅ Filtrage multi-critères (type, site, rack, avec/sans S/N)
- ✅ Bulk operations (génération QR, export)

### Racks
- ✅ Montage équipements avec détection overlap
- ✅ Validation positions (1 ≤ U ≤ heightU)
- ✅ Calcul espaces disponibles continus
- ✅ Démontage équipement (libération espace)

### Tasks
- ✅ Checklist flexible (JSON dynamique)
- ✅ Calcul auto completion (total, completed, percent)
- ✅ Auto-complétion (completedAt si status=DONE)
- ✅ Filtres avancés (overdue, unassigned, priority)
- ✅ Stats agrégées par statut

---

## 🔒 SÉCURITÉ & PERMISSIONS

**Guards appliqués sur tous endpoints :**
- `@UseGuards(JwtAuthGuard, CasbinGuard)` → Auth + RBAC

**Permissions Casbin (exemples) :**

| Rôle       | Assets (create) | Racks (mount) | Tasks (delete) |
|------------|----------------|---------------|----------------|
| ADMIN      | ✅              | ✅             | ✅              |
| MANAGER    | ✅              | ✅             | ✅              |
| TECHNICIEN | ✅              | ✅             | ❌              |
| VIEWER     | ❌              | ❌             | ❌              |

**Isolation multi-tenant :**
- Tous les endpoints filtrent par `tenantId` (extrait du JWT)
- Impossible d'accéder aux données d'un autre tenant

---

## 🐛 TROUBLESHOOTING

### Erreur : "Serial number is required for asset type: SWITCH"

**Cause :** Création asset type critique (PRINTER, IPAD, SWITCH, FIREWALL, TEAMS_ROOM, TABLET) sans `serialNumber`.

**Solution :** Ajouter `serialNumber` dans le body JSON.

```bash
curl -X POST http://localhost:3000/assets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SWITCH",
    "brand": "Cisco",
    "model": "Catalyst 2960",
    "serialNumber": "FOC1234567A"  ← REQUIS
  }'
```

---

### Erreur : "Position overlaps with existing equipment: [model]"

**Cause :** Tentative montage équipement sur position déjà occupée (chevauchement).

**Solution :**
1. Lire baie pour voir équipements montés :
```bash
curl http://localhost:3000/racks/{rackId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. Utiliser endpoint espaces disponibles :
```bash
curl "http://localhost:3000/racks/{rackId}/available-spaces?requiredHeightU=2" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. Monter sur position libre retournée.

---

### Erreur : "Position U must be between 1 and {heightU}"

**Cause :** Position montage hors limites baie (< 1 ou > heightU).

**Solution :** Vérifier `heightU` de la baie et utiliser position valide (1-based).

Exemple baie 42U :
- ✅ Valide : `positionU: 1` à `positionU: 42`
- ❌ Invalide : `positionU: 0`, `positionU: 43`

---

### Checklist completion n'apparaît pas

**Cause :** Lecture tâche avec endpoint liste (`GET /tasks`) au lieu de détail (`GET /tasks/:id`).

**Solution :** Utiliser endpoint détail pour calcul auto :

```bash
# ❌ Liste (pas de completion)
curl http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ Détail (avec completion)
curl http://localhost:3000/tasks/{taskId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### QR code data URL trop long pour affichage

**Cause :** QR code en base64 (format `data:image/png;base64,...`) peut être long (plusieurs Ko).

**Solution :**
- **Frontend :** Utiliser directement dans `<img src={qrCodeDataUrl} />`
- **Mobile :** Décoder base64 et afficher image
- **Alternative :** Stocker QR code dans MinIO et retourner URL S3

---

## 📊 RÉSUMÉ TECHNIQUE

| Aspect            | Détails                                                                 |
|-------------------|-------------------------------------------------------------------------|
| **Modules**       | 8/10 backend (Auth, RBAC, Users, Tenants, Sites, Assets, Racks, Tasks) |
| **Fichiers**      | ~70 fichiers TypeScript                                                 |
| **Modèles DB**    | 15 modèles Prisma                                                       |
| **Endpoints API** | ~80 endpoints RESTful                                                   |
| **Permissions**   | 55 policies Casbin (4 rôles)                                            |
| **Tests**         | Tests manuels curl (tests auto à venir)                                 |
| **Documentation** | Swagger disponible sur `/api`                                           |

---

## 🚀 PROCHAINES ÉTAPES

### Modules restants (Phase 3)

**Module 9 : FloorPlans (Plans de sol interactifs)**
- Upload plans (PNG, PDF) → MinIO
- Pins éditables (ASSET, POI, ISSUE, NETWORK)
- Gestion layers (annotations, zones)
- API coordonnées relatives (x%, y%)

**Module 10 : Integrations (NetBox + Monitoring)**
- NetBox sync READ-ONLY (sites, équipements)
- Uptime Kuma monitoring (statut temps-réel)
- Mapping data externe → modèle XCH
- Webhooks pour mises à jour

### Frontend (Phase 4)

- Setup Next.js 14 + shadcn/ui
- Pages auth (login, OIDC callback)
- Dashboard + navigation
- Carte Leaflet (sites + clustering)
- Éditeur plans (Konva.js + pins)
- Scanner QR (PWA camera)
- Formulaires CRUD (sites, assets, racks, tasks)

### Tests & Déploiement (Phase 5)

- Tests E2E Playwright
- Tests unitaires (Jest)
- Optimisations performance
- Guide déploiement production
- CI/CD GitLab

---

## 📝 NOTES IMPORTANTES

### QR Code Security

Les QR codes générés contiennent un token unique non-devinable :
- ❌ NE PAS utiliser ID asset seul dans URL (`/assets/{id}` → guessable)
- ✅ TOUJOURS inclure token (`/assets/{id}/verify?token={secureToken}`)
- Vérification backend : matching `assetId` + `qrCodeToken` avant affichage

### Rack Mounting Best Practices

1. **Numérotation U** : 1-based (U1 = bas baie, U42 = haut baie 42U)
2. **Convention hauteur** : `heightU` = nombre d'unités U occupées (1U, 2U, 4U, etc.)
3. **Calcul fin** : `endPositionU = positionU + heightU - 1`
4. **Toujours vérifier** :
   - `positionU + heightU - 1 ≤ rack.heightU` (ne dépasse pas baie)
   - Pas d'overlap avec équipements existants
   - Utiliser API `available-spaces` pour garantir montage valide

### Task Checklist Flexibility

Checklist est **volontairement flexible** (JSON, pas table relationnelle) :
- **Avantage** : Facilité ajout/suppression items, pas de migrations
- **Inconvénient** : Pas de contraintes DB strictes
- **Usage** : Validation côté service (`@IsArray()`, vérification structure)

---

**✅ Modules 6-8 livrés et testés**
**📅 Prochaine étape :** Modules 9-10 (FloorPlans + Integrations)

---

**Questions ? Consultez :**
- Swagger : http://localhost:3000/api
- Schéma Prisma : `backend/prisma/schema.prisma`
- Policies Casbin : `backend/casbin/policy.csv`
