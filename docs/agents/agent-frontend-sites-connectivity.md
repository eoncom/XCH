# Agent Frontend Sites Connectivity

## Mission
Ajouter 3 champs connectivity (internet, backup, procedure) aux formulaires création/édition Sites.

## Contexte
Documents de référence :
- /CLAUDE.md
- /docs/status/PROJECT_STATUS.md
- /frontend/README.md
- /frontend/src/app/dashboard/sites/new/page.tsx (formulaire création à modifier)
- /frontend/src/app/dashboard/sites/[id]/edit/page.tsx (formulaire édition à modifier)
- /docs/ANALYSE_FINALISATION_PRODUCTION.md

## Stack technique
- Next.js 15 (App Router)
- React 19 + TypeScript
- TanStack Query v5 (React Query)
- Zustand (state global)
- shadcn/ui + Tailwind CSS
- Zod (validation)
- react-hook-form 7.54.2

## Livrables
- [ ] 3 champs ajoutés formulaire création Sites (internet, backup, procedure)
- [ ] 3 champs ajoutés formulaire édition Sites
- [ ] Validation Zod : internet/backup max 200 chars, procedure max 2000 chars
- [ ] Mutation POST/PATCH avec nouveaux champs
- [ ] invalidateQueries après mutations
- [ ] Error handling avec toast
- [ ] Tests manuels validés
- [ ] Code review checklist OK

## Dépendances
Attend les livrables de :
- ✅ Backend API Sites (déjà prêt)
- ✅ Infrastructure Docker production (déployée)

Bloque :
- Tests E2E complets
- Livraison MVP 100%

## Statut
Démarré : [À remplir]
État : Non démarré

## Prompt d'instanciation
```markdown
# MISSION : Ajouter Champs Connectivity Sites

Tu es un développeur frontend spécialisé Next.js/React/react-hook-form/Zod.

## CONTEXTE PROJET XCH

**XCH** est une application de gestion IT pour chantiers temporaires.

Le module Sites existe avec formulaires création/édition fonctionnels.
Ta mission : ajouter 3 nouveaux champs connectivity à ces formulaires.

**Chemin local :** C:\xampp\htdocs\XCH

**Backend API :** Déjà déployé en production (https://xchapi.eoncom.io/api)

## DOCUMENTS À LIRE (OBLIGATOIRE)

Lis ces fichiers AVANT de coder :

1. **C:\xampp\htdocs\XCH\CLAUDE.md** - Instructions projet
2. **C:\xampp\htdocs\XCH\frontend\README.md** - Setup frontend
3. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx** - Formulaire création à modifier
4. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\edit\page.tsx** - Formulaire édition à modifier
5. **C:\xampp\htdocs\XCH\frontend\src\services\sites.ts** - API client Sites

## STACK TECHNIQUE FRONTEND

```json
{
  "framework": "Next.js 15.1.4 (App Router)",
  "react": "19.0.0",
  "typescript": "5.7.3",
  "query": "@tanstack/react-query 5.62.14",
  "forms": "react-hook-form 7.54.2",
  "validation": "zod 3.24.1",
  "ui": "shadcn/ui + Tailwind CSS",
  "notifications": "sonner (toast)"
}
```

## FEATURE À IMPLÉMENTER

### Contexte actuel

Les formulaires Sites ont actuellement ces champs :

```typescript
// Formulaire création/édition Sites actuel
{
  name: string;           // Nom chantier
  address: string;        // Adresse complète
  latitude: number;       // Coordonnées GPS
  longitude: number;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
  clientName?: string;    // Nom client
  clientContact?: string; // Contact client
  notes?: string;         // Notes libres
  startDate?: Date;       // Date début
  endDate?: Date;         // Date fin estimée
}
```

### Nouveaux champs à ajouter

Ajoute ces 3 champs dans section "Connectivité" :

```typescript
{
  internet?: string;   // Provider internet (ex: "Orange Fibre 1Gb/s")
  backup?: string;     // Solution backup (ex: "4G Bouygues 100GB/mois")
  procedure?: string;  // Procédure activation (ex: "Appeler hotline Orange...")
}
```

### Spécifications détaillées

**1. internet (optionnel, string, max 200 chars)**

- Label : "Connexion Internet"
- Placeholder : "Ex: Orange Fibre 1Gb/s, IP fixe 192.0.2.1"
- Type : Input texte simple ligne
- Validation : Max 200 caractères

**2. backup (optionnel, string, max 200 chars)**

- Label : "Connexion Backup"
- Placeholder : "Ex: 4G Bouygues 100GB/mois, routeur Netgear LM1200"
- Type : Input texte simple ligne
- Validation : Max 200 caractères

**3. procedure (optionnel, string, max 2000 chars)**

- Label : "Procédure d'Activation"
- Placeholder : "Décrire les étapes d'activation connectivity..."
- Type : Textarea multi-lignes
- Validation : Max 2000 caractères
- Rows : 4 lignes visibles

### UI/UX attendue

Ajouter une nouvelle Card "Connectivité" APRÈS la Card "Informations client" :

```
┌──────────────────────────────────────────────┐
│ Informations client                          │
│ [Nom client]                                 │
│ [Contact client]                             │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Connectivité                            (NEW)│
│                                              │
│ Connexion Internet                           │
│ [Orange Fibre 1Gb/s, IP fixe 192.0.2.1]     │
│                                              │
│ Connexion Backup                             │
│ [4G Bouygues 100GB/mois, routeur Netgear]   │
│                                              │
│ Procédure d'Activation                       │
│ ┌──────────────────────────────────────────┐ │
│ │ 1. Appeler hotline Orange 3900          │ │
│ │ 2. Donner référence chantier            │ │
│ │ 3. Tester connexion après 2h            │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Notes                                        │
│ [...]                                        │
└──────────────────────────────────────────────┘
```

## BACKEND API DISPONIBLE

### Endpoints

**Création Site :**
```
POST /api/sites
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Modification Site :**
```
PATCH /api/sites/:id
Authorization: Bearer <JWT>
Content-Type: application/json
```

