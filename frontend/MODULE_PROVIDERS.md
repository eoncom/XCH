# Module Providers - Documentation

**Date de création:** 2026-02-01
**Statut:** Complété à 100%

## Vue d'ensemble

Module CRUD complet pour la gestion des fournisseurs de services (Télécom, Internet, Cloud, Hébergement, etc.).

## Entité Provider

```typescript
export type ProviderType = 'TELECOM' | 'INTERNET' | 'CLOUD' | 'HOSTING' | 'OTHER';

export interface Provider {
  id: number;
  name: string;
  type: ProviderType;
  contact?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## API Backend

**Base URL:** `https://xchapi.eoncom.io/api/providers`

### Endpoints disponibles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/providers` | Liste tous les fournisseurs |
| `GET` | `/api/providers/:id` | Récupère un fournisseur par ID |
| `POST` | `/api/providers` | Crée un nouveau fournisseur |
| `PATCH` | `/api/providers/:id` | Met à jour un fournisseur |
| `DELETE` | `/api/providers/:id` | Supprime un fournisseur |

## Fichiers créés

### 1. Service API
**Fichier:** `frontend/src/lib/api/providers.ts`

Service client API avec 5 méthodes:
- `getAll()` - Récupère tous les fournisseurs
- `getById(id)` - Récupère un fournisseur par ID
- `create(data)` - Crée un nouveau fournisseur
- `update(id, data)` - Met à jour un fournisseur
- `delete(id)` - Supprime un fournisseur

### 2. Types TypeScript
**Fichier:** `frontend/src/types/index.ts`

Ajout de:
- `ProviderType` - Enum des types de fournisseurs
- `Provider` - Interface complète de l'entité

### 3. Pages

#### Liste des fournisseurs
**Fichier:** `frontend/src/app/dashboard/providers/page.tsx`

**Fonctionnalités:**
- Tableau avec colonnes: Nom, Type, Contact, Actions
- Recherche par nom ou contact (state local)
- Filtre par type (Select: ALL, TELECOM, INTERNET, CLOUD, HOSTING, OTHER)
- Bouton "Nouveau Fournisseur" → `/dashboard/providers/new`
- Actions par ligne:
  - Eye (voir détail) → `/dashboard/providers/:id`
  - Pencil (éditer) → `/dashboard/providers/:id/edit`
  - Trash (supprimer avec AlertDialog)
- Toast notifications (sonner)
- Gestion états: loading, error, empty

#### Création
**Fichier:** `frontend/src/app/dashboard/providers/new/page.tsx`

**Fonctionnalités:**
- Formulaire react-hook-form + Zod validation
- Champs:
  - `name` (requis, max 100 caractères)
  - `type` (Select requis: TELECOM, INTERNET, CLOUD, HOSTING, OTHER)
  - `contact` (optionnel, max 200 caractères)
  - `notes` (Textarea optionnel, max 1000 caractères)
- useMutation create avec invalidateQueries(['providers'])
- Redirect vers `/dashboard/providers/:id` après succès
- Toast succès/erreur

#### Détail
**Fichier:** `frontend/src/app/dashboard/providers/[id]/page.tsx`

**Fonctionnalités:**
- Affichage read-only: Nom, Type (badge coloré), Contact, Notes
- Metadata (Card séparée):
  - Créé le (format: "dd MMMM yyyy à HH:mm" avec date-fns + locale fr)
  - Modifié le (idem)
- Boutons: Retour liste, Modifier, Supprimer
- AlertDialog confirmation suppression
- Gestion 404: si provider non trouvé, toast + redirect liste

#### Édition
**Fichier:** `frontend/src/app/dashboard/providers/[id]/edit/page.tsx`

**Fonctionnalités:**
- Formulaire react-hook-form + Zod (schema identique création)
- defaultValues pré-remplis depuis useQuery provider
- useMutation update avec invalidateQueries(['provider', id], ['providers'])
- Redirect vers `/dashboard/providers/:id` après succès
- Toast succès/erreur

### 4. Composants UI créés

#### Table
**Fichier:** `frontend/src/components/ui/table.tsx`

Composant shadcn/ui pour affichage tableau (nécessaire pour la liste providers).

#### AlertDialog
**Fichier:** `frontend/src/components/ui/alert-dialog.tsx`

Composant shadcn/ui pour confirmation suppression (nécessaire pour delete).

### 5. Navigation

**Fichier:** `frontend/src/app/dashboard/layout.tsx`

Ajout du lien "Fournisseurs" dans la sidebar:
```tsx
{ name: 'Fournisseurs', href: '/dashboard/providers', icon: Building2 }
```

Import de l'icône `Building2` depuis `lucide-react`.

## Patterns appliqués

### 1. TanStack Query avec invalidateQueries

```typescript
const createMutation = useMutation({
  mutationFn: providersApi.create,
  onSuccess: (provider) => {
    queryClient.invalidateQueries({ queryKey: ['providers'] });
    queryClient.invalidateQueries({ queryKey: ['provider', provider.id] });
    toast.success('Fournisseur créé avec succès');
    router.push(`/dashboard/providers/${provider.id}`);
  },
});
```

**IMPORTANT:** Toutes les mutations (create, update, delete) appellent `invalidateQueries` pour synchroniser le cache.

### 2. Validation Zod

