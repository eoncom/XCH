# Session 18 - Préparation Tests Frontend Complets

**Date :** 2026-01-22
**Durée :** 30 min
**Focus :** Analyse problème refresh automatique + Préparation tests E2E

---

## 🎯 PROBLÈME RAPPORTÉ

**Symptôme :**
Les données ne se mettent pas à jour automatiquement après actions CRUD (Create, Update, Delete). L'utilisateur doit :
- Rafraîchir manuellement (F5)
- OU changer de page dans le menu et revenir

**Impact :** UX dégradée - sensation d'application "cassée"

---

## 🔍 DIAGNOSTIC TECHNIQUE

### Analyse Code Frontend

**Commandes exécutées :**
```bash
# Recherche mutations
grep -r "useMutation" frontend/src --include="*.ts" --include="*.tsx"
→ 18 fichiers trouvés

# Recherche invalidations cache
grep -r "invalidateQueries" frontend/src --include="*.ts" --include="*.tsx"
→ 6 fichiers trouvés
```

### Résultat Analyse

| Métrique | Valeur | Status |
|----------|--------|--------|
| Fichiers avec mutations | 18 | ✅ |
| Fichiers avec invalidation cache | 6 | ❌ |
| **Coverage invalidation** | **33%** | **❌ CRITIQUE** |
| Fichiers manquant invalidation | **12** | **❌ À CORRIGER** |

**Conclusion :** **66% des mutations ne rafraîchissent pas le cache React Query** → Cause du problème rapporté.

---

## 📄 DOCUMENTS CRÉÉS

### 1. PROMPT_TEST_COMPLET_FRONTEND.md (~800 lignes)

**Contenu :**
- Prompt complet pour Claude Chrome Extension
- Protocole test refresh automatique détaillé
- Checklist 18 pages avec tests spécifiques
- Template rapport bugs attendu

**Utilisation :**
Copier-coller dans Claude Chrome Extension pour tests automatiques complets.

### 2. ANALYSE_REFRESH_AUTOMATIQUE.md (~500 lignes)

**Contenu :**
- Diagnostic technique détaillé
- Liste 12 fichiers à corriger
- Pattern code INCORRECT vs CORRECT
- Template code à copier-coller
- Plan correction par phases

**Utilisation :**
Référence technique pour comprendre le problème et appliquer corrections.

### 3. GUIDE_TESTS_FRONTEND.md (~200 lignes)

**Contenu :**
- Guide simplifié 2 options (automatique vs manuel)
- Checklist tests condensée
- Instructions démarrage immédiat
- Template rapport à créer

**Utilisation :**
Instructions claires pour lancer les tests (automatique recommandé).

### 4. TODO.md - Mise à jour

**Ajouté :**
- Nouvelle tâche HAUTE PRIORITÉ : Tests frontend + refresh automatique
- Liste 12 fichiers à corriger
- Template correction code
- Actions étape par étape

---

## 🎯 FICHIERS À CORRIGER (12)

### Sites (2 fichiers)
1. ❌ `frontend/src/app/dashboard/sites/new/page.tsx` - Mutation CREATE
2. ❌ `frontend/src/app/dashboard/sites/[id]/edit/page.tsx` - Mutation UPDATE

### Assets (2 fichiers)
3. ❌ `frontend/src/app/dashboard/assets/new/page.tsx` - Mutation CREATE
4. ❌ `frontend/src/app/dashboard/assets/[id]/edit/page.tsx` - Mutation UPDATE

### Tasks (2 fichiers)
5. ❌ `frontend/src/app/dashboard/tasks/new/page.tsx` - Mutation CREATE
6. ❌ `frontend/src/app/dashboard/tasks/[id]/edit/page.tsx` - Mutation UPDATE

### Racks (2 fichiers)
7. ❌ `frontend/src/app/dashboard/racks/new/page.tsx` - Mutation CREATE
8. ❌ `frontend/src/app/dashboard/racks/[id]/edit/page.tsx` - Mutation UPDATE

### Floor Plans (1 fichier)
9. ❌ `frontend/src/app/dashboard/floor-plans/new/page.tsx` - Mutation CREATE

### Users (3 fichiers)
10. ❌ `frontend/src/app/dashboard/users/page.tsx` - Mutations (si présentes)
11. ❌ `frontend/src/app/dashboard/users/new/page.tsx` - Mutation CREATE
12. ❌ `frontend/src/app/dashboard/users/[id]/edit/page.tsx` - Mutation UPDATE

---

## 🛠️ CORRECTION TYPE

### Code Actuel (INCORRECT)

```typescript
// ❌ Pas d'invalidation cache
const createMutation = useMutation({
  mutationFn: (data) => sitesApi.create(data),
  onSuccess: () => {
    toast.success('Site créé')
    router.push('/dashboard/sites')
  }
})
```

**Problème :** Cache React Query pas invalidé → anciennes données affichées.