### DTO CreateSiteDto / UpdateSiteDto

```typescript
// backend/src/modules/sites/dto/create-site.dto.ts
export class CreateSiteDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsEnum(['PLANNED', 'ACTIVE', 'CLOSED'])
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientContact?: string;

  @IsOptional()
  @IsString()
  internet?: string; // ← NOUVEAU

  @IsOptional()
  @IsString()
  backup?: string; // ← NOUVEAU

  @IsOptional()
  @IsString()
  procedure?: string; // ← NOUVEAU

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// UpdateSiteDto : tous champs optionnels (PartialType)
```

### Exemple requête création

```bash
POST /api/sites
{
  "name": "Chantier Festival Rock 2026",
  "address": "Parc des Expositions, 69007 Lyon",
  "latitude": 45.7485,
  "longitude": 4.8467,
  "status": "PLANNED",
  "clientName": "Live Nation France",
  "clientContact": "contact@livenation.fr",
  "internet": "Orange Fibre 1Gb/s, IP fixe 203.0.113.42",
  "backup": "4G Bouygues 100GB/mois, routeur Netgear LM1200",
  "procedure": "1. Appeler hotline Orange 3900\n2. Donner référence chantier REF2026ROCK\n3. Tester connexion après activation (2h délai)\n4. Si échec, activer backup 4G",
  "notes": "Prévoir redondance réseau critique (live streaming)",
  "startDate": "2026-06-15T00:00:00Z",
  "endDate": "2026-06-18T23:59:59Z"
}
```

### Réponse

