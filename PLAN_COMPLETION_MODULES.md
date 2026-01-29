# Plan Complétion Modules - Application XCH

**Date:** 2026-01-29
**Contexte:** Audit révèle 95% complet - Compléter les 5% manquants AVANT UI/UX
**Objectif:** Application 100% fonctionnelle (toutes features MVP)

---

## 🎯 Résumé Audit

**État actuel:** 95% MVP complet
- ✅ Tous CRUD fonctionnels (Create, Read, Update, Delete)
- ✅ Visualisations (Konva, Leaflet) implémentées
- ✅ Auth + RBAC complets
- ❌ **5% manquants:** Formulaires relations complexes + uploads

---

## 🔴 PRIORITÉ 1 - Fonctionnalités Bloquantes (2-3 jours)

### 1.1 FloorPlans - Page Édition Manquante ❌

**Problème:** Bouton "Modifier" pointe vers page inexistante
**Impact:** Impossible de modifier metadata plan (titre, floor, building, notes)

**Actions:**
1. Créer `frontend/src/app/dashboard/floor-plans/[id]/edit/page.tsx`
2. Dupliquer structure de `new/page.tsx`
3. Pré-remplir formulaire avec données existantes
4. Gérer re-upload fichier (optionnel pour créer nouvelle version)

**Code à créer:**
```tsx
// frontend/src/app/dashboard/floor-plans/[id]/edit/page.tsx
'use client'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { floorPlansApi } from '@/lib/api/floor-plans'
import { FloorPlanForm } from '@/components/forms/FloorPlanForm'

export default function EditFloorPlanPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Récupérer plan existant
  const { data: floorPlan } = useQuery({
    queryKey: ['floor-plan', params.id],
    queryFn: () => floorPlansApi.getOne(params.id as string)
  })

  // Mutation update
  const updateMutation = useMutation({
    mutationFn: (data) => floorPlansApi.update(params.id as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] })
      queryClient.invalidateQueries({ queryKey: ['floor-plan', params.id] })
      toast.success('Plan mis à jour')
      router.push(`/dashboard/floor-plans/${params.id}`)
    }
  })

  if (!floorPlan) return <div>Chargement...</div>

  return (
    <div className="container mx-auto p-6">
      <h1>Modifier le plan</h1>
      <FloorPlanForm
        defaultValues={floorPlan}
        onSubmit={(data) => updateMutation.mutate(data)}
        submitLabel="Enregistrer"
      />
    </div>
  )
}
```

**Temps estimé:** 1-2h

---

### 1.2 Sites - Formulaire Contacts Édition ❌

**Problème:** Contacts affichés READ-ONLY, pas d'édition
**Impact:** Impossible de gérer contacts site (add/edit/delete)

**Actions:**
1. Modifier `frontend/src/app/dashboard/sites/[id]/edit/page.tsx`
2. Ajouter section "Contacts" avec tableau éditable
3. Implémenter CRUD contacts inline ou modal

