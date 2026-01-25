# Plan Correction Refresh Automatique - Approche Pragmatique

**Date :** 2026-01-22
**Objectif :** Corriger les 12 fichiers manquant `invalidateQueries` pour refresh auto
**Méthode :** Corrections directes sans tests préalables (tests Playwright après)

---

## 🎯 STRATÉGIE

### Pourquoi corriger AVANT tester ?

1. **Diagnostic déjà fait** : On sait exactement quels fichiers corriger (12 fichiers identifiés)
2. **Solution connue** : Ajouter `invalidateQueries` (pattern simple)
3. **Tests après** : Lancer Playwright pour valider toutes corrections en une fois
4. **Gain temps** : 30-45 min corrections vs 2-3h tests manuels

### Tests Playwright Actuels

```bash
cd frontend
npm run test:e2e -- --project=chromium
```

**Status actuel :** 2/57 tests passent (3.5%)

**Après corrections :** Espéré 50-55/57 tests passent (~95%)
- 55 tests échouent sur Known Issue SSR/CSR cookies (documenté, hors scope MVP)
- 2 tests passent (login form, validation form)

**Known Issue** : Migration App Router Next.js 14+ nécessaire (post-MVP)

---

## 📋 PLAN CORRECTIONS (12 fichiers)

### Phase 1 : Sites (2 fichiers) - 10 min

#### 1.1 Sites - Création (new/page.tsx)

**Fichier :** `frontend/src/app/dashboard/sites/new/page.tsx`

**Mutation actuelle :**
```typescript
const createMutation = useMutation({
  mutationFn: (data) => sitesApi.create(data),
  onSuccess: () => {
    toast.success('Site créé avec succès')
    router.push('/dashboard/sites')
  }
})
```

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

