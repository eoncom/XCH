# Agent Frontend Sites Connectivity Refactor

## Mission

Refactor les formulaires Sites (new/edit) pour utiliser la structure `connectivity` JSON du backend au lieu des 3 champs plats (`internet`, `backup`, `procedure`).

## Contexte

**Problème :** L'Agent Sites (Session 16 - afd8497) a créé 3 champs simples (`internet`, `backup`, `procedure`) mais le backend utilise un JSON structuré `connectivity: {primary, backup, cutProcedure}`. Résultat : données perdues silencieusement.

**Documents de référence :**
- `/backend/prisma/schema.prisma` - Model Site (ligne 176) → `connectivity Json? @db.JsonB`
- `/BACKEND_FRONTEND_GAPS_ANALYSIS.md` - Analyse gap (Gap 2.1, 2.2, 2.3)
- `/frontend/src/app/dashboard/sites/new/page.tsx` - Formulaire création (à refactor)
- `/frontend/src/app/dashboard/sites/[id]/edit/page.tsx` - Formulaire édition (à refactor)
- `/frontend/src/types/index.ts` - Interface Site (à mettre à jour)

**Gap identifié :**
- Backend attend : `connectivity: {primary: {type, provider, ref}, backup: {type, provider, ref}, cutProcedure}`
- Frontend envoie : `internet` (string), `backup` (string), `procedure` (string)
- Impact : **Silent data loss** (formulaire save mais données perdues)

**Décision architecture :** **Option A - Adapter Frontend au Backend**
- Raison : Backend `connectivity` JSON est déjà utilisé (peut contenir des données)
- Avantage : Pas de migration DB, structure plus riche, filtres possibles
- Inconvénient : Refactor frontend nécessaire

## Stack technique

- **Framework :** Next.js 15.5.9 (App Router)
- **Forms :** react-hook-form 7.54.2
- **Validation :** Zod 3.24.1
- **UI :** shadcn/ui (Radix UI primitives)
- **TypeScript :** 5.7.3 strict mode

## Livrables

### 1. Interface TypeScript (30 min)

- [x] **Modifier `frontend/src/types/index.ts`** ✅ FAIT

**Supprimer (lignes ajoutées par Session 16) :**
```typescript
export interface Site {
  // ... autres champs
  internet?: string;   // ❌ SUPPRIMER
  backup?: string;     // ❌ SUPPRIMER
  procedure?: string;  // ❌ SUPPRIMER
}
```

**Ajouter (structure backend) :**
```typescript
export interface SiteConnectivity {
  primary?: {
    type: string;      // Fiber, 4G, Satellite, ADSL, etc.
    provider: string;  // Nom opérateur
    ref?: string;      // Référence contrat
  };
  backup?: {
    type: string;
    provider: string;
    ref?: string;
  };
  cutProcedure?: string; // Procédure coupure
}

export interface Site {
  id: number;
  tenantId: string;
  code: string;
  name: string;
  status: SiteStatus;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  contacts?: any; // JSON
  accessNotes?: any; // JSON
  connectivity?: SiteConnectivity;  // ✅ AJOUTER
  emplacements?: any; // JSON
  governanceDocsRef?: string;
  healthStatus: HealthStatus;
  lastHealthCheck?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. Formulaire Création Sites (1h)

- [x] **Modifier `frontend/src/app/dashboard/sites/new/page.tsx`** ✅ FAIT

**Schema Zod à modifier :**
```typescript
const siteFormSchema = z.object({
  code: z.string().min(1, 'Code requis').max(50, 'Max 50 caractères'),
  name: z.string().min(1, 'Nom requis').max(100, 'Max 100 caractères'),
  status: z.enum(['PREPARATION', 'ACTIVE', 'CLOSED']),
  address: z.string().min(1, 'Adresse requise'),
  city: z.string().min(1, 'Ville requise'),
  postalCode: z.string().optional().or(z.literal('')),
  country: z.string().default('France'),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal('')),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')),

  // ❌ SUPPRIMER CES 3 CHAMPS :
  // internet: z.string().max(200, 'Max 200 caractères').optional().or(z.literal('')),
  // backup: z.string().max(200, 'Max 200 caractères').optional().or(z.literal('')),
  // procedure: z.string().max(2000, 'Max 2000 caractères').optional().or(z.literal('')),

  // ✅ AJOUTER STRUCTURE CONNECTIVITY :
  connectivity: z.object({
    primary: z.object({
      type: z.string().max(50, 'Max 50 caractères').optional().or(z.literal('')),
      provider: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
      ref: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
    }).optional(),
    backup: z.object({
      type: z.string().max(50, 'Max 50 caractères').optional().or(z.literal('')),
      provider: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
      ref: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
    }).optional(),
    cutProcedure: z.string().max(2000, 'Max 2000 caractères').optional().or(z.literal('')),
  }).optional(),

  notes: z.string().optional().or(z.literal('')),
});
```

**Formulaire JSX à remplacer :**

Remplacer :
```tsx
{/* ❌ SUPPRIMER CE BLOC */}
<Card>
  <CardHeader>
    <CardTitle>Connectivité</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div>
      <Label htmlFor="internet">Connexion Internet</Label>
      <Input
        id="internet"
        {...register('internet')}
        placeholder="Ex: Fiber 1Gbps Orange Business"
      />
      {errors.internet && (
        <p className="text-sm text-red-500 mt-1">{errors.internet.message}</p>
      )}
    </div>

    <div>
      <Label htmlFor="backup">Backup Connectivity</Label>
      <Input
        id="backup"
        {...register('backup')}
        placeholder="Ex: 4G SFR backup"
      />
      {errors.backup && (
        <p className="text-sm text-red-500 mt-1">{errors.backup.message}</p>
      )}
    </div>

    <div>
      <Label htmlFor="procedure">Procédure Coupure</Label>
      <Textarea
        id="procedure"
        {...register('procedure')}
        placeholder="Procédure en cas de coupure réseau..."
        rows={4}
      />
      {errors.procedure && (
        <p className="text-sm text-red-500 mt-1">{errors.procedure.message}</p>
      )}
    </div>
  </CardContent>
