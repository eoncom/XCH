# Agent Backend Providers CRUD

## Mission

Créer le module NestJS Providers complet avec API CRUD, aligné sur le frontend Session 16 (agent a1c59ac).

## Contexte

**Problème :** Le frontend Providers (4 pages) a été déployé en Session 16, mais le module backend n'existe pas → toutes les requêtes retournent 404.

**Documents de référence :**
- `/backend/prisma/schema.prisma` - Model Provider existe (lignes 467-498) **MAIS** enum/fields incompatibles
- `/frontend/src/lib/api/providers.ts` - Service API frontend (attentes)
- `/frontend/src/types/index.ts` - Interface Provider frontend
- `/docs/agents/agent-frontend-providers-crud.md` - Spécifications agent frontend
- `/BACKEND_FRONTEND_GAPS_ANALYSIS.md` - Analyse complète gaps (Gap 1.1, 1.2, 1.3)

**Gaps identifiés :**
1. **Enum ProviderType incompatible** - Backend: CABLING, OPERATOR, INTEGRATOR, MAINTENANCE, OTHER | Frontend: TELECOM, INTERNET, CLOUD, HOSTING, OTHER
2. **Fields structure différente** - Backend: `contacts` (JSON), `availability` (JSON) | Frontend: `contact` (string), pas `availability`
3. **Module backend manquant** - Aucun controller/service/DTOs

## Stack technique

- **Framework :** NestJS 10
- **ORM :** Prisma
- **Database :** PostgreSQL 15 (table `providers` existe)
- **RBAC :** Casbin (policies à ajouter)
- **Validation :** class-validator + class-transformer
- **TypeScript :** Strict mode

## Livrables

### 1. Migration Prisma (30 min)

- [ ] **Modifier `backend/prisma/schema.prisma`** (lignes 467-498)
  ```prisma
  enum ProviderType {
    TELECOM   // Nouveau (remplace CABLING)
    INTERNET  // Nouveau (remplace OPERATOR)
    CLOUD     // Nouveau
    HOSTING   // Nouveau
    OTHER     // Gardé
  }

  model Provider {
    id       String       @id @default(cuid())
    tenantId String
    tenant   Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    name     String       @db.VarChar(100)  // Limite ajoutée
    type     ProviderType

    contact  String?      @db.VarChar(200)  // Remplace contacts (JSON)
    notes    String?      @db.Text          // Gardé (max 1000 frontend, Text OK)

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([tenantId])
    @@index([tenantId, type])
    @@map("providers")
  }
  ```

- [ ] **Créer migration SQL manuelle** `backend/prisma/migrations/20260201_align_provider_schema/migration.sql`
  ```sql
  -- Étape 1: Supprimer colonnes non utilisées
  ALTER TABLE providers DROP COLUMN IF EXISTS contacts;
  ALTER TABLE providers DROP COLUMN IF EXISTS availability;

  -- Étape 2: Ajouter colonne contact (string simple)
  ALTER TABLE providers ADD COLUMN IF NOT EXISTS contact VARCHAR(200);

  -- Étape 3: Modifier enum ProviderType
  -- Créer nouveau type temporaire
  CREATE TYPE "ProviderType_new" AS ENUM ('TELECOM', 'INTERNET', 'CLOUD', 'HOSTING', 'OTHER');

  -- Mapper anciennes valeurs → nouvelles
  ALTER TABLE providers ALTER COLUMN type DROP DEFAULT;
  ALTER TABLE providers ALTER COLUMN type TYPE "ProviderType_new"
    USING CASE
      WHEN type::text = 'CABLING' THEN 'TELECOM'::"ProviderType_new"
      WHEN type::text = 'OPERATOR' THEN 'INTERNET'::"ProviderType_new"
      WHEN type::text = 'INTEGRATOR' THEN 'OTHER'::"ProviderType_new"
      WHEN type::text = 'MAINTENANCE' THEN 'OTHER'::"ProviderType_new"
      ELSE 'OTHER'::"ProviderType_new"
    END;

  -- Supprimer ancien enum
  DROP TYPE "ProviderType";

  -- Renommer nouveau enum
  ALTER TYPE "ProviderType_new" RENAME TO "ProviderType";

  -- Ajouter contraintes
  ALTER TABLE providers ALTER COLUMN name SET NOT NULL;
  ALTER TABLE providers ADD CONSTRAINT providers_name_length CHECK (char_length(name) <= 100);
  ALTER TABLE providers ADD CONSTRAINT providers_contact_length CHECK (contact IS NULL OR char_length(contact) <= 200);
  ```