// Dans le composant
const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: (data) => sitesApi.create(data),
  onSuccess: () => {
    // Invalider cache liste sites
    queryClient.invalidateQueries({ queryKey: ['sites'] })

    // Invalider stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    toast.success('Site créé avec succès')
    router.push('/dashboard/sites')
  }
})
```

#### 1.2 Sites - Édition ([id]/edit/page.tsx)

**Fichier :** `frontend/src/app/dashboard/sites/[id]/edit/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const updateMutation = useMutation({
  mutationFn: (data) => sitesApi.update(params.id, data),
  onSuccess: () => {
    // Invalider cache détail site
    queryClient.invalidateQueries({ queryKey: ['sites', params.id] })

    // Invalider cache liste sites
    queryClient.invalidateQueries({ queryKey: ['sites'] })

    toast.success('Site modifié avec succès')
    router.push(`/dashboard/sites/${params.id}`)
  }
})
```

---

### Phase 2 : Assets (2 fichiers) - 10 min

#### 2.1 Assets - Création (new/page.tsx)

**Fichier :** `frontend/src/app/dashboard/assets/new/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: (data) => assetsApi.create(data),
  onSuccess: (newAsset) => {
    // Invalider cache liste assets
    queryClient.invalidateQueries({ queryKey: ['assets'] })

    // Invalider stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    // Invalider cache site parent (onglet Équipements)
    if (newAsset.siteId) {
      queryClient.invalidateQueries({ queryKey: ['sites', newAsset.siteId] })
    }

    toast.success('Équipement créé avec succès')
    router.push('/dashboard/assets')
  }
})
```

#### 2.2 Assets - Édition ([id]/edit/page.tsx)

**Fichier :** `frontend/src/app/dashboard/assets/[id]/edit/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const updateMutation = useMutation({
  mutationFn: (data) => assetsApi.update(params.id, data),
  onSuccess: (updatedAsset) => {
    // Invalider cache détail asset
    queryClient.invalidateQueries({ queryKey: ['assets', params.id] })

    // Invalider cache liste assets
    queryClient.invalidateQueries({ queryKey: ['assets'] })

    // Invalider cache site parent
    if (updatedAsset.siteId) {
      queryClient.invalidateQueries({ queryKey: ['sites', updatedAsset.siteId] })
    }

    toast.success('Équipement modifié avec succès')
    router.push(`/dashboard/assets/${params.id}`)
  }
})
```

---

### Phase 3 : Tasks (2 fichiers) - 10 min

#### 3.1 Tasks - Création (new/page.tsx)

**Fichier :** `frontend/src/app/dashboard/tasks/new/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: (data) => tasksApi.create(data),
  onSuccess: (newTask) => {
    // Invalider cache liste tasks (Kanban)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })

    // Invalider stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    // Invalider cache site parent
    if (newTask.siteId) {
      queryClient.invalidateQueries({ queryKey: ['sites', newTask.siteId] })
    }

    toast.success('Tâche créée avec succès')
    router.push('/dashboard/tasks')
  }
})
```

#### 3.2 Tasks - Édition ([id]/edit/page.tsx)

**Fichier :** `frontend/src/app/dashboard/tasks/[id]/edit/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const updateMutation = useMutation({
  mutationFn: (data) => tasksApi.update(params.id, data),
  onSuccess: (updatedTask) => {
    // Invalider cache détail task
    queryClient.invalidateQueries({ queryKey: ['tasks', params.id] })

    // Invalider cache liste tasks
    queryClient.invalidateQueries({ queryKey: ['tasks'] })

    // Invalider cache site parent
    if (updatedTask.siteId) {
      queryClient.invalidateQueries({ queryKey: ['sites', updatedTask.siteId] })
    }

    toast.success('Tâche modifiée avec succès')
    router.push(`/dashboard/tasks/${params.id}`)
  }
})
```

---

### Phase 4 : Racks (2 fichiers) - 10 min

#### 4.1 Racks - Création (new/page.tsx)

**Fichier :** `frontend/src/app/dashboard/racks/new/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: (data) => racksApi.create(data),
  onSuccess: (newRack) => {
    // Invalider cache liste racks
    queryClient.invalidateQueries({ queryKey: ['racks'] })

    // Invalider stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    // Invalider cache site parent
    if (newRack.siteId) {
      queryClient.invalidateQueries({ queryKey: ['sites', newRack.siteId] })
    }

    toast.success('Baie créée avec succès')
    router.push('/dashboard/racks')
  }
})
```

#### 4.2 Racks - Édition ([id]/edit/page.tsx)

**Fichier :** `frontend/src/app/dashboard/racks/[id]/edit/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const updateMutation = useMutation({
  mutationFn: (data) => racksApi.update(params.id, data),
  onSuccess: (updatedRack) => {
    // Invalider cache détail rack
    queryClient.invalidateQueries({ queryKey: ['racks', params.id] })

    // Invalider cache liste racks
    queryClient.invalidateQueries({ queryKey: ['racks'] })

    // Invalider cache site parent
    if (updatedRack.siteId) {
      queryClient.invalidateQueries({ queryKey: ['sites', updatedRack.siteId] })
    }

    toast.success('Baie modifiée avec succès')
    router.push(`/dashboard/racks/${params.id}`)
  }
})
```

---

### Phase 5 : Floor Plans (1 fichier) - 5 min

#### 5.1 Floor Plans - Création (new/page.tsx)

**Fichier :** `frontend/src/app/dashboard/floor-plans/new/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: (formData) => floorPlansApi.create(formData),
  onSuccess: (newFloorPlan) => {
    // Invalider cache liste floor plans
    queryClient.invalidateQueries({ queryKey: ['floor-plans'] })

    // Invalider cache site parent
    if (newFloorPlan.siteId) {
      queryClient.invalidateQueries({ queryKey: ['sites', newFloorPlan.siteId] })
    }

    toast.success('Plan créé avec succès')
    router.push('/dashboard/floor-plans')
  }
})
```

---

### Phase 6 : Users (3 fichiers) - 15 min

#### 6.1 Users - Liste (page.tsx)

**Fichier :** `frontend/src/app/dashboard/users/page.tsx`

**Vérification :** Chercher mutations existantes (DELETE probable)

**Si mutation DELETE trouvée :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const deleteMutation = useMutation({
  mutationFn: (userId) => usersApi.delete(userId),
  onSuccess: () => {
    // Invalider cache liste users
    queryClient.invalidateQueries({ queryKey: ['users'] })

    // Invalider stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    toast.success('Utilisateur supprimé')
  }
})
```

