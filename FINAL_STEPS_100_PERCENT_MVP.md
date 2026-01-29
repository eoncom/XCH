# Dernières Étapes - 100% MVP (Upload Attachments)

**Date:** 2026-01-29
**État actuel:** 98% MVP
**Restant:** Upload attachments Assets + Tasks (2%)
**Durée estimée:** 6-8h

---

## 🎯 Résumé

L'application XCH est **98% complète** avec toutes les fonctionnalités CRUD, visualisations, RBAC, et formulaires relations.

**Seule fonctionnalité manquante:** Upload et gestion de pièces jointes (PDF, images, documents) pour Assets et Tasks.

---

## ✅ Ce qui est DÉJÀ fait

1. ✅ Backend RBAC (63 policies Casbin)
2. ✅ Backend Settings (3 endpoints)
3. ✅ Frontend data-testid (46 total)
4. ✅ FloorPlans edit page
5. ✅ Sites formulaires complets (contacts, connectivity, accessNotes)
6. ✅ Tous CRUD fonctionnels (7 modules)
7. ✅ Visualisations (Konva, Leaflet)

---

## ⏳ À FAIRE - Upload Attachments (6-8h)

### Étape 1: Schéma DB + Migration (30min)

**1.1 Ajouter model Attachment à Prisma**

Éditer `backend/prisma/schema.prisma`, ajouter AVANT `model AuditLog` :

```prisma
// ============================================================================
// ATTACHMENTS (Files uploaded to Assets/Tasks)
// ============================================================================

model Attachment {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Polymorphic relation (asset OR task)
  assetId     String?
  asset       Asset?   @relation(fields: [assetId], references: [id], onDelete: Cascade)
  taskId      String?
  task        Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)

  // File metadata
  filename         String
  originalFilename String
  size             Int      // bytes
  mimetype         String
  path             String   // MinIO path: tenantId/assetId|taskId/uuid-filename.ext

  description String?
  uploadedBy  String?
  uploadedAt  DateTime @default(now())

  @@index([tenantId])
  @@index([assetId])
  @@index([taskId])
  @@map("attachments")
}
```

**1.2 Ajouter relation dans models Asset et Task**

Dans `model Asset` (après `photos Photo[]`) :
```prisma
attachments Attachment[]
```

Dans `model Task` (après `photos Photo[]`) :
```prisma
attachments Attachment[]
```

Dans `model Tenant` (dans section `// Relations`, après autres relations) :
```prisma
attachments Attachment[]
```

**1.3 Créer migration**

```bash
cd backend
npx prisma migrate dev --name add-attachments
npx prisma generate
```

---

### Étape 2: Backend Assets Attachments (2h)

**2.1 Créer DTO**

Créer `backend/src/modules/assets/dto/upload-attachment.dto.ts` :
```typescript
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadAttachmentDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
```

**2.2 Ajouter dans assets.controller.ts**

Ajouter imports :
```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
```

Ajouter endpoints (à la fin, avant le `}` final) :
```typescript
@Post(':id/attachments')
@Resource('assets') @Action('update')
@UseInterceptors(FileInterceptor('file'))
@ApiOperation({ summary: 'Upload attachment to asset' })
async uploadAttachment(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: UploadAttachmentDto,
  @Request() req: AuthRequest
) {
  return this.assetsService.uploadAttachment(id, req.user.tenantId, req.user.userId, file, dto);
}

@Get(':id/attachments')
@Resource('assets') @Action('read')
@ApiOperation({ summary: 'Get asset attachments' })
async getAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
  return this.assetsService.getAttachments(id, req.user.tenantId);
}

@Delete(':id/attachments/:attachmentId')
@Resource('assets') @Action('update')
@ApiOperation({ summary: 'Delete attachment' })
async deleteAttachment(
  @Param('id') id: string,
  @Param('attachmentId') attachmentId: string,
  @Request() req: AuthRequest
) {
  return this.assetsService.deleteAttachment(id, attachmentId, req.user.tenantId);
}
```