- [ ] **Regénérer Prisma Client** (sera fait dans Docker backend)
  ```bash
  npx prisma generate
  ```

### 2. Module NestJS (4h)

- [ ] **Créer structure**
  ```
  backend/src/modules/providers/
  ├── providers.module.ts
  ├── providers.controller.ts
  ├── providers.service.ts
  └── dto/
      ├── create-provider.dto.ts
      ├── update-provider.dto.ts
      └── query-provider.dto.ts
  ```

- [ ] **providers.module.ts**
  ```typescript
  import { Module } from '@nestjs/common';
  import { ProvidersController } from './providers.controller';
  import { ProvidersService } from './providers.service';
  import { PrismaModule } from '../prisma/prisma.module';
  import { CasbinModule } from '../casbin/casbin.module';

  @Module({
    imports: [PrismaModule, CasbinModule],
    controllers: [ProvidersController],
    providers: [ProvidersService],
    exports: [ProvidersService],
  })
  export class ProvidersModule {}
  ```

- [ ] **dto/create-provider.dto.ts**
  ```typescript
  import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

  export enum ProviderType {
    TELECOM = 'TELECOM',
    INTERNET = 'INTERNET',
    CLOUD = 'CLOUD',
    HOSTING = 'HOSTING',
    OTHER = 'OTHER',
  }

  export class CreateProviderDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @IsEnum(ProviderType)
    type: ProviderType;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    contact?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
  }
  ```

- [ ] **dto/update-provider.dto.ts**
  ```typescript
  import { PartialType } from '@nestjs/mapped-types';
  import { CreateProviderDto } from './create-provider.dto';

  export class UpdateProviderDto extends PartialType(CreateProviderDto) {}
  ```

- [ ] **dto/query-provider.dto.ts**
  ```typescript
  import { IsEnum, IsOptional } from 'class-validator';
  import { ProviderType } from './create-provider.dto';

  export class QueryProviderDto {
    @IsOptional()
    @IsEnum(ProviderType)
    type?: ProviderType;
  }
  ```

