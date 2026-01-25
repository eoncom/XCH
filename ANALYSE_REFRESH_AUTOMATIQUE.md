# Analyse Refresh Automatique - React Query

**Date :** 2026-01-22
**Problème :** Données ne se rafraîchissent pas automatiquement après mutations CRUD
**Impact :** UX dégradée - utilisateur doit rafraîchir manuellement (F5)

---

## 🔍 DIAGNOSTIC

### Fichiers avec mutations (`useMutation`): 18 fichiers
### Fichiers avec invalidation cache (`invalidateQueries`): 6 fichiers

**Conclusion :** **12 fichiers manquent `invalidateQueries()` après mutations** ❌

---

## 📊 FICHIERS AVEC INVALIDATION CORRECTE ✅

Ces fichiers rafraîchissent correctement le cache :

1. ✅ `frontend/src/app/dashboard/floor-plans/[id]/page.tsx`
2. ✅ `frontend/src/app/dashboard/racks/[id]/page.tsx`
3. ✅ `frontend/src/app/dashboard/tasks/[id]/page.tsx`
4. ✅ `frontend/src/app/dashboard/tasks/page.tsx`
5. ✅ `frontend/src/app/dashboard/sites/[id]/page.tsx`
6. ✅ `frontend/src/app/dashboard/assets/[id]/page.tsx`

---

## ❌ FICHIERS SANS INVALIDATION (À CORRIGER)

Ces fichiers ont des mutations **SANS** `invalidateQueries()` :

### Sites (2 fichiers)
1. ❌ `frontend/src/app/dashboard/sites/[id]/edit/page.tsx` - Mutation UPDATE site
2. ❌ `frontend/src/app/dashboard/sites/new/page.tsx` - Mutation CREATE site

### Assets (2 fichiers)
3. ❌ `frontend/src/app/dashboard/assets/[id]/edit/page.tsx` - Mutation UPDATE asset
4. ❌ `frontend/src/app/dashboard/assets/new/page.tsx` - Mutation CREATE asset

### Tasks (2 fichiers)
5. ❌ `frontend/src/app/dashboard/tasks/[id]/edit/page.tsx` - Mutation UPDATE task
6. ❌ `frontend/src/app/dashboard/tasks/new/page.tsx` - Mutation CREATE task

### Racks (3 fichiers)
7. ❌ `frontend/src/app/dashboard/racks/[id]/edit/page.tsx` - Mutation UPDATE rack
8. ❌ `frontend/src/app/dashboard/racks/new/page.tsx` - Mutation CREATE rack

### Floor Plans (1 fichier)
9. ❌ `frontend/src/app/dashboard/floor-plans/new/page.tsx` - Mutation CREATE floor plan

### Users (3 fichiers)
10. ❌ `frontend/src/app/dashboard/users/page.tsx` - Mutation (si présente)
11. ❌ `frontend/src/app/dashboard/users/[id]/edit/page.tsx` - Mutation UPDATE user
12. ❌ `frontend/src/app/dashboard/users/new/page.tsx` - Mutation CREATE user

---

## 🛠️ SOLUTION - PATTERN CORRECT

### Exemple Mutation INCORRECTE (actuel)

```typescript
// ❌ INCORRECT - Pas d'invalidation cache
const createSiteMutation = useMutation({
  mutationFn: (data) => sitesApi.create(data),
  onSuccess: () => {
    toast.success('Site créé avec succès')
    router.push('/dashboard/sites')
  }
})
```

**Problème :** L'utilisateur revient sur `/dashboard/sites` mais la liste n'affiche pas le nouveau site (ancien cache).

### Exemple Mutation CORRECTE (à implémenter)

```typescript
// ✅ CORRECT - Invalidation cache automatique
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const createSiteMutation = useMutation({
  mutationFn: (data) => sitesApi.create(data),
  onSuccess: () => {
    // Invalider le cache de la liste sites
    queryClient.invalidateQueries({ queryKey: ['sites'] })

    toast.success('Site créé avec succès')
    router.push('/dashboard/sites')
  }
})
```

**Résultat :** Quand l'utilisateur arrive sur `/dashboard/sites`, React Query refetch automatiquement les données et affiche le nouveau site sans F5.

---

## 🎯 PLAN DE CORRECTION

### Phase 1: Corriger mutations CREATE (9 fichiers)

**Priorité Haute** - Impact utilisateur maximal