```typescript
const providerSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  type: z.enum(['TELECOM', 'INTERNET', 'CLOUD', 'HOSTING', 'OTHER']),
  contact: z.string().max(200, 'Le contact ne peut pas dépasser 200 caractères').optional(),
  notes: z.string().max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères').optional(),
});
```

### 3. Toast notifications (Sonner)

```typescript
import { toast } from 'sonner';

// Succès
toast.success('Fournisseur créé avec succès');

// Erreur
toast.error(`Erreur lors de la création: ${error.message}`);
```

### 4. Navigation programmatique

```typescript
import { useRouter } from 'next/navigation';

const router = useRouter();
router.push('/dashboard/providers');
```

### 5. Gestion 404

```typescript
if (!provider) {
  toast.error('Fournisseur non trouvé');
  router.push('/dashboard/providers');
  return null;
}
```

## Stack technique utilisée

- **Next.js 15.1.4** (App Router)
- **React 19.0.0**
- **TypeScript 5.7.3** (strict mode)
- **TanStack Query 5.62.14** (data fetching + cache)
- **react-hook-form 7.54.2** (formulaires)
- **Zod 3.24.1** (validation)
- **shadcn/ui** (composants UI)
- **Tailwind CSS** (styling)
- **Sonner** (toast notifications)
- **date-fns 4.1.0** (formatage dates)
- **lucide-react** (icônes)

## Tests manuels à effectuer

### 1. Liste
- [ ] Accéder à `/dashboard/providers`
- [ ] Vérifier affichage tableau (colonnes: Nom, Type, Contact, Actions)
- [ ] Tester recherche par nom
- [ ] Tester filtre par type (sélectionner TELECOM, INTERNET, etc.)
- [ ] Vérifier bouton "Nouveau Fournisseur"

### 2. Création
- [ ] Cliquer "Nouveau Fournisseur"
- [ ] Remplir formulaire (nom requis)
- [ ] Tester validation Zod (nom vide, nom trop long)
- [ ] Créer provider valide
- [ ] Vérifier toast succès
- [ ] Vérifier redirection vers page détail

### 3. Détail
- [ ] Vérifier affichage nom, type (badge), contact, notes
- [ ] Vérifier metadata (créé le, modifié le)
- [ ] Tester bouton "Modifier"
- [ ] Tester bouton "Supprimer"

### 4. Édition
- [ ] Cliquer "Modifier" depuis détail
- [ ] Vérifier formulaire pré-rempli
- [ ] Modifier nom
- [ ] Enregistrer
- [ ] Vérifier toast succès
- [ ] Vérifier redirection vers détail

### 5. Suppression
- [ ] Cliquer "Supprimer" (liste ou détail)
- [ ] Vérifier AlertDialog confirmation
- [ ] Annuler
- [ ] Cliquer "Supprimer" à nouveau
- [ ] Confirmer
- [ ] Vérifier toast succès
- [ ] Vérifier redirection liste

### 6. Navigation
- [ ] Vérifier lien "Fournisseurs" dans sidebar
- [ ] Vérifier icône Building2
- [ ] Vérifier état actif sur `/dashboard/providers`

## Dépendances backend

Le module utilise l'API backend déployée sur `https://xchapi.eoncom.io/api`.

**IMPORTANT:** Le backend doit avoir les endpoints suivants:
- `GET /api/providers` - Liste providers
- `GET /api/providers/:id` - Provider par ID
- `POST /api/providers` - Créer provider
- `PATCH /api/providers/:id` - Mettre à jour provider
- `DELETE /api/providers/:id` - Supprimer provider

## Notes techniques

### 1. ID type number
Contrairement aux autres entités (Site, Asset, etc.) qui utilisent `id: string`, les Providers utilisent `id: number` (selon les spécifications backend).

### 2. Badge colors
Les couleurs de badges sont définies avec dark mode support:
```typescript
const providerTypeColors: Record<ProviderType, string> = {
  TELECOM: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  INTERNET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOUD: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  HOSTING: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};
```

### 3. TypeScript strict
Tous les fichiers respectent TypeScript strict mode (pas de `any`).

### 4. Responsive design
Tous les composants sont responsive (mobile-first avec breakpoints md, sm, lg).

## Checklist finale

- [x] Service API providers.ts créé (5 méthodes)
- [x] Interface Provider dans types/index.ts
- [x] Page liste avec recherche + filtre type
- [x] Page création avec validation Zod
- [x] Page détail avec metadata
- [x] Page édition pré-remplie
- [x] Navigation sidebar inclut "Fournisseurs"
- [x] Composant Table créé
- [x] Composant AlertDialog créé
- [x] Toutes mutations appellent invalidateQueries
- [x] AlertDialog confirmation suppression
- [x] Toasts succès/erreur partout
- [x] Gestion loading states
- [x] Gestion erreur 404
- [x] TypeScript strict (0 `any`)
- [x] shadcn/ui composants uniquement
- [ ] Tests manuels CRUD complet validés

## Prochaines étapes

1. Démarrer le frontend: `cd frontend && npm run dev`
2. Effectuer tests manuels CRUD complet
3. Vérifier que l'API backend répond correctement
4. Tester tous les scénarios (création, édition, suppression, 404, etc.)

---

**Module Providers CRUD: COMPLET à 100%**
**Date:** 2026-02-01
**Développé par:** Agent Frontend XCH
