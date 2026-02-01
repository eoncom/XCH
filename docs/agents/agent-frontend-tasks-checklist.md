# Agent Frontend Tasks Checklist

## Mission
Implémenter la checklist interactive dans le module Tasks avec toggle, ajout et suppression d'items.

## Contexte
Documents de référence :
- /CLAUDE.md
- /docs/status/PROJECT_STATUS.md
- /frontend/README.md
- /frontend/src/app/dashboard/tasks/[id]/page.tsx (fichier à modifier)
- /frontend/src/services/tasks.ts (API client)
- /docs/ANALYSE_FINALISATION_PRODUCTION.md

## Stack technique
- Next.js 15 (App Router)
- React 19 + TypeScript
- TanStack Query v5 (React Query)
- Zustand (state global)
- shadcn/ui + Tailwind CSS
- Zod (validation)

## Livrables
- [ ] Checklist interactive avec toggle items
- [ ] Bouton ajout nouvel item
- [ ] Bouton suppression items
- [ ] Mutation PATCH /api/tasks/:id avec invalidateQueries
- [ ] Validation Zod sur nouveaux items
- [ ] Error handling avec toast
- [ ] Tests manuels validés
- [ ] Code review checklist OK

## Dépendances
Attend les livrables de :
- ✅ Backend API Tasks (déjà prêt)
- ✅ Infrastructure Docker production (déployée)

Bloque :
- Tests E2E complets
- Livraison MVP 100%

## Statut
Démarré : [À remplir]
État : Non démarré