1. ✅ Ajouter `invalidateQueries(['sites'])` dans `sites/new/page.tsx`
2. ✅ Ajouter `invalidateQueries(['assets'])` dans `assets/new/page.tsx`
3. ✅ Ajouter `invalidateQueries(['tasks'])` dans `tasks/new/page.tsx`
4. ✅ Ajouter `invalidateQueries(['racks'])` dans `racks/new/page.tsx`
5. ✅ Ajouter `invalidateQueries(['floor-plans'])` dans `floor-plans/new/page.tsx`
6. ✅ Ajouter `invalidateQueries(['users'])` dans `users/new/page.tsx`

### Phase 2: Corriger mutations UPDATE (6 fichiers)

**Priorité Haute** - Impact utilisateur important

7. ✅ Ajouter `invalidateQueries(['sites', id])` dans `sites/[id]/edit/page.tsx`
8. ✅ Ajouter `invalidateQueries(['assets', id])` dans `assets/[id]/edit/page.tsx`
9. ✅ Ajouter `invalidateQueries(['tasks', id])` dans `tasks/[id]/edit/page.tsx`
10. ✅ Ajouter `invalidateQueries(['racks', id])` dans `racks/[id]/edit/page.tsx`
11. ✅ Ajouter `invalidateQueries(['users', id])` dans `users/[id]/edit/page.tsx`

### Phase 3: Vérifier mutations DELETE

**Priorité Moyenne** - Vérifier si déjà corrigé

12. ✅ Vérifier `onSuccess` dans tous composants avec bouton "Supprimer"

---

## 📝 TEMPLATE CODE À COPIER

### Pour fichiers CREATE (ex: sites/new/page.tsx)

```typescript
import { useQueryClient, useMutation } from '@tanstack/react-query'

export default function NewSitePage() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const createMutation = useMutation({
    mutationFn: (data) => sitesApi.create(data),
    onSuccess: (newSite) => {
      // Invalider cache liste
      queryClient.invalidateQueries({ queryKey: ['sites'] })

      // Optionnel: Mettre à jour cache dashboard
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast.success('Site créé avec succès')
      router.push('/dashboard/sites')
    },
    onError: (error) => {
      toast.error('Erreur lors de la création')
      console.error(error)
    }
  })

  return (
    // ... formulaire
  )
}
```

### Pour fichiers UPDATE (ex: sites/[id]/edit/page.tsx)

```typescript
import { useQueryClient, useMutation } from '@tanstack/react-query'

export default function EditSitePage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { id } = params

  const updateMutation = useMutation({
    mutationFn: (data) => sitesApi.update(id, data),
    onSuccess: (updatedSite) => {
      // Invalider cache détail
      queryClient.invalidateQueries({ queryKey: ['sites', id] })

      // Invalider cache liste
      queryClient.invalidateQueries({ queryKey: ['sites'] })

      toast.success('Site modifié avec succès')
      router.push(`/dashboard/sites/${id}`)
    },
    onError: (error) => {
      toast.error('Erreur lors de la modification')
      console.error(error)
    }
  })

  return (
    // ... formulaire
  )
}
```

### Pour fichiers DELETE (ex: sites/[id]/page.tsx)

```typescript
const deleteMutation = useMutation({
  mutationFn: () => sitesApi.delete(id),
  onSuccess: () => {
    // Invalider cache liste
    queryClient.invalidateQueries({ queryKey: ['sites'] })

    // Optionnel: Mettre à jour stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    toast.success('Site supprimé avec succès')
    router.push('/dashboard/sites')
  }
})
```

---

## 🚀 INVALIDATIONS OPTIMISÉES

### Queries à invalider par module

| Module | CREATE | UPDATE | DELETE |
|--------|--------|--------|--------|
| **Sites** | `['sites']` + `['dashboard-stats']` | `['sites']` + `['sites', id]` | `['sites']` + `['dashboard-stats']` |
| **Assets** | `['assets']` + `['dashboard-stats']` + `['sites', siteId]` | `['assets']` + `['assets', id]` + `['sites', siteId]` | `['assets']` + `['dashboard-stats']` |
| **Tasks** | `['tasks']` + `['dashboard-stats']` + `['sites', siteId]` | `['tasks']` + `['tasks', id]` | `['tasks']` + `['dashboard-stats']` |
| **Racks** | `['racks']` + `['dashboard-stats']` + `['sites', siteId]` | `['racks']` + `['racks', id]` | `['racks']` + `['dashboard-stats']` |
| **Floor Plans** | `['floor-plans']` + `['sites', siteId]` | `['floor-plans']` + `['floor-plans', id]` | `['floor-plans']` |
| **Users** | `['users']` + `['dashboard-stats']` | `['users']` + `['users', id]` | `['users']` + `['dashboard-stats']` |