```json
{
  "id": 15,
  "name": "Chantier Festival Rock 2026",
  "address": "Parc des Expositions, 69007 Lyon",
  "latitude": 45.7485,
  "longitude": 4.8467,
  "status": "PLANNED",
  "clientName": "Live Nation France",
  "clientContact": "contact@livenation.fr",
  "internet": "Orange Fibre 1Gb/s, IP fixe 203.0.113.42",
  "backup": "4G Bouygues 100GB/mois, routeur Netgear LM1200",
  "procedure": "1. Appeler hotline Orange 3900\n2. Donner référence...",
  "notes": "Prévoir redondance réseau critique",
  "startDate": "2026-06-15T00:00:00Z",
  "endDate": "2026-06-18T23:59:59Z",
  "createdAt": "2026-02-01T10:00:00Z",
  "updatedAt": "2026-02-01T10:00:00Z"
}
```

## FICHIERS À MODIFIER

### 1. frontend/src/app/dashboard/sites/new/page.tsx

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx

**Modifications :**

1. **Schéma Zod :** Ajouter 3 champs au `siteFormSchema`

```typescript
const siteFormSchema = z.object({
  // ... champs existants
  clientName: z.string().optional(),
  clientContact: z.string().optional(),

  // NOUVEAUX CHAMPS
  internet: z.string().max(200, 'Max 200 caractères').optional().or(z.literal('')),
  backup: z.string().max(200, 'Max 200 caractères').optional().or(z.literal('')),
  procedure: z.string().max(2000, 'Max 2000 caractères').optional().or(z.literal('')),

  notes: z.string().optional(),
  // ...
});
```

2. **Valeurs par défaut react-hook-form :**

```typescript
const form = useForm<z.infer<typeof siteFormSchema>>({
  resolver: zodResolver(siteFormSchema),
  defaultValues: {
    // ... existants
    clientName: '',
    clientContact: '',
    internet: '',      // NOUVEAU
    backup: '',        // NOUVEAU
    procedure: '',     // NOUVEAU
    notes: '',
    // ...
  },
});
```

3. **JSX : Ajouter Card "Connectivité" :**

Insérer APRÈS la Card "Informations client" et AVANT la Card "Notes" :

```tsx
{/* Card Connectivité - NOUVELLE */}
<Card>
  <CardHeader>
    <CardTitle>Connectivité</CardTitle>
    <CardDescription>
      Informations sur les connexions internet du chantier
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Connexion Internet */}
    <FormField
      control={form.control}
      name="internet"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Connexion Internet</FormLabel>
          <FormControl>
            <Input
              placeholder="Ex: Orange Fibre 1Gb/s, IP fixe 192.0.2.1"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    {/* Connexion Backup */}
    <FormField
      control={form.control}
      name="backup"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Connexion Backup</FormLabel>
          <FormControl>
            <Input
              placeholder="Ex: 4G Bouygues 100GB/mois, routeur Netgear LM1200"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    {/* Procédure d'Activation */}
    <FormField
      control={form.control}
      name="procedure"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Procédure d&apos;Activation</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Décrire les étapes d'activation connectivity..."
              rows={4}
              {...field}
            />
          </FormControl>
          <FormDescription>
            Étapes pour activer les connexions (max 2000 caractères)
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </CardContent>
</Card>
```

4. **Imports nécessaires :**

Vérifier que `Textarea` est importé :

```typescript
import { Textarea } from '@/components/ui/textarea';
```

### 2. frontend/src/app/dashboard/sites/[id]/edit/page.tsx

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\edit\page.tsx

**Modifications IDENTIQUES au fichier new/page.tsx :**

1. Ajouter 3 champs au schéma Zod
2. Ajouter 3 champs aux defaultValues (pré-remplir avec données existantes)
3. Ajouter Card "Connectivité" avec 3 FormField
4. Importer Textarea

**Spécificité édition :** Pré-remplir valeurs depuis `site` :

```typescript
const form = useForm<z.infer<typeof siteFormSchema>>({
  resolver: zodResolver(siteFormSchema),
  defaultValues: {
    // ... existants
    clientName: site.clientName || '',
    clientContact: site.clientContact || '',
    internet: site.internet || '',      // NOUVEAU
    backup: site.backup || '',          // NOUVEAU
    procedure: site.procedure || '',    // NOUVEAU
    notes: site.notes || '',
    // ...
  },
});
```