**Code à ajouter:**
```tsx
// frontend/src/app/dashboard/sites/[id]/edit/page.tsx (ajout section)

// 1. État contacts
const [contacts, setContacts] = useState(site.contacts || [])

// 2. Fonctions CRUD
const addContact = () => {
  setContacts([...contacts, {
    name: '', role: '', phone: '', email: '', isPrimary: false
  }])
}

const updateContact = (index, field, value) => {
  const updated = [...contacts]
  updated[index][field] = value
  setContacts(updated)
}

const deleteContact = (index) => {
  setContacts(contacts.filter((_, i) => i !== index))
}

// 3. UI (après champs existants)
<div className="mt-8 border-t pt-6">
  <div className="flex justify-between items-center mb-4">
    <h3 className="text-lg font-semibold">Contacts</h3>
    <Button
      data-testid="add-contact-btn"
      type="button"
      onClick={addContact}
      variant="outline"
    >
      <Plus className="h-4 w-4 mr-2" />
      Ajouter un contact
    </Button>
  </div>

  <div className="space-y-4">
    {contacts.map((contact, index) => (
      <div key={index} className="grid grid-cols-5 gap-4 p-4 border rounded">
        <Input
          placeholder="Nom"
          value={contact.name}
          onChange={(e) => updateContact(index, 'name', e.target.value)}
        />
        <Input
          placeholder="Rôle"
          value={contact.role}
          onChange={(e) => updateContact(index, 'role', e.target.value)}
        />
        <Input
          placeholder="Téléphone"
          value={contact.phone}
          onChange={(e) => updateContact(index, 'phone', e.target.value)}
        />
        <Input
          placeholder="Email"
          type="email"
          value={contact.email}
          onChange={(e) => updateContact(index, 'email', e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={contact.isPrimary}
              onChange={(e) => updateContact(index, 'isPrimary', e.target.checked)}
            />
            <span className="ml-2 text-sm">Principal</span>
          </label>
          <Button
            data-testid="delete-contact-btn"
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => deleteContact(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ))}
  </div>
</div>

// 4. Inclure contacts dans formData submit
const handleSubmit = (data) => {
  const payload = {
    ...data,
    contacts: contacts.filter(c => c.name && c.email) // Filtrer vides
  }
  updateMutation.mutate(payload)
}
```

**Temps estimé:** 2-3h

---

### 1.3 Sites - Formulaire Connectivité Édition ❌

**Problème:** Connectivité affichée READ-ONLY
**Impact:** Impossible de configurer liens réseau (primary/backup)

**Actions similaires à 1.2:**
```tsx
// Ajouter section Connectivité avec 2 groupes:
// 1. Primary (type, provider, reference, bandwidth, notes)
// 2. Backup (mêmes champs)

<div className="mt-8 border-t pt-6">
  <h3 className="text-lg font-semibold mb-4">Connectivité</h3>

  <div className="grid grid-cols-2 gap-6">
    {/* Primary */}
    <div className="border p-4 rounded">
      <h4 className="font-medium mb-3">Connexion Principale</h4>
      <Select
        label="Type"
        options={['FIBER', 'ADSL', '4G', '5G', 'SATELLITE']}
        value={connectivity.primary.type}
        onChange={(val) => setConnectivity({...connectivity, primary: {...connectivity.primary, type: val}})}
      />
      <Input label="Provider" {...} />
      <Input label="Référence" {...} />
      <Input label="Bande passante" {...} />
      <Textarea label="Notes" {...} />
    </div>

    {/* Backup (idem) */}
  </div>
</div>
```

**Temps estimé:** 2h

---

### 1.4 Sites - Formulaire Access Notes Édition ❌

**Problème:** AccessNotes affichées READ-ONLY
**Impact:** Impossible de documenter accès site (badges, horaires, procédures)

**Actions:**
```tsx
// Ajouter section AccessNotes
<div className="mt-8 border-t pt-6">
  <h3 className="text-lg font-semibold mb-4">Notes d'Accès</h3>

  <div className="space-y-4">
    <Textarea
      label="Horaires d'accès"
      placeholder="Lun-Ven 8h-18h..."
      rows={3}
      value={accessNotes.schedules}
      onChange={(e) => setAccessNotes({...accessNotes, schedules: e.target.value})}
    />

    <Textarea
      label="Badges requis"
      placeholder="Badge site + badge bâtiment A..."
      rows={2}
      {...}
    />

    <Textarea
      label="Procédures d'entrée"
      placeholder="1. S'enregistrer à l'accueil..."
      rows={4}
      {...}
    />

    <Textarea
      label="Consignes de sécurité"
      placeholder="Port du casque obligatoire..."
      rows={3}
      {...}
    />
  </div>
</div>
```

**Temps estimé:** 1h

---

## 🟡 PRIORITÉ 2 - Upload Fichiers (2 jours)

### 2.1 Assets - Upload Pièces Jointes ❌

**Problème:** Pas de gestion fichiers (specs, factures, photos)
**Impact:** Documentation équipements incomplète