**2.3 Implémenter dans assets.service.ts**

Ajouter imports :
```typescript
import { v4 as uuidv4 } from 'uuid';
import { Inject } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
```

Dans constructor, ajouter MinIO :
```typescript
constructor(
  private prisma: PrismaClient,
  @Inject('MINIO_CLIENT') private minioClient: MinioClient,
) {}
```

Ajouter méthodes (à la fin, avant le `}` final) :
```typescript
async uploadAttachment(
  assetId: string,
  tenantId: string,
  userId: string,
  file: Express.Multer.File,
  dto: UploadAttachmentDto
) {
  // Vérifier asset existe
  const asset = await this.findOne(assetId, tenantId);

  // Générer path MinIO
  const fileId = uuidv4();
  const ext = file.originalname.split('.').pop();
  const filename = `${fileId}.${ext}`;
  const path = `${tenantId}/assets/${assetId}/${filename}`;

  // Upload vers MinIO
  const bucketName = 'attachments';

  // Créer bucket si n'existe pas
  const bucketExists = await this.minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await this.minioClient.makeBucket(bucketName, 'us-east-1');
  }

  await this.minioClient.putObject(
    bucketName,
    path,
    file.buffer,
    file.size,
    { 'Content-Type': file.mimetype }
  );

  // Créer entrée DB
  const attachment = await this.prisma.attachment.create({
    data: {
      tenantId,
      assetId,
      filename,
      originalFilename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path,
      description: dto.description,
      uploadedBy: userId,
    }
  });

  // Générer URL présignée (7 jours)
  const url = await this.minioClient.presignedGetObject(bucketName, path, 7 * 24 * 60 * 60);

  return { ...attachment, url };
}

async getAttachments(assetId: string, tenantId: string) {
  const attachments = await this.prisma.attachment.findMany({
    where: { assetId, tenantId },
    orderBy: { uploadedAt: 'desc' }
  });

  // Générer URLs présignées (24h)
  const bucketName = 'attachments';
  return Promise.all(attachments.map(async (att) => ({
    ...att,
    url: await this.minioClient.presignedGetObject(bucketName, att.path, 24 * 60 * 60)
  })));
}

async deleteAttachment(assetId: string, attachmentId: string, tenantId: string) {
  const attachment = await this.prisma.attachment.findFirst({
    where: { id: attachmentId, assetId, tenantId }
  });

  if (!attachment) {
    throw new NotFoundException('Attachment not found');
  }

  // Delete MinIO
  await this.minioClient.removeObject('attachments', attachment.path);

  // Delete DB
  await this.prisma.attachment.delete({ where: { id: attachmentId } });

  return { message: 'Attachment deleted successfully' };
}
```

---

### Étape 3: Backend Tasks Attachments (1h)

**3.1 Copier endpoints dans tasks.controller.ts**

Mêmes endpoints que Assets, remplacer :
- `assetsService` → `tasksService`
- `'assets'` → `'tasks'` (dans decorators @Resource)

**3.2 Copier méthodes dans tasks.service.ts**

Mêmes méthodes que Assets service, remplacer :
- `assetId` → `taskId`
- `asset` → `task`
- `path: ${tenantId}/assets/` → `path: ${tenantId}/tasks/`
- `this.findOne` → utiliser query Prisma tasks

---

### Étape 4: Frontend Composant Attachments (2h)

**4.1 Créer composant réutilisable**

Créer `frontend/src/components/Attachments.tsx` :

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, Trash2, Download, Loader2 } from 'lucide-react';
import { showToast } from '@/lib/toast';

interface Attachment {
  id: string;
  filename: string;
  originalFilename: string;
  size: number;
  mimetype: string;
  description?: string;
  uploadedAt: string;
  url: string;
}

interface AttachmentsProps {
  entityId: string;
  entityType: 'asset' | 'task';
  apiModule: {
    uploadAttachment: (id: string, formData: FormData) => Promise<any>;
    getAttachments: (id: string) => Promise<Attachment[]>;
    deleteAttachment: (id: string, attachmentId: string) => Promise<any>;
  };
}