### Code Corrigé (CORRECT)

```typescript
// ✅ Invalidation cache automatique
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: (data) => sitesApi.create(data),
  onSuccess: () => {
    // Invalider cache liste
    queryClient.invalidateQueries({ queryKey: ['sites'] })

    // Optionnel: Invalider stats dashboard
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

    toast.success('Site créé')
    router.push('/dashboard/sites')
  }
})
```

**Résultat :** Quand utilisateur arrive sur `/dashboard/sites`, React Query refetch automatiquement → nouvelles données visibles SANS F5.

---

## 🚀 PROCHAINES ACTIONS

### Étape 1 : Tests E2E Automatiques (RECOMMANDÉ)

**Option A - Claude Chrome Extension (2-3h) :**
1. Ouvrir Chrome → https://xch.eoncom.io
2. Login : admin@xch.demo / admin123
3. Ouvrir extension Claude
4. Copier prompt complet depuis `PROMPT_TEST_COMPLET_FRONTEND.md`
5. Coller dans Claude → Lancer tests
6. Attendre rapport automatique avec :
   - ✅ Pages refresh auto OK
   - ❌ Pages nécessitant F5 (bugs)
   - 📸 Screenshots toutes pages
   - 🐛 Liste bugs détaillée

**Option B - Tests Manuels (3-4h) :**
1. Suivre checklist dans `GUIDE_TESTS_FRONTEND.md`
2. Tester chaque page + refresh automatique
3. Créer rapport bugs manuellement

### Étape 2 : Corrections Code

Une fois rapport reçu :

1. **Analyser bugs identifiés** (comparer avec 12 fichiers listés)
2. **Appliquer template correction** (copier-coller code corrigé)
3. **Tester en local** (`npm run build` frontend)
4. **Commit corrections** (`fix(frontend): Add cache invalidation to [module] mutations`)
5. **Déployer production** (build + transfer SSH + restart container)

### Étape 3 : Validation Finale

1. Re-tester application production
2. Vérifier refresh automatique fonctionne
3. Marquer tâche TODO.md comme complétée

---

## 📊 MÉTRIQUES ATTENDUES

### Avant Corrections

| Métrique | Valeur |
|----------|--------|
| Mutations avec invalidation | 6/18 (33%) |
| Pages nécessitant F5 | ~12/18 (66%) |
| UX satisfaction | ⭐⭐ (2/5) |

### Après Corrections

| Métrique | Valeur Cible |
|----------|--------------|
| Mutations avec invalidation | 18/18 (100%) ✅ |
| Pages nécessitant F5 | 0/18 (0%) ✅ |
| UX satisfaction | ⭐⭐⭐⭐⭐ (5/5) ✅ |

---

## 📞 SUPPORT

### Lancer Tests Automatiques (Claude Chrome)

**Fichier prompt :** `PROMPT_TEST_COMPLET_FRONTEND.md`

**Instructions simples :**
1. Ouvrir https://xch.eoncom.io
2. Extension Claude → Copier prompt
3. Lancer → Attendre rapport

### Appliquer Corrections

**Fichier référence :** `ANALYSE_REFRESH_AUTOMATIQUE.md`

**Template code :**
- Section "SOLUTION - PATTERN CORRECT"
- Template CREATE/UPDATE/DELETE

### Questions Techniques

Si besoin assistance :
- Consulter `ANALYSE_REFRESH_AUTOMATIQUE.md` (détails techniques)
- Exemples code dans projet :
  - ✅ `tasks/page.tsx` (Kanban - invalidation correcte)
  - ✅ `racks/[id]/page.tsx` (Mount equipment - invalidation correcte)

---

## ✅ RÉSUMÉ EXÉCUTIF

**Problème :** Données ne se rafraîchissent pas automatiquement (66% mutations sans invalidation cache)

**Solution :** Ajouter `queryClient.invalidateQueries()` dans 12 fichiers

**Actions immédiates :**
1. Lancer tests automatiques Claude Chrome (2-3h)
2. Analyser rapport bugs
3. Appliquer corrections code (template prêt)
4. Déployer production
5. Valider refresh automatique fonctionne

**Résultat attendu :** UX fluide, données à jour SANS F5 requis

---

**Documents créés (Session 18) :**
- ✅ `PROMPT_TEST_COMPLET_FRONTEND.md` (800 lignes)
- ✅ `ANALYSE_REFRESH_AUTOMATIQUE.md` (500 lignes)
- ✅ `GUIDE_TESTS_FRONTEND.md` (200 lignes)
- ✅ `SESSION_18_RESUME.md` (ce fichier)
- ✅ `TODO.md` (mis à jour)

**Prochaine session :** Recevoir rapport tests + Appliquer corrections

---

**Dernière mise à jour :** 2026-01-22
**Mainteneur :** Équipe XCH
**Version :** 1.0
