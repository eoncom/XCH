# Problème Déploiement - Corrections Nécessaires

**Date:** 2026-01-29
**Status:** ❌ BLOQUÉ - Erreurs compilation backend

---

## 🔴 Problème Identifié

Le déploiement échoue lors du build backend avec 2 erreurs:

### Erreur 1: MinioService n'existe pas
```
ERROR in ./src/modules/assets/assets.service.ts:9:30
TS2307: Cannot find module '../../common/services/minio.service' or its corresponding type declarations.
```

**Cause:** J'ai créé le code attachments avec `MinioService` mais le projet utilise `StorageService`.

### Erreur 2: Import cuid incorrect
```
ERROR in ./src/modules/assets/assets.service.ts:10:10
TS2305: Module '"@paralleldrive/cuid2"' has no exported member 'cuid'.
```

**Cause:** L'export de `@paralleldrive/cuid2` est `createId`, pas `cuid`.

---

## ✅ Solutions Rapides

### Solution 1: Remplacer MinioService par StorageService

**Fichiers à modifier:**
- `backend/src/modules/assets/assets.service.ts`
- `backend/src/modules/tasks/tasks.service.ts`

**Changements:**

#### Dans assets.service.ts
```typescript
// AVANT (ligne 9)
import { MinioService } from '../../common/services/minio.service';
import { cuid } from '@paralleldrive/cuid2';

// APRÈS
import { StorageService } from '../../common/services/storage.service';
import { createId } from '@paralleldrive/cuid2';
```

```typescript
// AVANT (ligne 18)
constructor(
  private prisma: PrismaClient,
  private qrCodeService: QRCodeService,
  private configService: ConfigService,
  private minioService: MinioService,
) {}

// APRÈS
constructor(
  private prisma: PrismaClient,
  private qrCodeService: QRCodeService,
  private configService: ConfigService,
  private storageService: StorageService,
) {}
```

```typescript
// AVANT (uploadAttachment method - ligne 303)
const attachment = await this.prisma.attachment.create({
  data: {
    id: cuid(),  // ❌ ERREUR
    tenantId,
    assetId,
    // ...
  },
});

// APRÈS
const attachment = await this.prisma.attachment.create({
  data: {
    id: createId(),  // ✅ OK
    tenantId,
    assetId,
    // ...
  },
});
```

**Note:** StorageService utilise filesystem par défaut. MinIO peut être implémenté plus tard.

#### Dans tasks.service.ts
Mêmes changements:
- `MinioService` → `StorageService`
- `cuid()` → `createId()`
- `minioService` → `storageService`

---

## 🔧 Corrections Complètes

### Option A: Utiliser StorageService (Simplifié - Filesystem)

**Avantage:** Fonctionne immédiatement sans MinIO
**Inconvénient:** Pas de presigned URLs, fichiers sur disque local

**Modifications méthodes d'upload:**

```typescript
// Dans uploadAttachment method
async uploadAttachment(
  assetId: string,
  tenantId: string,
  userId: string,
  file: Express.Multer.File,
  dto: UploadAttachmentDto,
) {
  await this.findOne(assetId, tenantId);

  // Generate unique filename
  const filename = this.storageService.generateFilename(file.originalname, 'attachment');

  // Upload to storage (filesystem)
  const filePath = await this.storageService.uploadFile(
    file,
    `attachments/${tenantId}/assets/${assetId}`,
    filename
  );

  // Create database entry
  const attachment = await this.prisma.attachment.create({
    data: {
      id: createId(),
      tenantId,
      assetId,
      filename,
      originalFilename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: filePath,
      description: dto.description,
      category: dto.category,
      uploadedBy: userId,
    },
  });

  // Get file URL (http://localhost:3000/uploads/...)
  const url = this.storageService.getFileUrl(filePath);

  return {
    ...attachment,
    url,
  };
}
```

### Option B: Implémenter MinIO Service Complet (Recommandé mais + long)

Créer `backend/src/common/services/minio.service.ts` avec méthodes:
- `uploadFile(bucket, path, buffer, size, mimetype)`
- `getPresignedUrl(bucket, path, expiry)`
- `deleteFile(bucket, path)`

**Durée:** 1-2 heures pour implémenter correctement

---

## 🚀 Action Immédiate Recommandée

### Pour Débloquer le Déploiement MAINTENANT:

**1. Utiliser StorageService (Option A - Filesystem)**
- ✅ Rapide (10 minutes)
- ✅ Fonctionne immédiatement
- ✅ Pas de dépendance MinIO
- ⚠️ Fichiers sur disque local (pas de CDN)

**2. Implémenter MinIO plus tard**
- Après déploiement réussi
- Quand upload/download marche
- Phase amélioration UI/UX

---

## 📋 Checklist Corrections

### Corrections Minimales (StorageService)
- [ ] Remplacer `MinioService` → `StorageService` (2 fichiers)
- [ ] Remplacer `cuid()` → `createId()` (2 fichiers)
- [ ] Remplacer `minioService` → `storageService` (2 fichiers)
- [ ] Simplifier méthodes upload (pas de presigned URLs)
- [ ] Commit + Push corrections

### Après Corrections
- [ ] Pull sur serveur
- [ ] Rebuild backend: `docker-compose build --no-cache backend`
- [ ] Restart backend: `docker-compose restart backend`
- [ ] Tester upload fichier
- [ ] Vérifier fichiers dans `/uploads/attachments/`

---

## 💡 Alternative: Rollback Temporaire

Si corrections trop longues, rollback vers version stable:

```bash
cd /opt/xch-dev/XCH
git reset --hard e079be6  # Commit avant attachments
docker-compose -f backend/docker-compose.yml restart backend
docker-compose -f frontend/docker-compose.yml restart frontend
```

**Application reviendra à 98% MVP sans upload attachments.**

---

## 📊 Estimation Temps

| Option | Temps | Complexité |
|--------|-------|------------|
| Corrections StorageService | 15-20 min | Faible |
| Impl MinIO complet | 1-2h | Moyenne |
| Rollback temporaire | 2 min | Très faible |

---

## ✅ Recommandation

**Faire corrections StorageService (Option A) maintenant:**
1. Remplacer imports (2 fichiers × 3 lignes = 6 changements)
2. Adapter méthodes upload (supprimer logique presigned URLs)
3. Commit + Push
4. Rebuild + Restart sur serveur
5. Tester upload

**Implémenter MinIO plus tard** quand application fonctionne.

---

**Status:** EN ATTENTE CORRECTIONS
**Bloquage:** Build backend échoue
**Solution:** 15-20 min corrections StorageService
