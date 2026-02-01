# Agent Frontend Providers CRUD

## Mission
Créer module Providers CRUD complet avec 4 pages (liste, création, détail, édition) et service API.

## Contexte
Documents de référence :
- /CLAUDE.md
- /docs/status/PROJECT_STATUS.md
- /frontend/README.md
- /frontend/src/app/dashboard/sites/ (référence structure module)
- /frontend/src/app/dashboard/assets/ (référence liste avec recherche)
- /frontend/src/services/sites.ts (référence API client)
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
- [ ] Service API `frontend/src/services/providers.ts`
- [ ] Page liste `frontend/src/app/dashboard/providers/page.tsx`
- [ ] Page création `frontend/src/app/dashboard/providers/new/page.tsx`
- [ ] Page détail `frontend/src/app/dashboard/providers/[id]/page.tsx`
- [ ] Page édition `frontend/src/app/dashboard/providers/[id]/edit/page.tsx`
- [ ] Navigation sidebar mise à jour (lien Providers)
- [ ] Tests manuels CRUD complet validés
- [ ] Code review checklist OK

## Dépendances
Attend les livrables de :
- ✅ Backend API Providers (déjà prêt)
- ✅ Infrastructure Docker production (déployée)

Bloque :
- Tests E2E complets
- Livraison MVP 100%

## Statut
Démarré : [À remplir]
État : Non démarré

## Prompt d'instanciation
```markdown
# MISSION : Créer Module Providers CRUD Complet

Tu es un développeur frontend spécialisé Next.js/React/TanStack Query.

## CONTEXTE PROJET XCH

**XCH** est une application de gestion IT pour chantiers temporaires.

Le module Providers n'existe PAS encore (0%).
Ta mission : créer module COMPLET (liste, création, détail, édition, service API).

**Chemin local :** C:\xampp\htdocs\XCH

**Backend API :** Déjà déployé en production (https://xchapi.eoncom.io/api)

## DOCUMENTS À LIRE (OBLIGATOIRE)

Lis ces fichiers AVANT de coder :

1. **C:\xampp\htdocs\XCH\CLAUDE.md** - Instructions projet
2. **C:\xampp\htdocs\XCH\frontend\README.md** - Setup frontend
3. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\page.tsx** - Exemple liste avec recherche/filtres
4. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx** - Exemple formulaire création
5. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\page.tsx** - Exemple page détail
6. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\edit\page.tsx** - Exemple formulaire édition
7. **C:\xampp\htdocs\XCH\frontend\src\services\sites.ts** - Pattern API client

## STACK TECHNIQUE FRONTEND

```json
{
  "framework": "Next.js 15.1.4 (App Router)",
  "react": "19.0.0",
  "typescript": "5.7.3",
  "query": "@tanstack/react-query 5.62.14",
  "state": "zustand 5.0.3",
  "ui": "shadcn/ui + Tailwind CSS",
  "validation": "zod 3.24.1",
  "forms": "react-hook-form 7.54.2",
  "notifications": "sonner (toast)"
}
```

## FEATURE À IMPLÉMENTER

### Contexte métier

**Provider** = Fournisseur de services télécoms (ex: Orange, SFR, Bouygues).

Chaque Provider a :
- Nom (ex: "Orange Business Services")
- Type (TELECOM, INTERNET, CLOUD, HOSTING, OTHER)
- Contact (email/téléphone)
- Notes (infos complémentaires)

Les Providers seront utilisés pour :
- Lier connexions internet Sites (foreign key future)
- Gérer contrats télécoms
- Suivre incidents fournisseurs

### Entité Provider (backend)

```typescript
// backend/src/modules/providers/entities/provider.entity.ts
export class Provider {
  id: number;
  name: string;                    // Nom fournisseur
  type: ProviderType;              // Type service
  contact?: string;                // Email ou téléphone
  notes?: string;                  // Notes libres
  createdAt: Date;
  updatedAt: Date;
}