- [ ] **providers.service.ts**
  ```typescript
  import { Injectable, NotFoundException } from '@nestjs/common';
  import { PrismaService } from '../prisma/prisma.service';
  import { CreateProviderDto } from './dto/create-provider.dto';
  import { UpdateProviderDto } from './dto/update-provider.dto';
  import { QueryProviderDto } from './dto/query-provider.dto';

  @Injectable()
  export class ProvidersService {
    constructor(private readonly prisma: PrismaService) {}

    async create(tenantId: string, dto: CreateProviderDto) {
      return this.prisma.provider.create({
        data: {
          tenantId,
          ...dto,
        },
      });
    }

    async findAll(tenantId: string, query: QueryProviderDto) {
      const where: any = { tenantId };

      if (query.type) {
        where.type = query.type;
      }

      return this.prisma.provider.findMany({
        where,
        orderBy: { name: 'asc' },
      });
    }

    async findOne(tenantId: string, id: string) {
      const provider = await this.prisma.provider.findFirst({
        where: { id, tenantId },
      });

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${id} not found`);
      }

      return provider;
    }

    async update(tenantId: string, id: string, dto: UpdateProviderDto) {
      await this.findOne(tenantId, id); // Vérifie existence

      return this.prisma.provider.update({
        where: { id },
        data: dto,
      });
    }

    async remove(tenantId: string, id: string) {
      await this.findOne(tenantId, id); // Vérifie existence

      return this.prisma.provider.delete({
        where: { id },
      });
    }
  }
  ```

- [ ] **providers.controller.ts**
  ```typescript
  import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
  } from '@nestjs/common';
  import { ProvidersService } from './providers.service';
  import { CreateProviderDto } from './dto/create-provider.dto';
  import { UpdateProviderDto } from './dto/update-provider.dto';
  import { QueryProviderDto } from './dto/query-provider.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { CasbinGuard } from '../casbin/casbin.guard';
  import { RequirePermission } from '../casbin/decorators/require-permission.decorator';

  @Controller('providers')
  @UseGuards(JwtAuthGuard, CasbinGuard)
  export class ProvidersController {
    constructor(private readonly providersService: ProvidersService) {}

    @Post()
    @RequirePermission('providers', 'create')
    create(@Req() req, @Body() createProviderDto: CreateProviderDto) {
      return this.providersService.create(req.user.tenantId, createProviderDto);
    }

    @Get()
    @RequirePermission('providers', 'read')
    findAll(@Req() req, @Query() query: QueryProviderDto) {
      return this.providersService.findAll(req.user.tenantId, query);
    }

    @Get(':id')
    @RequirePermission('providers', 'read')
    findOne(@Req() req, @Param('id') id: string) {
      return this.providersService.findOne(req.user.tenantId, id);
    }

    @Patch(':id')
    @RequirePermission('providers', 'update')
    update(
      @Req() req,
      @Param('id') id: string,
      @Body() updateProviderDto: UpdateProviderDto,
    ) {
      return this.providersService.update(req.user.tenantId, id, updateProviderDto);
    }

    @Delete(':id')
    @RequirePermission('providers', 'delete')
    remove(@Req() req, @Param('id') id: string) {
      return this.providersService.remove(req.user.tenantId, id);
    }
  }
  ```

- [ ] **Enregistrer module dans `backend/src/app.module.ts`**
  ```typescript
  @Module({
    imports: [
      // ... existing modules
      ProvidersModule,  // AJOUTER ICI
    ],
  })
  export class AppModule {}
  ```

### 3. RBAC Policies Casbin (30 min)

- [ ] **Créer `backend/prisma/providers_policies.csv`**
  ```csv
  p, ADMIN, providers, create
  p, ADMIN, providers, read
  p, ADMIN, providers, update
  p, ADMIN, providers, delete
  p, MANAGER, providers, create
  p, MANAGER, providers, read
  p, MANAGER, providers, update
  p, TECHNICIEN, providers, read
  p, VIEWER, providers, read
  ```

- [ ] **Insérer policies en DB** (script SQL ou seed)
  ```sql
  -- Script à exécuter sur serveur via docker exec
  INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES
  ('p', 'ADMIN', 'providers', 'create'),
  ('p', 'ADMIN', 'providers', 'read'),
  ('p', 'ADMIN', 'providers', 'update'),
  ('p', 'ADMIN', 'providers', 'delete'),
  ('p', 'MANAGER', 'providers', 'create'),
  ('p', 'MANAGER', 'providers', 'read'),
  ('p', 'MANAGER', 'providers', 'update'),
  ('p', 'TECHNICIEN', 'providers', 'read'),
  ('p', 'VIEWER', 'providers', 'read')
  ON CONFLICT DO NOTHING;
  ```

### 4. Seed Data (30 min)

- [ ] **Mettre à jour `backend/prisma/seed.ts`**
  ```typescript
  // Ajouter après seed des autres entités

  console.log('Seeding providers...');
  await prisma.provider.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Orange Business Services',
        type: 'TELECOM',
        contact: 'Service Client: 3900 | contact@orange-business.com',
        notes: 'Opérateur principal pour les liaisons FTTH et 4G backup',
      },
      {
        tenantId: tenant.id,
        name: 'OVHcloud',
        type: 'CLOUD',
        contact: 'Support Entreprise: +33 9 72 10 10 07',
        notes: 'Provider cloud pour hébergement applications et stockage S3',
      },
      {
        tenantId: tenant.id,
        name: 'Equinix Paris',
        type: 'HOSTING',
        contact: 'NOC: noc-paris@equinix.com | +33 1 70 48 00 00',
        notes: 'Datacenter Tier III - Baies hébergées PA3',
      },
    ],
  });

  console.log('Providers seeded: 3');
  ```

### 5. Tests & Validation (1h)

- [ ] **Tests curl endpoints**
  ```bash
  # Login admin
  TOKEN=$(curl -X POST https://xchapi.eoncom.io/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@xch.demo","password":"admin123"}' \
    -s | jq -r '.accessToken')

  # Test GET /api/providers
  curl -H "Authorization: Bearer $TOKEN" \
    https://xchapi.eoncom.io/api/providers | jq

  # Test GET /api/providers?type=TELECOM
  curl -H "Authorization: Bearer $TOKEN" \
    "https://xchapi.eoncom.io/api/providers?type=TELECOM" | jq

  # Test POST /api/providers
  curl -X POST https://xchapi.eoncom.io/api/providers \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{
      "name": "SFR Business",
      "type": "INTERNET",
      "contact": "0805 701 801",
      "notes": "Backup connectivity provider"
    }' | jq

  # Test GET /api/providers/:id
  PROVIDER_ID="..." # ID récupéré du POST
  curl -H "Authorization: Bearer $TOKEN" \
    https://xchapi.eoncom.io/api/providers/$PROVIDER_ID | jq

  # Test PATCH /api/providers/:id
  curl -X PATCH https://xchapi.eoncom.io/api/providers/$PROVIDER_ID \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"contact": "Support: 0805 701 802"}' | jq

  # Test DELETE /api/providers/:id
  curl -X DELETE https://xchapi.eoncom.io/api/providers/$PROVIDER_ID \
    -H "Authorization: Bearer $TOKEN"
  ```

- [ ] **Vérifier RBAC avec rôles différents**
  ```bash
  # Login TECHNICIEN (read only)
  TOKEN_TECH=$(curl -X POST https://xchapi.eoncom.io/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"tech@xch.demo","password":"tech123"}' \
    -s | jq -r '.accessToken')

  # GET doit marcher
  curl -H "Authorization: Bearer $TOKEN_TECH" \
    https://xchapi.eoncom.io/api/providers

  # POST doit échouer (403 Forbidden)
  curl -X POST https://xchapi.eoncom.io/api/providers \
    -H "Authorization: Bearer $TOKEN_TECH" \
    -H 'Content-Type: application/json' \
    -d '{"name":"Test","type":"OTHER"}'
  # Expected: 403 Forbidden
  ```

## Dépendances

**Attend les livrables de :**
- Aucune dépendance (travail autonome)

**Prérequis :**
- ✅ Table `providers` existe en DB
- ✅ Prisma schema model Provider existe
- ✅ Backend NestJS fonctionnel

## Statut

- **Démarré :** Non
- **État :** Non démarré
- **Priorité :** ⭐ CRITIQUE (bloque frontend Providers)

## Prompt d'instanciation

```markdown
Tu es un agent spécialisé NestJS Backend chargé de créer le module Providers CRUD complet.