## Prompt d'instanciation
```markdown
# MISSION : Implémenter Checklist Interactive Tasks

Tu es un développeur frontend spécialisé Next.js/React/TanStack Query.

## CONTEXTE PROJET XCH

**XCH** est une application de gestion IT pour chantiers temporaires.

Le module Tasks existe déjà avec affichage read-only des checklists.
Ta mission : rendre la checklist INTERACTIVE (toggle, add, delete items).

**Chemin local :** C:\xampp\htdocs\XCH

**Backend API :** Déjà déployé en production (https://xchapi.eoncom.io/api)

## DOCUMENTS À LIRE (OBLIGATOIRE)

Lis ces fichiers AVANT de coder :

1. **C:\xampp\htdocs\XCH\CLAUDE.md** - Instructions projet
2. **C:\xampp\htdocs\XCH\frontend\README.md** - Setup frontend
3. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\tasks\[id]\page.tsx** - Fichier à modifier (checklist read-only actuelle)
4. **C:\xampp\htdocs\XCH\frontend\src\services\tasks.ts** - API client Tasks
5. **C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx** - Exemple formulaire avec validation

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

### Contexte actuel

Le fichier `frontend/src/app/dashboard/tasks/[id]/page.tsx` affiche la checklist en read-only :

```typescript
{/* Checklist READ-ONLY actuelle */}
{task.checklist && task.checklist.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-sm font-medium">Checklist</h3>
    <div className="space-y-2">
      {task.checklist.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <Checkbox checked={item.checked} disabled />
          <span className={item.checked ? "line-through text-muted-foreground" : ""}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

### Objectif final

Transformer cette checklist en composant INTERACTIF :

**Fonctionnalités attendues :**

1. **Toggle item** : Cliquer sur checkbox pour marquer checked/unchecked
2. **Add item** : Bouton "+" avec input pour ajouter nouvel item
3. **Delete item** : Bouton "trash" pour supprimer item
4. **Persist backend** : Chaque action déclenche PATCH /api/tasks/:id
5. **Optimistic UI** : Affichage immédiat, rollback si erreur
6. **Toast feedback** : Succès/erreur pour chaque mutation

### UI/UX attendue

```
┌─────────────────────────────────────────┐
│ Checklist                          [+]  │ ← Bouton ajouter
├─────────────────────────────────────────┤
│ ☑ Vérifier câblage réseau      [🗑️]    │ ← Checked, hover trash
│ ☐ Installer firewall           [🗑️]    │ ← Unchecked, hover trash
│ ☐ Tester connexion internet    [🗑️]    │
│                                         │
│ [Input "Nouvelle tâche..."]     [✓]    │ ← Mode ajout (si cliqué "+")
└─────────────────────────────────────────┘
```

## BACKEND API DISPONIBLE

### Endpoint

```
PATCH /api/tasks/:id
Authorization: Bearer <JWT>
Content-Type: application/json
```

### DTO UpdateTaskDto

```typescript
// backend/src/modules/tasks/dto/update-task.dto.ts
export class UpdateTaskDto {
  title?: string;
  description?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string; // ISO-8601
  assigneeId?: number;
  siteId?: number;
  checklist?: ChecklistItem[]; // ← Voici notre cible
  ticketLink?: string;
}

export interface ChecklistItem {
  label: string;
  checked: boolean;
}
```

### Exemples requêtes

**Toggle item 1 (unchecked → checked) :**

```bash
PATCH /api/tasks/42
{
  "checklist": [
    { "label": "Vérifier câblage réseau", "checked": true },
    { "label": "Installer firewall", "checked": false },
    { "label": "Tester connexion internet", "checked": false }
  ]
}
```

**Ajouter item :**

```bash
PATCH /api/tasks/42
{
  "checklist": [
    { "label": "Vérifier câblage réseau", "checked": true },
    { "label": "Installer firewall", "checked": false },
    { "label": "Tester connexion internet", "checked": false },
    { "label": "Configurer VLAN invités", "checked": false }
  ]
}
```

**Supprimer item 2 :**

```bash
PATCH /api/tasks/42
{
  "checklist": [
    { "label": "Vérifier câblage réseau", "checked": true },
    { "label": "Tester connexion internet", "checked": false }
  ]
}
```

### Réponse

```json
{
  "id": 42,
  "title": "Installation réseau",
  "checklist": [
    { "label": "Vérifier câblage réseau", "checked": true },
    { "label": "Installer firewall", "checked": false },
    { "label": "Tester connexion internet", "checked": false }
  ],
  "updatedAt": "2026-02-01T10:30:00Z"
}
```

## FICHIERS À MODIFIER

### 1. frontend/src/app/dashboard/tasks/[id]/page.tsx

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\app\dashboard\tasks\[id]\page.tsx

**Modifications :**

1. Importer `useMutation` de TanStack Query
2. Importer `useQueryClient` pour invalidateQueries
3. Créer mutation `updateTaskChecklist`
4. Remplacer section checklist read-only par composant interactif
5. Ajouter état local pour mode "add item"
6. Handlers : `handleToggle`, `handleAdd`, `handleDelete`

### 2. frontend/src/services/tasks.ts (SI BESOIN)

**Chemin absolu :** C:\xampp\htdocs\XCH\frontend\src\services\tasks.ts

**Vérifier si méthode `updateTask` existe déjà.**

Si non, ajouter :

```typescript
export const tasksService = {
  // ... autres méthodes

  updateTask: async (id: number, data: Partial<Task>): Promise<Task> => {
    const response = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update task');
    }

    return response.json();
  },
};
```

## PATTERNS CODE À SUIVRE

### Pattern 1 : TanStack Query Mutation avec Invalidation

**Exemple (tiré de frontend/src/app/dashboard/sites/new/page.tsx) :**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function TaskDetailPage() {
  const queryClient = useQueryClient();

  // Mutation update task
  const updateTaskMutation = useMutation({
    mutationFn: (data: { id: number; checklist: ChecklistItem[] }) =>
      tasksService.updateTask(data.id, { checklist: data.checklist }),
    onSuccess: (updatedTask) => {
      // CRITIQUE : Invalider queries pour rafraîchir données
      queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Liste tasks
      toast.success('Checklist mise à jour');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur mise à jour checklist');
    },
  });

  const handleToggleItem = (index: number) => {
    if (!task) return;

    const updatedChecklist = task.checklist.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );

    updateTaskMutation.mutate({
      id: task.id,
      checklist: updatedChecklist,
    });
  };

  // ...
}
```

### Pattern 2 : État local pour mode "Add Item"

```typescript
const [isAddingItem, setIsAddingItem] = useState(false);
const [newItemLabel, setNewItemLabel] = useState('');

const handleAddItem = () => {
  if (!newItemLabel.trim() || !task) return;

  const updatedChecklist = [
    ...(task.checklist || []),
    { label: newItemLabel.trim(), checked: false },
  ];

  updateTaskMutation.mutate(
    {
      id: task.id,
      checklist: updatedChecklist,
    },
    {
      onSuccess: () => {
        setNewItemLabel('');
        setIsAddingItem(false);
      },
    }
  );
};
```

### Pattern 3 : Validation Zod sur nouvel item

```typescript
import { z } from 'zod';

const checklistItemSchema = z.object({
  label: z.string().min(1, 'Le libellé est requis').max(200, 'Max 200 caractères'),
  checked: z.boolean(),
});

const handleAddItem = () => {
  try {
    checklistItemSchema.parse({ label: newItemLabel, checked: false });

    const updatedChecklist = [
      ...(task.checklist || []),
      { label: newItemLabel.trim(), checked: false },
    ];

    updateTaskMutation.mutate({
      id: task.id,
      checklist: updatedChecklist,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      toast.error(error.errors[0].message);
    }
  }
};
```

### Pattern 4 : Bouton suppression avec confirmation

```typescript
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
import { Trash2 } from 'lucide-react';

const handleDeleteItem = (index: number) => {
  if (!task) return;

  const updatedChecklist = task.checklist.filter((_, i) => i !== index);

  updateTaskMutation.mutate({
    id: task.id,
    checklist: updatedChecklist,
  });
};

// Dans le JSX
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon">
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Supprimer cet item ?</AlertDialogTitle>
      <AlertDialogDescription>
        Cette action est irréversible.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuler</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleDeleteItem(index)}>
        Supprimer
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## CONTRAINTES CRITIQUES

### 1. TypeScript strict (pas de `any`)

```typescript
// ❌ INTERDIT
const handleToggle = (item: any) => { ... }

// ✅ CORRECT
interface ChecklistItem {
  label: string;
  checked: boolean;
}

const handleToggle = (index: number) => { ... }
```

### 2. TanStack Query : TOUJOURS invalidateQueries après mutation

```typescript
// ❌ OUBLI CRITIQUE
onSuccess: () => {
  toast.success('OK');
}

// ✅ CORRECT
onSuccess: (updatedTask) => {
  queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  toast.success('OK');
}
```

### 3. shadcn/ui composants UNIQUEMENT

```typescript
// ❌ INTERDIT
import { Checkbox } from 'antd';
<input type="checkbox" />

// ✅ CORRECT
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
```

### 4. Error handling avec toast

```typescript
// ❌ INCOMPLET
try {
  await updateTask();
} catch (error) {
  console.error(error);
}

// ✅ CORRECT
import { toast } from 'sonner';

updateTaskMutation.mutate(data, {
  onSuccess: () => toast.success('Checklist mise à jour'),
  onError: (error: Error) => toast.error(error.message),
});
```

### 5. Optimistic UI (bonus, optionnel)

```typescript
const updateTaskMutation = useMutation({
  mutationFn: tasksService.updateTask,
  onMutate: async (newData) => {
    // Annuler queries en cours
    await queryClient.cancelQueries({ queryKey: ['task', newData.id] });

    // Snapshot valeur actuelle
    const previousTask = queryClient.getQueryData(['task', newData.id]);

    // Update optimiste
    queryClient.setQueryData(['task', newData.id], (old: Task) => ({
      ...old,
      checklist: newData.checklist,
    }));

    return { previousTask };
  },
  onError: (err, newData, context) => {
    // Rollback en cas d'erreur
    queryClient.setQueryData(['task', newData.id], context.previousTask);
    toast.error('Erreur lors de la mise à jour');
  },
  onSettled: (data) => {
    queryClient.invalidateQueries({ queryKey: ['task', data.id] });
  },
});
```

## CHECKLIST LIVRABLES

Avant de marquer cette mission terminée, vérifie :

- [ ] Checkbox toggle fonctionne (checked ↔ unchecked)
- [ ] Bouton "+" affiche input pour ajouter item
- [ ] Validation Zod : label min 1 char, max 200 chars
- [ ] Bouton trash avec AlertDialog confirmation
- [ ] Mutation PATCH /api/tasks/:id appelée pour chaque action
- [ ] `invalidateQueries` sur `['task', id]` ET `['tasks']`
- [ ] Toast succès/erreur affiché pour chaque mutation
- [ ] Aucun `any` dans le code TypeScript
- [ ] Composants shadcn/ui uniquement (Checkbox, Button, Input, AlertDialog)
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

### Scénario 1 : Toggle item

1. Ouvrir http://localhost:3001/dashboard/tasks
2. Cliquer sur une tâche avec checklist (ex: "Installation réseau chantier A")
3. Page détail s'affiche avec checklist
4. Cliquer sur checkbox d'un item unchecked
5. **Attendu :** Item devient checked, ligne barrée, toast "Checklist mise à jour"
6. Recharger page (F5)
7. **Attendu :** Item reste checked (persisté backend)

### Scénario 2 : Ajouter item

1. Sur page détail task, cliquer bouton "+" à droite de "Checklist"
2. **Attendu :** Input apparaît avec bouton "✓"
3. Taper "Configurer VLAN invités"
4. Cliquer "✓"
5. **Attendu :** Nouvel item ajouté à la liste (unchecked), input disparaît, toast succès
6. Recharger page
7. **Attendu :** Nouvel item présent

### Scénario 3 : Validation ajout item

1. Cliquer "+"
2. Laisser input vide, cliquer "✓"
3. **Attendu :** Toast erreur "Le libellé est requis"
4. Taper 250 caractères, cliquer "✓"
5. **Attendu :** Toast erreur "Max 200 caractères"

### Scénario 4 : Supprimer item

1. Hover sur un item de la checklist
2. **Attendu :** Bouton trash apparaît à droite
3. Cliquer bouton trash
4. **Attendu :** AlertDialog "Supprimer cet item ?"
5. Cliquer "Annuler"
6. **Attendu :** Item reste, dialog se ferme
7. Re-cliquer trash, cliquer "Supprimer"
8. **Attendu :** Item disparaît, toast succès
9. Recharger page
10. **Attendu :** Item toujours supprimé

### Scénario 5 : Erreur backend

1. Arrêter backend : `Ctrl+C` dans terminal backend
2. Toggle un item
3. **Attendu :** Toast erreur "Failed to fetch" ou message d'erreur
4. Recharger page
5. **Attendu :** Changement non persisté (rollback)

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

Tester checklist sur http://localhost:3000 (build production).

## VALIDATION FINALE

Réponds à ces questions :

1. ✅ Toggle checkbox fonctionne et persiste backend ?
2. ✅ Ajout item avec validation Zod fonctionne ?
3. ✅ Suppression item avec confirmation fonctionne ?
4. ✅ Toutes mutations appellent `invalidateQueries` ?
5. ✅ Toasts succès/erreur affichés ?
6. ✅ Build production OK sans erreurs ?
7. ✅ Code TypeScript strict (0 `any`) ?
8. ✅ Composants shadcn/ui uniquement ?

Si OUI à tout : mission accomplie ! 🎉

Sinon : corriger les points NON avant de livrer.

## AIDE & SUPPORT

**Documentation :**
- TanStack Query v5 : https://tanstack.com/query/v5/docs/react/overview
- shadcn/ui : https://ui.shadcn.com/docs/components/checkbox
- Zod : https://zod.dev/

**Fichiers exemples à étudier :**
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx (mutation + validation)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\assets\page.tsx (liste avec state)
- C:\xampp\htdocs\XCH\frontend\src\services\sites.ts (API client pattern)

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
```

**En cas de blocage :**
1. Vérifier console navigateur (F12) pour erreurs React/JS
2. Vérifier terminal backend pour erreurs API
3. Vérifier Network tab : requête PATCH /api/tasks/:id a status 200 ?
4. Vérifier payload JSON envoyé correspond au DTO backend
5. Consulter Swagger backend : https://xchapi.eoncom.io/api

BON COURAGE ! 🚀
```

## Notes
**Patterns à suivre :**
- TanStack Query mutation avec `useMutation` + `invalidateQueries`
- État local React pour mode "add item" (`useState`)
- Validation Zod inline avant mutation
- AlertDialog shadcn/ui pour confirmations destructives

**Fichiers exemples à copier :**
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\sites\new\page.tsx (mutation pattern)
- C:\xampp\htdocs\XCH\frontend\src\app\dashboard\tasks\[id]\page.tsx (fichier cible)

**Décisions architecturales :**
- Checklist stockée en JSON backend (array ChecklistItem[])
- Pas de table dédiée checklist_items (simplicité MVP)
- Optimistic UI optionnel (bonus, pas critique MVP)
- Toast feedback obligatoire (UX claire)