### 3. frontend/src/services/sites.ts (SI BESOIN)

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\services\sites.ts

**Vérifier interface `Site` inclut les nouveaux champs :**

```typescript
export interface Site {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
  clientName?: string;
  clientContact?: string;
  internet?: string;    // NOUVEAU
  backup?: string;      // NOUVEAU
  procedure?: string;   // NOUVEAU
  notes?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}
```

Si l'interface n'existe pas, créer la avec TOUS les champs.

## PATTERNS CODE À SUIVRE

### Pattern 1 : Champs optionnels Zod avec empty string

```typescript
// ❌ PROBLÈME : validation échoue si champ vide
internet: z.string().max(200).optional(),

// ✅ CORRECT : accepte undefined OU empty string
internet: z.string().max(200, 'Max 200 caractères').optional().or(z.literal('')),
```

### Pattern 2 : Textarea avec rows et description

```typescript
<FormField
  control={form.control}
  name="procedure"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Procédure d&apos;Activation</FormLabel>
      <FormControl>
        <Textarea
          placeholder="Décrire les étapes..."
          rows={4}               // Hauteur visible
          className="resize-y"   // Resize vertical autorisé
          {...field}
        />
      </FormControl>
      <FormDescription>
        Max 2000 caractères
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Pattern 3 : Card avec titre et description

```typescript
<Card>
  <CardHeader>
    <CardTitle>Connectivité</CardTitle>
    <CardDescription>
      Informations sur les connexions internet du chantier
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* FormFields ici */}
  </CardContent>
</Card>
```

### Pattern 4 : Mutation avec nouveaux champs

**Le code mutation existant n'a PAS besoin de modifications !**

Les nouveaux champs seront automatiquement inclus dans `form.getValues()` :

```typescript
// Code existant (AUCUNE modification nécessaire)
const createSiteMutation = useMutation({
  mutationFn: sitesService.createSite,
  onSuccess: (site) => {
    queryClient.invalidateQueries({ queryKey: ['sites'] });
    toast.success('Chantier créé avec succès');
    router.push(`/dashboard/sites/${site.id}`);
  },
  onError: (error: Error) => {
    toast.error(error.message || 'Erreur lors de la création');
  },
});

const onSubmit = (values: z.infer<typeof siteFormSchema>) => {
  // values contient AUTOMATIQUEMENT internet, backup, procedure
  createSiteMutation.mutate(values);
};
```

## CONTRAINTES CRITIQUES

### 1. Ordre des Cards dans le formulaire

**Ordre attendu :**
1. Informations générales (nom, adresse, GPS)
2. Dates
3. Informations client (clientName, clientContact)
4. **Connectivité** ← INSÉRER ICI (NOUVEAU)
5. Notes

```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
  {/* 1. Informations générales */}
  <Card>...</Card>

  {/* 2. Dates */}
  <Card>...</Card>

  {/* 3. Informations client */}
  <Card>...</Card>

  {/* 4. Connectivité - NOUVEAU */}
  <Card>
    <CardHeader>
      <CardTitle>Connectivité</CardTitle>
      <CardDescription>...</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* 3 FormFields */}
    </CardContent>
  </Card>

  {/* 5. Notes */}
  <Card>...</Card>

  {/* Boutons submit/cancel */}
  <div className="flex justify-end gap-4">...</div>
</form>
```

### 2. Validation maximale characters

```typescript
// internet : max 200 chars
internet: z.string()
  .max(200, 'Max 200 caractères')
  .optional()
  .or(z.literal('')),

// backup : max 200 chars
backup: z.string()
  .max(200, 'Max 200 caractères')
  .optional()
  .or(z.literal('')),

// procedure : max 2000 chars
procedure: z.string()
  .max(2000, 'Max 2000 caractères')
  .optional()
  .or(z.literal('')),