**Raison :** Invalider aussi les queries parentes (sites detail, dashboard stats) pour cohérence globale.

---

## 🧪 TESTS VALIDATION

Après corrections, tester ce scénario pour CHAQUE module :

### Scénario Test CREATE

1. Aller sur liste (ex: `/dashboard/sites`)
2. Noter nombre items (ex: "5 sites")
3. Cliquer "Nouveau site" → Remplir formulaire → "Créer"
4. **Attendre redirection liste (PAS de F5)**
5. ✅ Vérifier nouveau item visible immédiatement (ex: "6 sites")

### Scénario Test UPDATE

1. Aller sur détail item (ex: `/dashboard/sites/123`)
2. Noter valeur champ (ex: "Paris La Défense")
3. Cliquer "Modifier" → Changer nom → "Enregistrer"
4. **Attendre redirection détail (PAS de F5)**
5. ✅ Vérifier nouvelle valeur affichée (ex: "Paris La Défense (Modifié)")

### Scénario Test DELETE

1. Aller sur liste (ex: `/dashboard/sites`)
2. Noter nombre items (ex: "6 sites")
3. Cliquer sur item → "Supprimer" → Confirmer
4. **Attendre redirection liste (PAS de F5)**
5. ✅ Vérifier item supprimé (ex: "5 sites")

---

## 📊 MÉTRIQUES CIBLES

Après corrections complètes :

| Métrique | Avant | Après |
|----------|-------|-------|
| **Fichiers avec mutations** | 18 | 18 |
| **Fichiers avec invalidation** | 6 | 18 |
| **Coverage invalidation** | 33% | 100% |
| **Actions nécessitant F5** | ~80% | 0% |

---

## 🔗 RÉFÉRENCES

### Documentation React Query
- [Invalidation from Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
- [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

### Code Exemples Projet
- ✅ `tasks/page.tsx` ligne 45-60 (Kanban drag & drop + invalidation)
- ✅ `racks/[id]/page.tsx` ligne 120-140 (Mount equipment + invalidation)
- ✅ `floor-plans/[id]/page.tsx` ligne 80-95 (Add pin + invalidation)

---

## ✅ CHECKLIST IMPLÉMENTATION

Pour CHAQUE fichier à corriger :

- [ ] Import `useQueryClient` depuis `@tanstack/react-query`
- [ ] Appeler `const queryClient = useQueryClient()` dans composant
- [ ] Ajouter `onSuccess` dans `useMutation` avec `queryClient.invalidateQueries()`
- [ ] Invalider query liste principale (ex: `['sites']`)
- [ ] Invalider queries parentes si applicable (ex: `['dashboard-stats']`)
- [ ] Tester manuellement : CREATE → Voir nouveau item sans F5
- [ ] Tester manuellement : UPDATE → Voir modification sans F5
- [ ] Tester manuellement : DELETE → Voir suppression sans F5
- [ ] Commit avec message : `fix(frontend): Add cache invalidation to [module] mutations`

---

## 🎯 PROCHAINES ACTIONS

### Action Immédiate

**Lancer tests Claude Chrome Extension** avec prompt créé :
```
PROMPT_TEST_COMPLET_FRONTEND.md
```

**Résultat attendu :** Rapport identifiant exactement quelles pages nécessitent F5.

### Actions Correctrices

Après rapport tests, corriger fichiers identifiés selon priorité :

1. **Priorité Haute** (blocage UX) : CREATE mutations
2. **Priorité Haute** (confusion utilisateur) : UPDATE mutations
3. **Priorité Moyenne** (moins fréquent) : DELETE mutations

### Validation Finale

Relancer tests E2E automatisés après corrections :

```bash
cd frontend
npm run test:e2e -- --project=chromium
```

**Cible :** Passer de 2/57 tests à 57/57 tests après corrections.

---

**Dernière mise à jour :** 2026-01-22
**Mainteneur :** Équipe XCH
**Version :** 1.0