**Actions:**
1. Créer onglet "Documents" dans asset detail
2. Composant upload + liste fichiers
3. API endpoint POST /api/assets/:id/attachments
4. Stockage MinIO

**Code composant:**
```tsx
// frontend/src/components/AssetAttachments.tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assetsApi } from '@/lib/api/assets'
import { Upload, File, Trash2, Download } from 'lucide-react'

export function AssetAttachments({ assetId }: { assetId: string }) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)

  // Liste attachments
  const { data: attachments } = useQuery({
    queryKey: ['asset-attachments', assetId],
    queryFn: () => assetsApi.getAttachments(assetId)
  })

  // Upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return assetsApi.uploadAttachment(assetId, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-attachments', assetId] })
      toast.success('Fichier ajouté')
      setUploading(false)
    }
  })

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => assetsApi.deleteAttachment(assetId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-attachments', assetId] })
      toast.success('Fichier supprimé')
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation taille (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10MB)')
      return
    }

    setUploading(true)
    uploadMutation.mutate(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Documents</h3>
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button data-testid="upload-attachment-btn" disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Upload...' : 'Ajouter un fichier'}
          </Button>
        </label>
      </div>

      <div className="space-y-2">
        {attachments?.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-3 border rounded hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <File className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{attachment.filename}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(attachment.size)} • {formatDate(attachment.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="download-attachment-btn"
                variant="ghost"
                size="sm"
                onClick={() => window.open(attachment.url, '_blank')}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                data-testid="delete-attachment-btn"
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(attachment.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {attachments?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Aucun document
          </p>
        )}
      </div>
    </div>
  )
}
```

**Backend API nécessaire:**
```typescript
// backend/src/modules/assets/assets.controller.ts

@Post(':id/attachments')
@Resource('assets') @Action('update')
@UseInterceptors(FileInterceptor('file'))
@ApiOperation({ summary: 'Upload asset attachment' })
async uploadAttachment(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
  @Request() req: AuthRequest
) {
  return this.assetsService.uploadAttachment(id, req.user.tenantId, file)
}

@Get(':id/attachments')
@Resource('assets') @Action('read')
async getAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
  return this.assetsService.getAttachments(id, req.user.tenantId)
}

@Delete(':id/attachments/:attachmentId')
@Resource('assets') @Action('update')
async deleteAttachment(
  @Param('id') id: string,
  @Param('attachmentId') attachmentId: string,
  @Request() req: AuthRequest
) {
  return this.assetsService.deleteAttachment(id, attachmentId, req.user.tenantId)
}
```

**Temps estimé:** 4-5h (frontend + backend + MinIO)

---

### 2.2 Tasks - Upload Pièces Jointes ❌

**Actions:** Identiques à 2.1, adapter pour tasks
**Temps estimé:** 3-4h (réutilisation code assets)

---

## 🟢 PRIORITÉ 3 - Optimisations UX (1-2 jours)

### 3.1 Racks - Édition Montage Équipement ⚠️

**Problème:** Équipement monté ne peut PAS être modifié (position/hauteur)
**Impact:** Doit unmount + remount pour corriger erreur

**Actions:**
1. Ajouter bouton "Modifier" sur équipement monté
2. Ouvrir modal similaire à mount dialog
3. Permettre changement positionU / heightU
4. Valider overlap

**Code à ajouter:**
```tsx
// Dans liste équipements montés (ligne 299-313)
<Button
  data-testid="edit-mounted-equipment-btn"
  variant="ghost"
  size="sm"
  onClick={() => handleEditMount(mountedAsset)}
>
  <Pencil className="h-4 w-4" />
</Button>

// Modal édition (réutiliser MountDialog)
<MountDialog
  isOpen={editDialogOpen}
  onClose={() => setEditDialogOpen(false)}
  rackId={rack.id}
  heightU={rack.heightU}
  initialValues={{
    assetId: selectedMount.assetId,
    positionU: selectedMount.positionU,
    heightU: selectedMount.heightU
  }}
  onSubmit={(data) => editMountMutation.mutate(data)}
  mode="edit"
/>
```