```

### 3. Import Textarea shadcn/ui

```typescript
// Ajouter cet import en haut du fichier
import { Textarea } from '@/components/ui/textarea';
```

Si le composant Textarea n'existe pas :

```bash
cd C:\xampp\htdocs\XCH\frontend
npx shadcn@latest add textarea
```

### 4. Échapper apostrophes dans JSX

```tsx
// ❌ ERREUR LINT
<FormLabel>Procédure d'Activation</FormLabel>

// ✅ CORRECT
<FormLabel>Procédure d&apos;Activation</FormLabel>
```

### 5. TypeScript : Interface Site à jour

Vérifier que `frontend/src/services/sites.ts` exporte interface Site avec nouveaux champs :

```typescript
export interface Site {
  // ... champs existants
  internet?: string;
  backup?: string;
  procedure?: string;
  // ...
}
```

## CHECKLIST LIVRABLES

Avant de marquer cette mission terminée, vérifie :

- [ ] Schéma Zod updated dans `new/page.tsx` (3 champs)
- [ ] Schéma Zod updated dans `[id]/edit/page.tsx` (3 champs)
- [ ] DefaultValues includes `internet: ''`, `backup: ''`, `procedure: ''`
- [ ] Card "Connectivité" ajoutée APRÈS "Informations client"
- [ ] FormField internet : Input, placeholder OK, max 200 chars
- [ ] FormField backup : Input, placeholder OK, max 200 chars
- [ ] FormField procedure : Textarea, rows={4}, max 2000 chars
- [ ] Import Textarea shadcn/ui présent
- [ ] Interface Site includes `internet?`, `backup?`, `procedure?`
- [ ] Aucun `any` dans le code TypeScript
- [ ] Code formaté (Prettier) et lint OK (ESLint)

## TESTS MANUELS (STEP-BY-STEP)

### Prérequis

```bash
cd C:\xampp\htdocs\XCH\backend
docker-compose up -d
npm run start:dev
```

```bash
cd C:\xampp\htdocs\XCH\frontend
npm run dev
```

### Scénario 1 : Créer Site avec connectivity

1. Ouvrir http://localhost:3001/dashboard/sites
2. Cliquer "Nouveau Chantier"
3. Remplir champs obligatoires (nom, adresse, GPS, status)
4. Scroller jusqu'à Card "Connectivité"
5. **Attendu :** Card visible avec 3 champs (internet, backup, procedure)
6. Remplir :
   - Internet : "Orange Fibre 1Gb/s"
   - Backup : "4G Bouygues"
   - Procedure : "Appeler hotline\nTester connexion"
7. Cliquer "Créer le chantier"
8. **Attendu :** Redirection vers page détail, toast succès
9. Sur page détail, vérifier champs connectivity affichés

### Scénario 2 : Validation max length

1. Sur formulaire création
2. Dans champ "Internet", taper 250 caractères
3. Cliquer "Créer le chantier"
4. **Attendu :** Erreur validation "Max 200 caractères" sous champ
5. Réduire à 180 caractères
6. **Attendu :** Erreur disparaît, submit possible

### Scénario 3 : Procedure max 2000 chars

1. Dans champ "Procédure d'Activation", taper 2500 caractères
2. Tenter submit
3. **Attendu :** Erreur "Max 2000 caractères"
4. Réduire à 1800 caractères
5. **Attendu :** Submit OK

### Scénario 4 : Éditer Site et modifier connectivity

1. Ouvrir liste Sites
2. Cliquer "Modifier" sur un site existant
3. Page édition s'affiche
4. Scroller jusqu'à Card "Connectivité"
5. **Attendu :** Champs pré-remplis si valeurs existantes, sinon vides
6. Modifier "Internet" : "Orange → SFR Fibre 2Gb/s"
7. Cliquer "Enregistrer les modifications"
8. **Attendu :** Redirection, toast succès
9. Recharger page détail
10. **Attendu :** Nouvelle valeur "SFR Fibre 2Gb/s" affichée

### Scénario 5 : Champs optionnels vides

1. Créer nouveau Site
2. Remplir UNIQUEMENT champs obligatoires
3. Laisser Card "Connectivité" VIDE (3 champs)
4. Submit
5. **Attendu :** Création OK, pas d'erreur validation
6. Page détail : Card "Connectivité" masquée ou affiche "Non renseigné"

### Scénario 6 : Backend persiste données

1. Créer Site avec :
   - Internet : "Test Internet"
   - Backup : "Test Backup"
   - Procedure : "Test Procedure"
2. Ouvrir DevTools Network (F12)
3. Submit formulaire
4. Vérifier requête POST /api/sites :
   - Payload JSON contient `"internet": "Test Internet"`
   - Payload JSON contient `"backup": "Test Backup"`
   - Payload JSON contient `"procedure": "Test Procedure"`
5. Vérifier réponse 201 Created contient ces 3 champs
6. Recharger page navigateur
7. **Attendu :** Valeurs persistées visibles

## DÉPLOIEMENT PRODUCTION

Après validation tests manuels :

```bash
cd C:\xampp\htdocs\XCH\frontend
npm run build
```

**Attendu :** Build réussi sans erreurs TypeScript/ESLint.

```bash
npm run start
```

Tester formulaires Sites sur http://localhost:3000 (build production).

## VALIDATION FINALE

Réponds à ces questions :

1. ✅ Card "Connectivité" visible dans formulaire création ?
2. ✅ Card "Connectivité" visible dans formulaire édition ?
3. ✅ 3 champs présents : internet (Input), backup (Input), procedure (Textarea) ?
4. ✅ Validation Zod : internet max 200, backup max 200, procedure max 2000 ?
5. ✅ Champs optionnels (submit OK si vides) ?
6. ✅ Données envoyées au backend et persistées ?
7. ✅ Build production OK sans erreurs ?
8. ✅ Interface Site TypeScript à jour ?

Si OUI à tout : mission accomplie ! 🎉

Sinon : corriger les points NON avant de livrer.

## AIDE & SUPPORT

**Documentation :**
- react-hook-form : https://react-hook-form.com/get-started
- Zod : https://zod.dev/
- shadcn/ui Textarea : https://ui.shadcn.com/docs/components/textarea
- shadcn/ui Form : https://ui.shadcn.com/docs/components/form

**Fichiers exemples à étudier :**
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx (formulaire complet)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\edit\page.tsx (édition)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\tasks\new\page.tsx (autre exemple formulaire)

**Commandes utiles :**

```bash
# Dev server
npm run dev