export enum ProviderType {
  TELECOM = 'TELECOM',
  INTERNET = 'INTERNET',
  CLOUD = 'CLOUD',
  HOSTING = 'HOSTING',
  OTHER = 'OTHER',
}
```

### Pages à créer

**1. Liste Providers** (`/dashboard/providers`)

- Tableau avec colonnes : Nom, Type, Contact, Actions
- Recherche par nom (debounce 300ms)
- Filtre par type (dropdown)
- Bouton "Nouveau Fournisseur"
- Actions par ligne : Voir détail, Modifier, Supprimer
- Pagination si > 50 providers

**2. Création Provider** (`/dashboard/providers/new`)

- Formulaire avec validation Zod
- Champs : name (requis), type (requis), contact (optionnel), notes (optionnel)
- Boutons : Créer / Annuler
- Redirect vers détail après création

**3. Détail Provider** (`/dashboard/providers/[id]`)

- Affichage read-only infos provider
- Boutons : Modifier, Supprimer, Retour liste
- Metadata : Créé le, Modifié le

**4. Édition Provider** (`/dashboard/providers/[id]/edit`)

- Formulaire pré-rempli
- Validation Zod identique création
- Boutons : Enregistrer / Annuler
- Redirect vers détail après modification

## BACKEND API DISPONIBLE

### Base URL

```
https://xchapi.eoncom.io/api/providers
```

### Endpoints

**1. Liste Providers**

```
GET /api/providers
Authorization: Bearer <JWT>
```

Réponse :
```json
[
  {
    "id": 1,
    "name": "Orange Business Services",
    "type": "TELECOM",
    "contact": "commercial@orange-business.com",
    "notes": "Partenaire principal télécom",
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-01-15T10:00:00Z"
  },
  {
    "id": 2,
    "name": "SFR Pro",
    "type": "INTERNET",
    "contact": "support@sfr.fr",
    "notes": null,
    "createdAt": "2026-01-20T14:30:00Z",
    "updatedAt": "2026-01-20T14:30:00Z"
  }
]
```

**2. Détail Provider**

```
GET /api/providers/:id
Authorization: Bearer <JWT>
```

Réponse :
```json
{
  "id": 1,
  "name": "Orange Business Services",
  "type": "TELECOM",
  "contact": "commercial@orange-business.com",
  "notes": "Partenaire principal télécom",
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

**3. Créer Provider**

```
POST /api/providers
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "Bouygues Telecom Entreprises",
  "type": "INTERNET",
  "contact": "entreprises@bouyguestelecom.fr",
  "notes": "Backup 4G pour chantiers"
}
```

DTO :
```typescript
export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ProviderType)
  type: 'TELECOM' | 'INTERNET' | 'CLOUD' | 'HOSTING' | 'OTHER';

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

Réponse : 201 Created + objet Provider

**4. Modifier Provider**

```
PATCH /api/providers/:id
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "contact": "new-contact@provider.com"
}
```

DTO : Tous champs optionnels (PartialType CreateProviderDto)

Réponse : 200 OK + objet Provider mis à jour

**5. Supprimer Provider**

```
DELETE /api/providers/:id
Authorization: Bearer <JWT>
```

Réponse : 204 No Content

## FICHIERS À CRÉER

### Structure arborescence

```
frontend/src/
├── services/
│   └── providers.ts                              (API client)
└── app/
    └── dashboard/
        └── providers/
            ├── page.tsx                           (Liste)
            ├── new/
            │   └── page.tsx                       (Création)
            └── [id]/
                ├── page.tsx                       (Détail)
                └── edit/
                    └── page.tsx                   (Édition)
```

### 1. frontend/src/services/providers.ts

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\services\providers.ts

**Contenu attendu :**

```typescript
// frontend/src/services/providers.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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

export interface CreateProviderDto {
  name: string;
  type: ProviderType;
  contact?: string;
  notes?: string;
}

export interface UpdateProviderDto {
  name?: string;
  type?: ProviderType;
  contact?: string;
  notes?: string;
}

// Helper : récupérer JWT token
function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