**Temps estimé:** 2h

---

### 3.2 Validation Overlap Montage Rack 🔧

**Problème:** Pas de vérification chevauchement avant montage
**Impact:** Risque monter 2 équipements au même emplacement

**Actions:**
Backend - Ajouter validation dans `racks.service.ts`:
```typescript
// backend/src/modules/racks/racks.service.ts

async mountAsset(rackId: string, tenantId: string, mountData: MountAssetDto) {
  // 1. Vérifier rack existe
  const rack = await this.findOne(rackId, tenantId)

  // 2. **NOUVEAU:** Vérifier overlap
  const existingMounts = await this.prisma.mountedAsset.findMany({
    where: { rackId, tenantId }
  })

  const hasOverlap = existingMounts.some(mount => {
    const mountEnd = mount.positionU + mount.heightU
    const newEnd = mountData.positionU + mountData.heightU

    return !(newEnd <= mount.positionU || mountData.positionU >= mountEnd)
  })

  if (hasOverlap) {
    throw new ConflictException('Overlap détecté avec équipement existant')
  }

  // 3. Vérifier ne dépasse pas hauteur rack
  if (mountData.positionU + mountData.heightU > rack.heightU) {
    throw new BadRequestException(`Dépasse hauteur rack (${rack.heightU}U)`)
  }

  // 4. Créer montage
  return this.prisma.mountedAsset.create({
    data: {
      ...mountData,
      rackId,
      tenantId
    }
  })
}
```

**Temps estimé:** 1h

---

## 📋 Planning d'Exécution

### Semaine 1: Formulaires Critiques (3 jours)
**Jour 1:**
- [ ] FloorPlans edit page (2h)
- [ ] Sites contacts édition (3h)

**Jour 2:**
- [ ] Sites connectivité édition (2h)
- [ ] Sites accessNotes édition (1h)
- [ ] Tests formulaires manuels (2h)

**Jour 3:**
- [ ] Commits + Push + Déploiement (1h)
- [ ] Validation production (2h)

### Semaine 2: Uploads + Optimisations (2 jours)
**Jour 4:**
- [ ] Assets upload attachments (backend 2h + frontend 3h)

**Jour 5:**
- [ ] Tasks upload attachments (3h)
- [ ] Racks édition montage (2h)
- [ ] Validation overlap rack (1h)

**Jour 6:**
- [ ] Tests E2E complets (2h)
- [ ] Corrections bugs identifiés (3h)
- [ ] Déploiement final + validation (1h)

---

## ✅ Checklist Validation Finale

Avant de démarrer UI/UX, vérifier:

### Formulaires
- [ ] FloorPlans edit page existe et fonctionne
- [ ] Sites contacts CRUD fonctionnel
- [ ] Sites connectivity CRUD fonctionnel
- [ ] Sites accessNotes CRUD fonctionnel

### Uploads
- [ ] Assets attachments: upload OK
- [ ] Assets attachments: liste/download OK
- [ ] Assets attachments: delete OK
- [ ] Tasks attachments: upload OK
- [ ] Tasks attachments: liste/download OK
- [ ] Tasks attachments: delete OK

### Validations
- [ ] Rack overlap check backend
- [ ] Rack positionU + heightU <= rack.heightU
- [ ] File size limit 10MB
- [ ] File type validation (PDF, PNG, JPG, DOCX, XLSX)

### Tests E2E
- [ ] Tests passent à 80%+ (vs 72% actuel)
- [ ] Uploads testés via Playwright
- [ ] Formulaires testés avec validations

---

## 🎯 Résultat Attendu

**Application 100% MVP fonctionnelle:**
- ✅ TOUS les formulaires complets
- ✅ TOUS les uploads fonctionnels
- ✅ TOUTES les validations métier
- ✅ Tests E2E 80%+
- ✅ **PRÊT pour optimisation UI/UX**

**Délai total:** 5-6 jours (vs 3 semaines UI/UX)

---

**Prioriser la COMPLÉTION avant l'OPTIMISATION !** ✅