export function Attachments({ entityId, entityType, apiModule }: AttachmentsProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: attachments, isLoading } = useQuery<Attachment[]>({
    queryKey: [`${entityType}-attachments`, entityId],
    queryFn: () => apiModule.getAttachments(entityId)
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiModule.uploadAttachment(entityId, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${entityType}-attachments`, entityId] });
      showToast.success('Fichier ajouté avec succès');
      setUploading(false);
    },
    onError: (error: any) => {
      showToast.error(error.message || 'Erreur lors de l\'upload');
      setUploading(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiModule.deleteAttachment(entityId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${entityType}-attachments`, entityId] });
      showToast.success('Fichier supprimé');
    },
    onError: (error: any) => {
      showToast.error(error.message || 'Erreur lors de la suppression');
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast.error('Fichier trop volumineux (max 10MB)');
      return;
    }

    setUploading(true);
    uploadMutation.mutate(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Documents & Pièces jointes</CardTitle>
          <label>
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button
              data-testid="upload-attachment-btn"
              disabled={uploading}
              size="sm"
              asChild
            >
              <span>
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploading ? 'Upload...' : 'Ajouter un fichier'}
              </span>
            </Button>
          </label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {attachments && attachments.length > 0 ? (
            attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 border rounded hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{att.originalFilename}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(att.size)} • {new Date(att.uploadedAt).toLocaleDateString('fr-FR')}
                    </p>
                    {att.description && (
                      <p className="text-sm text-muted-foreground italic mt-1">
                        {att.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    data-testid="download-attachment-btn"
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(att.url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    data-testid="delete-attachment-btn"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Supprimer ce fichier ?')) {
                        deleteMutation.mutate(att.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucun document. Cliquez sur "Ajouter un fichier" pour en uploader un.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**4.2 Ajouter méthodes API dans assetsApi et tasksApi**

Éditer `frontend/src/lib/api/assets.ts`, ajouter :
```typescript
uploadAttachment: async (id: string, formData: FormData) => {
  const response = await fetch(`${API_URL}/assets/${id}/attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
    },
    body: formData,
  });
  if (!response.ok) throw new Error('Upload failed');
  return response.json();
},

getAttachments: async (id: string) => {
  const response = await fetch(`${API_URL}/assets/${id}/attachments`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch attachments');
  return response.json();
},

deleteAttachment: async (id: string, attachmentId: string) => {
  const response = await fetch(`${API_URL}/assets/${id}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
    },
  });
  if (!response.ok) throw new Error('Delete failed');
  return response.json();
},
```

Idem pour `frontend/src/lib/api/tasks.ts` (remplacer `/assets/` par `/tasks/`).

---

### Étape 5: Intégration dans Assets Detail (30min)

Éditer `frontend/src/app/dashboard/assets/[id]/page.tsx` :

**Ajouter import :**
```typescript
import { Attachments } from '@/components/Attachments';
import { assetsApi } from '@/lib/api/assets';
```

**Ajouter onglet "Documents" dans les Tabs** (après onglet "Historique") :
```tsx
<TabsList>
  <TabsTrigger value="details">Détails</TabsTrigger>
  <TabsTrigger value="qr">QR Code</TabsTrigger>
  <TabsTrigger value="history">Historique</TabsTrigger>
  <TabsTrigger value="documents">Documents</TabsTrigger>
</TabsList>

{/* Contenu onglet Documents */}
<TabsContent value="documents" className="mt-6">
  <Attachments
    entityId={asset.id}
    entityType="asset"
    apiModule={assetsApi}
  />
</TabsContent>
```

---

### Étape 6: Intégration dans Tasks Detail (30min)

Même chose pour `frontend/src/app/dashboard/tasks/[id]/page.tsx` :
- Import composant + API
- Ajouter onglet "Documents"
- Utiliser `<Attachments entityType="task" apiModule={tasksApi} />`

---

### Étape 7: Tests + Déploiement (1h)

**7.1 Tests locaux**

```bash
# Backend
cd backend
npm run build  # Vérifier compilation TypeScript
npm run start:dev  # Tester endpoints

# Frontend
cd frontend
npm run build  # Vérifier compilation Next.js
npm run dev  # Tester UI
```

**7.2 Tests manuels**
1. Uploader fichier PDF sur un asset
2. Télécharger le fichier
3. Supprimer le fichier
4. Vérifier MinIO bucket `attachments/`
5. Répéter pour tasks

**7.3 Déploiement production**

```bash
# 1. Commit + Push
cd /c/xampp/htdocs/XCH
git add -A
git commit -m "feat: Add upload attachments for Assets and Tasks

- Add Attachment model to Prisma schema
- Create backend endpoints (upload, list, delete) for Assets
- Create backend endpoints (upload, list, delete) for Tasks
- Add Attachments frontend component (reusable)
- Integrate attachments in Assets detail page
- Integrate attachments in Tasks detail page
- Upload to MinIO bucket 'attachments'
- Generate presigned URLs (24h validity)
- Add data-testid for E2E tests

Completes: 100% MVP functional
Related: MVP_COMPLETION_STATUS.md
Closes: PLAN_COMPLETION_MODULES.md Priority 2

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin main

# 2. Déployer sur serveur
ssh xch-deploy "cd /opt/xch-dev/XCH && git pull origin main"

# 3. Appliquer migration Prisma
ssh xch-deploy "cd /opt/xch-dev/XCH/backend && docker-compose exec backend npx prisma migrate deploy"

# 4. Redémarrer services
ssh xch-deploy "cd /opt/xch-dev/XCH && docker-compose restart backend frontend"

# 5. Vérifier logs
ssh xch-deploy "docker logs --tail 50 xch-backend"
ssh xch-deploy "docker logs --tail 50 xch-frontend"
```

---

## ✅ Checklist Validation 100% MVP

Après déploiement, vérifier :

### Backend
- [ ] Migration Prisma appliquée (table `attachments` existe)
- [ ] Endpoints Assets attachments fonctionnels :
  - [ ] POST `/api/assets/:id/attachments` (upload)
  - [ ] GET `/api/assets/:id/attachments` (liste)
  - [ ] DELETE `/api/assets/:id/attachments/:attachmentId` (delete)
- [ ] Endpoints Tasks attachments fonctionnels (idem)
- [ ] MinIO bucket `attachments` créé
- [ ] URLs présignées générées correctement

### Frontend
- [ ] Composant Attachments s'affiche dans Assets detail
- [ ] Composant Attachments s'affiche dans Tasks detail
- [ ] Upload fichier fonctionne (< 10MB)
- [ ] Liste fichiers s'affiche
- [ ] Download fichier fonctionne (ouvre nouvel onglet)
- [ ] Delete fichier fonctionne (avec confirmation)
- [ ] Messages toast affichés (succès/erreur)

### Tests E2E (bonus)
- [ ] Créer spec `assets-attachments.spec.ts`
- [ ] Créer spec `tasks-attachments.spec.ts`
- [ ] Tests: upload, list, download, delete

---

## 🎉 Résultat Final

**Application XCH 100% MVP Fonctionnelle !**

- ✅ 7 modules CRUD complets
- ✅ Visualisations (Konva, Leaflet)
- ✅ Auth + RBAC (63 policies)
- ✅ Formulaires relations (contacts, connectivity, accessNotes)
- ✅ Upload fichiers (Assets + Tasks) ← DERNIÈRE PIÈCE
- ✅ Tests E2E 72%+ (estimé)
- ✅ Déployé en production

**Prêt pour UI/UX !** 🚀

---

**Durée totale complétion 100%:** 6-8h
**Roadmap UI/UX:** 3 semaines (voir ROADMAP_UI_UX_IMPROVEMENTS.md)