export const providersService = {
  // GET /api/providers
  getAll: async (): Promise<Provider[]> => {
    const response = await fetch(`${API_URL}/providers`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch providers');
    }

    return response.json();
  },

  // GET /api/providers/:id
  getById: async (id: number): Promise<Provider> => {
    const response = await fetch(`${API_URL}/providers/${id}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch provider');
    }

    return response.json();
  },

  // POST /api/providers
  create: async (data: CreateProviderDto): Promise<Provider> => {
    const response = await fetch(`${API_URL}/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create provider');
    }

    return response.json();
  },

  // PATCH /api/providers/:id
  update: async (id: number, data: UpdateProviderDto): Promise<Provider> => {
    const response = await fetch(`${API_URL}/providers/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update provider');
    }

    return response.json();
  },

  // DELETE /api/providers/:id
  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/providers/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete provider');
    }
  },
};
```

### 2. frontend/src/app/dashboard/providers/page.tsx

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\app\dashboard\providers\page.tsx

**Spécifications :**

- Utiliser `useQuery` pour fetch liste providers
- Table avec colonnes : Nom, Type, Contact, Actions
- Recherche par nom (state local + filter côté client)
- Filtre par type (Select shadcn/ui)
- Bouton "Nouveau Fournisseur" → `/dashboard/providers/new`
- Actions :
  - Voir (Eye icon) → `/dashboard/providers/[id]`
  - Modifier (Pencil icon) → `/dashboard/providers/[id]/edit`
  - Supprimer (Trash icon) → AlertDialog + mutation DELETE

**Pattern code (inspiré de sites/page.tsx) :**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { providersService, Provider, ProviderType } from '@/services/providers';

export default function ProvidersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProviderType | 'ALL'>('ALL');

  // Fetch providers
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: providersService.getAll,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: providersService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Fournisseur supprimé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  // Filtres client-side
  const filteredProviders = providers.filter((provider) => {
    const matchSearch = provider.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'ALL' || provider.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Fournisseurs</h1>
        <Button onClick={() => router.push('/dashboard/providers/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Fournisseur
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-4">
        <Input
          placeholder="Rechercher par nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as ProviderType | 'ALL')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem>
            <SelectItem value="TELECOM">Télécom</SelectItem>
            <SelectItem value="INTERNET">Internet</SelectItem>
            <SelectItem value="CLOUD">Cloud</SelectItem>
            <SelectItem value="HOSTING">Hébergement</SelectItem>
            <SelectItem value="OTHER">Autre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                Chargement...
              </TableCell>
            </TableRow>
          ) : filteredProviders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                Aucun fournisseur trouvé
              </TableCell>
            </TableRow>
          ) : (
            filteredProviders.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell className="font-medium">{provider.name}</TableCell>
                <TableCell>{provider.type}</TableCell>
                <TableCell>{provider.contact || '-'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/dashboard/providers/${provider.id}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/dashboard/providers/${provider.id}/edit`)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(provider.id)}
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 3. frontend/src/app/dashboard/providers/new/page.tsx

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\app\dashboard\providers\new\page.tsx

**Spécifications :**

- Formulaire react-hook-form + Zod
- Champs : name (requis), type (requis Select), contact (optionnel), notes (optionnel Textarea)
- Mutation POST /api/providers
- Redirect vers `/dashboard/providers/[id]` après succès

**Schema Zod :**

```typescript
const providerFormSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Max 100 caractères'),
  type: z.enum(['TELECOM', 'INTERNET', 'CLOUD', 'HOSTING', 'OTHER'], {
    required_error: 'Le type est requis',
  }),
  contact: z.string().max(200, 'Max 200 caractères').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Max 1000 caractères').optional().or(z.literal('')),
});
```

**Pattern mutation (inspiré de sites/new/page.tsx) :**

```typescript
const createProviderMutation = useMutation({
  mutationFn: providersService.create,
  onSuccess: (provider) => {
    queryClient.invalidateQueries({ queryKey: ['providers'] });
    toast.success('Fournisseur créé avec succès');
    router.push(`/dashboard/providers/${provider.id}`);
  },
  onError: (error: Error) => {
    toast.error(error.message || 'Erreur lors de la création');
  },
});
```

### 4. frontend/src/app/dashboard/providers/[id]/page.tsx

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\app\dashboard\providers\[id]\page.tsx

**Spécifications :**

- Fetch provider par ID avec `useQuery`
- Affichage read-only : Nom, Type, Contact, Notes, Metadata (créé/modifié)
- Boutons : Retour liste, Modifier, Supprimer
- Layout : Cards shadcn/ui

**Pattern fetch (inspiré de sites/[id]/page.tsx) :**

```typescript
const { data: provider, isLoading } = useQuery({
  queryKey: ['provider', id],
  queryFn: () => providersService.getById(Number(id)),
});
```

### 5. frontend/src/app/dashboard/providers/[id]/edit/page.tsx

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\app\dashboard\providers\[id]\edit\page.tsx

**Spécifications :**

- Fetch provider existant pour pré-remplir formulaire
- Schema Zod identique à création
- Mutation PATCH /api/providers/:id
- Redirect vers `/dashboard/providers/[id]` après succès

**DefaultValues pré-remplis :**

```typescript
const form = useForm<z.infer<typeof providerFormSchema>>({
  resolver: zodResolver(providerFormSchema),
  defaultValues: {
    name: provider.name,
    type: provider.type,
    contact: provider.contact || '',
    notes: provider.notes || '',
  },
});
```

## PATTERNS CODE À SUIVRE

### Pattern 1 : TanStack Query avec invalidateQueries

```typescript
// TOUJOURS invalider queries après mutation
const mutation = useMutation({
  mutationFn: providersService.create,
  onSuccess: (newProvider) => {
    queryClient.invalidateQueries({ queryKey: ['providers'] });
    queryClient.invalidateQueries({ queryKey: ['provider', newProvider.id] });
    toast.success('OK');
  },
});
```

### Pattern 2 : Select pour enum ProviderType

```typescript
<FormField
  control={form.control}
  name="type"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Type de service</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un type" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="TELECOM">Télécom</SelectItem>
          <SelectItem value="INTERNET">Internet</SelectItem>
          <SelectItem value="CLOUD">Cloud</SelectItem>
          <SelectItem value="HOSTING">Hébergement</SelectItem>
          <SelectItem value="OTHER">Autre</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Pattern 3 : Affichage date lisible (Détail)

```typescript
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Dans le JSX
<p>
  Créé le {format(new Date(provider.createdAt), 'PPP à HH:mm', { locale: fr })}
</p>
```

### Pattern 4 : Gestion loading states

```typescript
if (isLoading) {
  return (
    <div className="flex justify-center items-center h-96">
      <p>Chargement...</p>
    </div>
  );
}

if (!provider) {
  return (
    <div className="text-center">
      <p>Fournisseur non trouvé</p>
      <Button onClick={() => router.push('/dashboard/providers')}>
        Retour à la liste
      </Button>
    </div>
  );
}
```

## CONTRAINTES CRITIQUES

### 1. TypeScript strict (0 `any`)

```typescript
// ❌ INTERDIT
const provider: any = data;

// ✅ CORRECT
import { Provider } from '@/services/providers';
const provider: Provider = data;
```

### 2. Navigation sidebar (IMPORTANT)

**Ajouter lien Providers dans sidebar :**

Fichier : `frontend/src/components/Sidebar.tsx` (ou équivalent)

```tsx
import { Building2 } from 'lucide-react'; // Icon pour Providers

// Dans la liste navigation
<nav>
  {/* Liens existants */}
  <Link href="/dashboard/sites">Chantiers</Link>
  <Link href="/dashboard/assets">Assets</Link>
  <Link href="/dashboard/providers">  {/* NOUVEAU */}
    <Building2 className="mr-2 h-4 w-4" />
    Fournisseurs
  </Link>
  {/* ... */}
</nav>
```

### 3. Gestion erreurs 404

```typescript
// Dans page [id]
useEffect(() => {
  if (!isLoading && !provider) {
    toast.error('Fournisseur non trouvé');
    router.push('/dashboard/providers');
  }
}, [isLoading, provider, router]);
```

### 4. Validation côté client + serveur

Backend valide déjà (DTOs).
Frontend DOIT valider avec Zod avant envoi (meilleure UX).

### 5. Bouton submit disabled pendant mutation

```typescript
<Button type="submit" disabled={createProviderMutation.isPending}>
  {createProviderMutation.isPending ? 'Création...' : 'Créer le fournisseur'}
</Button>
```

## CHECKLIST LIVRABLES

Avant de marquer cette mission terminée, vérifie :

- [ ] Service API `providers.ts` créé avec 5 méthodes (getAll, getById, create, update, delete)
- [ ] Interface TypeScript `Provider` exportée
- [ ] Page liste `/dashboard/providers` : table + recherche + filtre type
- [ ] Page création `/dashboard/providers/new` : formulaire + validation Zod
- [ ] Page détail `/dashboard/providers/[id]` : affichage read-only + boutons actions
- [ ] Page édition `/dashboard/providers/[id]/edit` : formulaire pré-rempli
- [ ] Navigation sidebar inclut lien "Fournisseurs"
- [ ] Toutes mutations appellent `invalidateQueries`
- [ ] Toasts succès/erreur sur toutes actions (create, update, delete)
- [ ] AlertDialog confirmation pour suppression
- [ ] Gestion loading states (skeleton ou texte)
- [ ] Gestion erreurs 404 (provider non trouvé)
- [ ] Aucun `any` TypeScript
- [ ] Composants shadcn/ui uniquement
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

### Scénario 1 : Créer provider

1. Ouvrir http://localhost:3001/dashboard/providers
2. Cliquer "Nouveau Fournisseur"
3. **Attendu :** Formulaire création affiché
4. Remplir :
   - Nom : "Orange Business Services"
   - Type : "TELECOM"
   - Contact : "commercial@orange.fr"
   - Notes : "Partenaire principal"
5. Cliquer "Créer le fournisseur"
6. **Attendu :** Redirection vers page détail, toast succès
7. **Attendu :** URL = `/dashboard/providers/[id]` (id généré)

### Scénario 2 : Liste providers

1. Créer 3 providers différents (TELECOM, INTERNET, CLOUD)
2. Retour liste `/dashboard/providers`
3. **Attendu :** Table affiche 3 providers
4. Taper "Orange" dans recherche
5. **Attendu :** Filtrage instantané, 1 résultat
6. Sélectionner filtre type "INTERNET"
7. **Attendu :** Seuls providers type INTERNET affichés

### Scénario 3 : Voir détail provider

1. Sur liste, cliquer icône Eye (Voir)
2. **Attendu :** Page détail affichée
3. Vérifier présence :
   - Nom provider
   - Type (badge)
   - Contact
   - Notes
   - Date création
   - Date modification
   - Boutons : Retour, Modifier, Supprimer

### Scénario 4 : Modifier provider

1. Sur page détail, cliquer "Modifier"
2. **Attendu :** Formulaire édition pré-rempli
3. Modifier Contact : "new-email@provider.com"
4. Cliquer "Enregistrer les modifications"
5. **Attendu :** Redirection vers détail, toast succès
6. **Attendu :** Contact affiché = "new-email@provider.com"

### Scénario 5 : Supprimer provider

1. Sur page détail, cliquer "Supprimer"
2. **Attendu :** AlertDialog "Supprimer ce fournisseur ?"
3. Cliquer "Annuler"
4. **Attendu :** Dialog se ferme, provider reste
5. Re-cliquer "Supprimer", cliquer "Supprimer" (confirmer)
6. **Attendu :** Redirection vers liste, toast succès, provider disparu

### Scénario 6 : Validation formulaire

1. Page création, laisser "Nom" vide
2. Tenter submit
3. **Attendu :** Erreur "Le nom est requis"
4. Remplir Nom avec 150 caractères
5. **Attendu :** Erreur "Max 100 caractères"
6. Réduire à 80 caractères, laisser "Type" vide
7. **Attendu :** Erreur "Le type est requis"

### Scénario 7 : Navigation sidebar

1. Depuis n'importe quelle page dashboard
2. Vérifier sidebar contient lien "Fournisseurs" (icon Building2)
3. Cliquer lien
4. **Attendu :** Navigation vers `/dashboard/providers`

### Scénario 8 : Provider non trouvé (404)

1. Ouvrir URL `/dashboard/providers/9999` (ID inexistant)
2. **Attendu :** Toast erreur "Fournisseur non trouvé"
3. **Attendu :** Redirection automatique vers `/dashboard/providers`

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

Tester CRUD Providers sur http://localhost:3000 (build production).

## VALIDATION FINALE

Réponds à ces questions :

1. ✅ Service API `providers.ts` créé avec toutes méthodes ?
2. ✅ Page liste affiche providers avec recherche/filtre ?
3. ✅ Création provider fonctionne (validation + redirect) ?
4. ✅ Détail provider affiche toutes infos + metadata ?
5. ✅ Édition provider pré-remplit formulaire et persiste modifications ?
6. ✅ Suppression provider avec AlertDialog fonctionne ?
7. ✅ Navigation sidebar inclut lien "Fournisseurs" ?
8. ✅ Toutes mutations appellent `invalidateQueries` ?
9. ✅ Toasts affichés pour toutes actions ?
10. ✅ Build production OK sans erreurs ?
11. ✅ Code TypeScript strict (0 `any`) ?
12. ✅ Composants shadcn/ui uniquement ?

Si OUI à tout : mission accomplie ! 🎉

Sinon : corriger les points NON avant de livrer.

## AIDE & SUPPORT

**Documentation :**
- TanStack Query v5 : https://tanstack.com/query/v5/docs/react/overview
- react-hook-form : https://react-hook-form.com/get-started
- Zod : https://zod.dev/
- shadcn/ui : https://ui.shadcn.com/docs/components/form
- date-fns : https://date-fns.org/

**Fichiers exemples à COPIER-COLLER et adapter :**
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\page.tsx (liste)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx (création)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\page.tsx (détail)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\[id]\edit\page.tsx (édition)
- C:\xampp\htdocs\XCH\frontend\src\services\sites.ts (API client)

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

# Ajouter composant shadcn/ui (si manquant)
npx shadcn@latest add select
npx shadcn@latest add table
npx shadcn@latest add alert-dialog
```

**En cas de blocage :**
1. Vérifier console navigateur (F12) pour erreurs React/TS
2. Vérifier Network tab : requêtes API ont status 200/201 ?
3. Vérifier backend logs : erreur validation DTO ?
4. Tester endpoint Swagger : https://xchapi.eoncom.io/api (GET /providers)
5. Vérifier JWT token présent dans localStorage (console : `localStorage.getItem('token')`)

**Stratégie de développement recommandée :**

1. Créer `services/providers.ts` EN PREMIER (tester fetch manuellement)
2. Créer page liste (simple tableau sans filtres d'abord)
3. Créer page création (formulaire minimal)
4. Créer page détail (affichage simple)
5. Créer page édition (copier création, ajouter fetch)
6. Ajouter filtres liste (recherche + type)
7. Ajouter suppression (AlertDialog)
8. Ajouter navigation sidebar
9. Polir UI/UX (loading states, erreurs 404)
10. Tests complets

BON COURAGE ! 🚀
```

## Notes
**Patterns à suivre :**
- Structure CRUD complète : service API → liste → création → détail → édition
- TanStack Query partout (useQuery, useMutation, invalidateQueries)
- react-hook-form + Zod pour tous formulaires
- shadcn/ui composants (Table, Select, AlertDialog, Card)
- Navigation programmatique `useRouter().push()`
- Toasts Sonner pour feedback utilisateur

**Fichiers exemples à copier :**
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\ (tous fichiers, architecture identique)
- C:\xampp\htdocs\XCH\frontend\src\services\sites.ts (API client pattern exact)

**Décisions architecturales :**
- Pas de pagination côté serveur MVP (filtrage client-side suffisant < 100 providers attendus)
- Enum ProviderType stocké backend, répliqué frontend (source de vérité unique)
- Suppression provider simple (pas de soft delete MVP, pas de cascade checks)
- Contact format libre (email OU téléphone, pas de validation regex stricte pour flexibilité)
- Notes max 1000 chars (vs 2000 procedure Sites, usage différent)