# TypeScript check
npx tsc --noEmit

# Lint
npm run lint

# Format
npm run format

# Build production
npm run build

# Ajouter composant shadcn/ui
npx shadcn@latest add textarea
```

**En cas de blocage :**
1. Vérifier console navigateur (F12) pour erreurs validation Zod
2. Vérifier Network tab : requête POST/PATCH /api/sites a status 200/201 ?
3. Vérifier payload JSON envoyé contient les 3 nouveaux champs
4. Vérifier backend logs : erreur validation DTO ?
5. Consulter Swagger backend : https://xchapi.eoncom.io/api (DTO CreateSiteDto)

BON COURAGE ! 🚀
```

## Notes
**Patterns à suivre :**
- react-hook-form avec shadcn/ui Form composants (FormField, FormItem, FormControl)
- Zod validation inline avec messages d'erreur personnalisés
- Champs optionnels : `.optional().or(z.literal(''))` pour accepter empty string
- Textarea avec `rows={4}` et `className="resize-y"`

**Fichiers exemples à copier :**
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx (structure formulaire)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\edit\page.tsx (édition pattern)

**Décisions architecturales :**
- Champs connectivity optionnels (pas de migration données anciennes sites)
- Max lengths conservateurs (200 chars inputs, 2000 textarea) pour éviter payload trop lourd
- Card séparée "Connectivité" pour regroupement logique (vs disperser dans "Informations générales")
- Pas de validation format (ex: regex IP) pour flexibilité utilisateur (MVP)