**Contexte :**
Le frontend Providers (4 pages) a été déployé en Session 16, mais le backend n'existe pas. Toutes les requêtes retournent 404. Tu dois créer le module backend complet ET aligner le schema Prisma sur les attentes frontend.

**Documents à lire :**
1. `/backend/prisma/schema.prisma` (lignes 467-498) - Model Provider actuel
2. `/BACKEND_FRONTEND_GAPS_ANALYSIS.md` - Analyse gaps (Gap 1.1, 1.2, 1.3)
3. `/docs/agents/agent-backend-providers-crud.md` - Ta fiche (ce fichier)
4. `/frontend/src/lib/api/providers.ts` - Attentes frontend
5. `/backend/src/modules/sites/sites.controller.ts` - Exemple controller existant

**Gaps à résoudre :**
1. **Enum ProviderType** : Changer CABLING, OPERATOR, INTEGRATOR, MAINTENANCE → TELECOM, INTERNET, CLOUD, HOSTING, OTHER
2. **Fields** : Remplacer `contacts: Json`, `availability: Json` par `contact: String?`
3. **Module manquant** : Créer controller, service, DTOs, RBAC

**Stack technique :**
- NestJS 10
- Prisma ORM
- Casbin RBAC
- class-validator
- PostgreSQL 15

**Livrables attendus :**
1. Migration Prisma (enum + fields)
2. Module NestJS complet (providers.module.ts, controller, service, DTOs)
3. RBAC policies Casbin (9 policies)
4. Seed data (3 providers réalistes)
5. Tests curl validation

**Contraintes critiques :**
- ❌ Ne JAMAIS faire `npm run build` localement
- ✅ Tous les builds se font dans Docker sur le serveur
- ✅ Migrations Prisma doivent être testées sur serveur avant commit
- ✅ Utiliser patterns existants du projet (copier structure modules/sites, modules/tasks)
- ✅ Respecter RBAC : ADMIN (CRUD), MANAGER (CRU), TECHNICIEN (R), VIEWER (R)

**Workflow :**
1. Lire les 5 documents listés ci-dessus
2. Modifier Prisma schema + créer migration SQL manuelle
3. Créer module NestJS (copier structure sites/tasks)
4. Créer policies CSV + script insertion
5. Mettre à jour seed.ts
6. Committer code
7. SSH serveur → pull → rebuild backend Docker → tests curl

**Format de tes réponses :**
- Utilise des blocs de code avec chemins de fichiers complets
- Documente chaque décision technique
- Fournis les commandes exactes pour tester

**Tu es autonome. Décide. Développe. Livre.**
```

## Notes

**Décisions techniques :**
- Migration enum ProviderType : Utiliser ALTER TYPE avec CASE mapping (pas de DROP/RECREATE pour éviter perte données)
- Structure fields : Aligner strictement sur frontend (contact string, pas contacts JSON)
- RBAC : 9 policies (4 ADMIN, 3 MANAGER, 1 TECHNICIEN, 1 VIEWER)

**Risques :**
- Migration enum peut échouer si données existantes incompatibles → Créer script de vérification pré-migration

**Dépendances externes :**
- Aucune