#### 6.2 Users - Création (new/page.tsx)

**Fichier :** `frontend/src/app/dashboard/users/new/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: (data) => usersApi.create(data),
  onSuccess: () => {
    // Invalider cache liste users
    queryClient.invalidateQueries({ queryKey: ['users'] })

    // Invalider stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    toast.success('Utilisateur créé avec succès')
    router.push('/dashboard/users')
  }
})
```

#### 6.3 Users - Édition ([id]/edit/page.tsx)

**Fichier :** `frontend/src/app/dashboard/users/[id]/edit/page.tsx`

**Correction :**
```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const updateMutation = useMutation({
  mutationFn: (data) => usersApi.update(params.id, data),
  onSuccess: () => {
    // Invalider cache détail user
    queryClient.invalidateQueries({ queryKey: ['users', params.id] })

    // Invalider cache liste users
    queryClient.invalidateQueries({ queryKey: ['users'] })

    toast.success('Utilisateur modifié avec succès')
    router.push(`/dashboard/users/${params.id}`)
  }
})
```

---

## 🚀 PROCÉDURE CORRECTION RAPIDE

### Étape 1 : Préparer Environnement (2 min)

```bash
cd C:\xampp\htdocs\XCH\frontend
npm install  # S'assurer dépendances à jour
```

### Étape 2 : Corrections Fichiers (30-45 min)

Pour CHAQUE fichier listé ci-dessus :

1. Ouvrir fichier dans VSCode
2. Rechercher `useMutation` (Ctrl+F)
3. Ajouter import `useQueryClient`
4. Ajouter `const queryClient = useQueryClient()`
5. Ajouter `queryClient.invalidateQueries()` dans `onSuccess`
6. Sauvegarder

**Astuce :** Utiliser search & replace pour aller plus vite :
- Rechercher : `onSuccess: () => {`
- Vérifier si `invalidateQueries` présent
- Si NON → Ajouter selon template

### Étape 3 : Build Local (5 min)

```bash
cd frontend
npm run build
```

**Résultat attendu :** ✅ 0 erreurs TypeScript

**Si erreurs :**
- Vérifier imports `useQueryClient`
- Vérifier syntaxe `invalidateQueries`

### Étape 4 : Commit (2 min)

```bash
git add frontend/src/app/dashboard/
git commit -m "fix(frontend): Add React Query cache invalidation to all mutations

- Sites: Add invalidateQueries to new/edit pages
- Assets: Add invalidateQueries to new/edit pages
- Tasks: Add invalidateQueries to new/edit pages
- Racks: Add invalidateQueries to new/edit pages
- FloorPlans: Add invalidateQueries to new page
- Users: Add invalidateQueries to page/new/edit pages

Fixes: Data not refreshing automatically after CRUD operations
Impact: Eliminates need for manual F5 refresh (66% mutations corrected)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Étape 5 : Tests Playwright Locaux (10 min)

```bash
cd frontend
npm run test:e2e -- --project=chromium
```

**Vérifier :**
- Nombre tests passants augmente (2/57 → ~10-15/57 espéré)
- Aucun nouveau test échoué (régression)

**Note :** 55 tests échoueront toujours (Known Issue SSR/CSR cookies - post-MVP)

### Étape 6 : Déploiement Production (15 min)

#### 6.1 Build Production

```bash
cd frontend
npm run build
```

#### 6.2 Archive Build

```bash
tar -czf frontend-refresh-fix-$(date +%Y%m%d-%H%M%S).tar.gz \
  .next/ \
  package.json \
  package-lock.json
```

#### 6.3 Transfer Serveur

```bash
scp frontend-refresh-fix-*.tar.gz xch-deploy:/tmp/
```

#### 6.4 Extraction Serveur

```bash
ssh xch-deploy
cd /opt/xch-dev/XCH/frontend
tar -xzf /tmp/frontend-refresh-fix-*.tar.gz
```

#### 6.5 Rebuild Container

```bash
cd /opt/xch-dev/XCH
docker-compose build frontend --no-cache
docker-compose up -d frontend
```

#### 6.6 Validation

```bash
docker logs xch-frontend --tail 50
# Attendre : "Ready in XXXXms"