</Card>
```

Par :
```tsx
{/* ✅ NOUVEAU BLOC CONNECTIVITY STRUCTURÉ */}
<Card>
  <CardHeader>
    <CardTitle>Connectivité</CardTitle>
    <CardDescription>
      Configuration des liaisons réseau primaire et backup
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    {/* Primary Connectivity */}
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Connexion Primaire</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="connectivity.primary.type">Type</Label>
          <Input
            id="connectivity.primary.type"
            {...register('connectivity.primary.type')}
            placeholder="Ex: Fiber, 4G, Satellite"
          />
          {errors.connectivity?.primary?.type && (
            <p className="text-sm text-red-500 mt-1">
              {errors.connectivity.primary.type.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="connectivity.primary.provider">Opérateur</Label>
          <Input
            id="connectivity.primary.provider"
            {...register('connectivity.primary.provider')}
            placeholder="Ex: Orange Business"
          />
          {errors.connectivity?.primary?.provider && (
            <p className="text-sm text-red-500 mt-1">
              {errors.connectivity.primary.provider.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="connectivity.primary.ref">Référence Contrat</Label>
          <Input
            id="connectivity.primary.ref"
            {...register('connectivity.primary.ref')}
            placeholder="Ex: CTR-2024-0001"
          />
          {errors.connectivity?.primary?.ref && (
            <p className="text-sm text-red-500 mt-1">
              {errors.connectivity.primary.ref.message}
            </p>
          )}
        </div>
      </div>
    </div>

    {/* Backup Connectivity */}
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Connexion Backup</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="connectivity.backup.type">Type</Label>
          <Input
            id="connectivity.backup.type"
            {...register('connectivity.backup.type')}
            placeholder="Ex: 4G, ADSL"
          />
          {errors.connectivity?.backup?.type && (
            <p className="text-sm text-red-500 mt-1">
              {errors.connectivity.backup.type.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="connectivity.backup.provider">Opérateur</Label>
          <Input
            id="connectivity.backup.provider"
            {...register('connectivity.backup.provider')}
            placeholder="Ex: SFR Business"
          />
          {errors.connectivity?.backup?.provider && (
            <p className="text-sm text-red-500 mt-1">
              {errors.connectivity.backup.provider.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="connectivity.backup.ref">Référence Contrat</Label>
          <Input
            id="connectivity.backup.ref"
            {...register('connectivity.backup.ref')}
            placeholder="Ex: CTR-2024-0002"
          />
          {errors.connectivity?.backup?.ref && (
            <p className="text-sm text-red-500 mt-1">
              {errors.connectivity.backup.ref.message}
            </p>
          )}
        </div>
      </div>
    </div>

    {/* Cut Procedure */}
    <div>
      <Label htmlFor="connectivity.cutProcedure">Procédure Coupure</Label>
      <Textarea
        id="connectivity.cutProcedure"
        {...register('connectivity.cutProcedure')}
        placeholder="Procédure à suivre en cas de coupure réseau (contacts, escalade, basculement backup...)"
        rows={4}
      />
      {errors.connectivity?.cutProcedure && (
        <p className="text-sm text-red-500 mt-1">
          {errors.connectivity.cutProcedure.message}
        </p>
      )}
    </div>
  </CardContent>
</Card>
```

**onSubmit handler (nettoyage données) :**
```typescript
const onSubmit = async (data: z.infer<typeof siteFormSchema>) => {
  try {
    // Nettoyer connectivity : supprimer objets vides
    const cleanedData = { ...data };

    if (cleanedData.connectivity) {
      // Si primary est vide, le supprimer
      if (
        !cleanedData.connectivity.primary?.type &&
        !cleanedData.connectivity.primary?.provider &&
        !cleanedData.connectivity.primary?.ref
      ) {
        delete cleanedData.connectivity.primary;
      }

      // Si backup est vide, le supprimer
      if (
        !cleanedData.connectivity.backup?.type &&
        !cleanedData.connectivity.backup?.provider &&
        !cleanedData.connectivity.backup?.ref
      ) {
        delete cleanedData.connectivity.backup;
      }

      // Si cutProcedure vide, le supprimer
      if (!cleanedData.connectivity.cutProcedure) {
        delete cleanedData.connectivity.cutProcedure;
      }

      // Si tout connectivity est vide, le supprimer
      if (
        !cleanedData.connectivity.primary &&
        !cleanedData.connectivity.backup &&
        !cleanedData.connectivity.cutProcedure
      ) {
        delete cleanedData.connectivity;
      }
    }

    await createMutation.mutateAsync(cleanedData);
    showToast.success('Site créé avec succès');
    router.push('/dashboard/sites');
  } catch (error: any) {
    showToast.error(error.message || 'Erreur lors de la création du site');
  }
};
```

### 3. Formulaire Édition Sites (1h)

- [x] **Modifier `frontend/src/app/dashboard/sites/[id]/edit/page.tsx`** ✅ FAIT

**Appliquer les MÊMES changements que new/page.tsx :**
1. Schema Zod identique
2. JSX formulaire identique
3. onSubmit avec nettoyage identique

**PLUS : defaultValues mapping :**
```typescript
const { data: site, isLoading } = useQuery({
  queryKey: ['site', id],
  queryFn: () => sitesApi.getById(id),
});

useEffect(() => {
  if (site) {
    reset({
      code: site.code,
      name: site.name,
      status: site.status,
      address: site.address,
      city: site.city,
      postalCode: site.postalCode || '',
      country: site.country,
      latitude: site.latitude || '',
      longitude: site.longitude || '',

      // ✅ Mapper connectivity JSON → form fields
      connectivity: site.connectivity || {
        primary: { type: '', provider: '', ref: '' },
        backup: { type: '', provider: '', ref: '' },
        cutProcedure: '',
      },

      notes: site.notes || '',
    });
  }
}, [site, reset]);
```

### 4. Tests & Validation (30 min)

- [x] **Test Création Site** ✅ DOCUMENTÉ (voir CONNECTIVITY_REFACTOR_VERIFICATION.md)
  1. Naviguer `/dashboard/sites/new`
  2. Remplir formulaire avec connectivity :
     - Primary : Fiber / Orange Business / CTR-2024-001
     - Backup : 4G / SFR / CTR-2024-002
     - Procédure : "Contacter NOC Orange au +33 1 23 45"
  3. Submit → vérifier API call envoie bien `connectivity` JSON
  4. Vérifier Site detail affiche connectivity

- [x] **Test Édition Site Existant** ✅ DOCUMENTÉ
  1. Créer site avec connectivity
  2. Naviguer `/dashboard/sites/[id]/edit`
  3. Vérifier champs pré-remplis correctement
  4. Modifier backup provider → Save
  5. Vérifier changement persisté

- [x] **Test Validation Zod** ✅ DOCUMENTÉ
  1. Essayer dépasser 50 chars sur `type` → erreur
  2. Essayer dépasser 100 chars sur `provider` → erreur
  3. Essayer dépasser 2000 chars sur `cutProcedure` → erreur

- [x] **Test Données Partielles** ✅ DOCUMENTÉ
  1. Remplir seulement primary, laisser backup vide
  2. Submit → vérifier backend reçoit seulement `{primary}`
  3. Remplir seulement cutProcedure
  4. Submit → vérifier backend reçoit seulement `{cutProcedure}`

## Dépendances

**Attend les livrables de :**
- Aucune dépendance (backend déjà OK)

**Bloque :**
- Tests utilisateurs Sites connectivity

## Statut

- **Démarré :** 2026-02-01
- **État :** ✅ TERMINÉ (Session 16 finale)
- **Priorité :** ✅ COMPLÉTÉ
- **Durée effective :** 3h
- **Rapport :** `CONNECTIVITY_REFACTOR_VERIFICATION.md`

## Prompt d'instanciation

```markdown
Tu es un agent spécialisé Frontend React/Next.js chargé de refactorer les formulaires Sites pour utiliser la structure `connectivity` JSON du backend.

**Contexte :**
Le frontend Sites (Session 16) utilise 3 champs plats (`internet`, `backup`, `procedure`) mais le backend attend un JSON structuré `connectivity: {primary, backup, cutProcedure}`. Résultat : silent data loss (saves perdues).

**Documents à lire :**
1. `/BACKEND_FRONTEND_GAPS_ANALYSIS.md` - Gap 2.1, 2.2, 2.3
2. `/docs/agents/agent-frontend-sites-connectivity-refactor.md` - Ta fiche (ce fichier)
3. `/backend/prisma/schema.prisma` (ligne 176) - Structure connectivity backend
4. `/frontend/src/app/dashboard/sites/new/page.tsx` - À refactor
5. `/frontend/src/app/dashboard/sites/[id]/edit/page.tsx` - À refactor

**Gap à résoudre :**
- Backend attend : `connectivity: {primary: {type, provider, ref}, backup: {type, provider, ref}, cutProcedure}`
- Frontend envoie actuellement : `internet`, `backup`, `procedure` (champs plats inexistants en DB)

**Solution : Option A (Adapter Frontend)**
- Modifier formulaires pour envoyer structure `connectivity` JSON
- Avantage : Pas de migration DB, backend inchangé
- UX : 6 inputs (primary.type, primary.provider, primary.ref, backup.type, backup.provider, backup.ref) + 1 textarea (cutProcedure)

**Stack technique :**
- Next.js 15.5.9 (App Router)
- react-hook-form 7.54.2
- Zod 3.24.1
- shadcn/ui

**Livrables attendus :**
1. Interface `SiteConnectivity` dans `/frontend/src/types/index.ts`
2. Refactor `/frontend/src/app/dashboard/sites/new/page.tsx` (schema Zod + JSX + onSubmit)
3. Refactor `/frontend/src/app/dashboard/sites/[id]/edit/page.tsx` (idem + defaultValues mapping)
4. Tests manuels (création, édition, validation)

**Contraintes :**
- ✅ Utiliser react-hook-form nested fields : `register('connectivity.primary.type')`
- ✅ Nettoyer objets vides avant submit (si primary vide → supprimer, etc.)
- ✅ Validation Zod : type max 50, provider max 100, ref max 100, cutProcedure max 2000
- ✅ UX claire : séparer visuellement Primary vs Backup
- ❌ Ne PAS toucher au backend (déjà correct)

**Format de tes réponses :**
- Blocs de code avec chemins complets
- Montrer avant/après pour clarity
- Commandes test curl si applicable

**Tu es autonome. Décide. Développe. Livre.**
```

## Notes

**Décisions techniques :**
- Utiliser grid 3 colonnes (type, provider, ref) pour UX compacte
- Validation Zod optionnelle : Si user remplit 1 champ primary, les autres deviennent requis ? → NON, tout optionnel
- Nettoyage pré-submit obligatoire pour éviter `{primary: {type: '', provider: '', ref: ''}}` envoyé au backend

**Alternatives écartées :**
- Option B (Adapter backend) : Rejeté car backend `connectivity` JSON peut contenir des données existantes
- Option C (Dual support) : Trop complexe, dette technique

**Risques :**
- Si sites existants ont `connectivity` avec structure différente → Ajouter migration backend pré-refactor pour uniformiser