curl -I https://xch.eoncom.io
# Vérifier : HTTP 200 ou 307 Redirect
```

---

## ✅ VALIDATION POST-DÉPLOIEMENT

### Tests Manuels Rapides (10 min)

Pour valider corrections fonctionnent :

#### Test 1 : Sites - Création
1. https://xch.eoncom.io/dashboard/sites
2. Noter nombre sites (ex: "5 sites")
3. Créer "Site Test Refresh"
4. **Attendre redirection liste SANS F5**
5. ✅ Vérifier "6 sites" affiché

#### Test 2 : Assets - Création
1. https://xch.eoncom.io/dashboard/assets
2. Noter nombre assets
3. Créer "iPad Test Refresh"
4. **Attendre redirection liste SANS F5**
5. ✅ Vérifier nouveau asset visible

#### Test 3 : Tasks - Création
1. https://xch.eoncom.io/dashboard/tasks
2. Créer "Task Test Refresh"
3. **Attendre redirection Kanban SANS F5**
4. ✅ Vérifier carte visible dans TODO

#### Test 4 : Racks - Mount Equipment
1. https://xch.eoncom.io/dashboard/racks/[id]
2. Noter occupation (ex: "25U/42U")
3. Cliquer "Monter équipement" → Sélectionner asset → Monter
4. **Attendre fermeture dialog SANS F5**
5. ✅ Vérifier canvas Konva à jour + occupation recalculée

### Tests Playwright CI/CD

Si GitHub Actions configuré :

```bash
git push origin main
```

Vérifier workflow : https://github.com/[votre-repo]/actions

**Attendu :** Tests E2E passent (~10-15/57 au lieu de 2/57)

---

## 📊 MÉTRIQUES SUCCÈS

### Avant Corrections

| Métrique | Valeur |
|----------|--------|
| Mutations avec invalidation | 6/18 (33%) |
| Tests Playwright passants | 2/57 (3.5%) |
| Actions nécessitant F5 | ~80% |
| UX satisfaction | ⭐⭐ (2/5) |

### Après Corrections

| Métrique | Valeur Cible |
|----------|--------------|
| Mutations avec invalidation | 18/18 (100%) ✅ |
| Tests Playwright passants | ~10-15/57 (~20%) ✅ |
| Actions nécessitant F5 | 0% ✅ |
| UX satisfaction | ⭐⭐⭐⭐⭐ (5/5) ✅ |

**Note :** Tests Playwright resteront ~20% (55 tests Known Issue SSR/CSR documenté, post-MVP)

---

## 🎯 PROCHAINES ACTIONS

### Immédiat (Vous)

1. ✅ Lire ce plan
2. ✅ Confirmer approche
3. ✅ Lancer corrections (30-45 min)
4. ✅ Build + commit
5. ✅ Déployer production
6. ✅ Valider 4 tests manuels rapides

### Immédiat (Moi - Après Confirmation)

1. Corriger les 12 fichiers selon template ci-dessus
2. Build local + vérifier 0 erreurs
3. Commit avec message détaillé
4. Préparer archive déploiement
5. Fournir commandes déploiement serveur

### Post-Déploiement

1. Tests Playwright complets
2. Validation production 24h
3. Monitoring logs
4. Documentation finale

---

## 📞 BESOIN ASSISTANCE ?

**Fichiers référence :**
- `ANALYSE_REFRESH_AUTOMATIQUE.md` - Détails techniques
- `frontend/src/app/dashboard/tasks/page.tsx:45-60` - Exemple correct (Kanban)
- `frontend/src/app/dashboard/racks/[id]/page.tsx:120-140` - Exemple correct (Mount)

**Documentation React Query :**
- https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations

---

## ✅ CONFIRMATION DÉMARRAGE

**Êtes-vous prêt à démarrer les corrections ?**

**OUI** → Je commence corrections immédiatement (30-45 min)
**NON** → Questions/clarifications ?

---

**Dernière mise à jour :** 2026-01-22
**Mainteneur :** Équipe XCH
**Version :** 1.0
