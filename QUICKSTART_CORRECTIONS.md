# QuickStart - Corrections Refresh Automatique

**Durée totale :** 45 min (corrections 30 min + déploiement 15 min)

---

## 🚀 OPTION 1 : JE CORRIGE (Recommandé - Autonome)

### Étape 1 : Lire Plan Détaillé (5 min)

Ouvrir : `PLAN_CORRECTION_REFRESH_AUTO.md`

**Contient :**
- Templates code pour 12 fichiers
- Procédure étape par étape
- Commandes déploiement

### Étape 2 : Appliquer Corrections (30 min)

Pour CHAQUE fichier (12 total) :
1. Ouvrir dans VSCode
2. Rechercher `useMutation`
3. Ajouter `import { useQueryClient } from '@tanstack/react-query'`
4. Ajouter `const queryClient = useQueryClient()`
5. Ajouter dans `onSuccess` : `queryClient.invalidateQueries({ queryKey: ['module-name'] })`
6. Sauvegarder

**Fichiers à corriger :**
- `frontend/src/app/dashboard/sites/new/page.tsx`
- `frontend/src/app/dashboard/sites/[id]/edit/page.tsx`
- `frontend/src/app/dashboard/assets/new/page.tsx`
- `frontend/src/app/dashboard/assets/[id]/edit/page.tsx`
- `frontend/src/app/dashboard/tasks/new/page.tsx`
- `frontend/src/app/dashboard/tasks/[id]/edit/page.tsx`
- `frontend/src/app/dashboard/racks/new/page.tsx`
- `frontend/src/app/dashboard/racks/[id]/edit/page.tsx`
- `frontend/src/app/dashboard/floor-plans/new/page.tsx`
- `frontend/src/app/dashboard/users/page.tsx` (si mutation)
- `frontend/src/app/dashboard/users/new/page.tsx`
- `frontend/src/app/dashboard/users/[id]/edit/page.tsx`

### Étape 3 : Build + Commit (5 min)

```bash
cd frontend
npm run build  # Vérifier 0 erreurs

git add frontend/src/app/dashboard/
git commit -m "fix(frontend): Add cache invalidation to mutations (66% corrected)"
```

### Étape 4 : Déploiement (15 min)

Suivre section "Étape 6 : Déploiement Production" dans `PLAN_CORRECTION_REFRESH_AUTO.md`

---

## 🚀 OPTION 2 : CLAUDE CORRIGE (Automatique - Plus Rapide)

### Confirmation Simple

**Répondez simplement :** "OUI, corrige les 12 fichiers"

**Je vais :**
1. ✅ Lire les 12 fichiers
2. ✅ Ajouter `invalidateQueries` selon templates
3. ✅ Build local (vérifier 0 erreurs)
4. ✅ Commit corrections
5. ✅ Préparer archive déploiement
6. ✅ Fournir commandes SSH déploiement

**Vous :** Exécuter commandes SSH (5 min)

**Durée totale :** 20 min (moi 15 min + vous 5 min)

---

## 🧪 TESTS APRÈS CORRECTIONS

### Tests Playwright Automatiques (10 min)

```bash
cd frontend
npm run test:e2e -- --project=chromium
```

**Attendu :** ~10-15/57 tests passent (amélioration de 2/57)

### Tests Manuels Rapides (5 min)

1. **Sites :** Créer site → Liste à jour SANS F5 ?
2. **Assets :** Créer asset → Liste à jour SANS F5 ?
3. **Tasks :** Créer task → Kanban à jour SANS F5 ?
4. **Racks :** Monter équipement → Canvas à jour SANS F5 ?

---

## ❓ QUELLE OPTION ?

**Option 1 (Autonome) :**
- ✅ Vous contrôlez chaque modification
- ✅ Apprentissage pattern React Query
- ⏱️ 45 min total

**Option 2 (Automatique) :**
- ✅ Corrections automatiques (moi)
- ✅ Plus rapide
- ⏱️ 20 min total

---

## 🎯 DÉMARRER MAINTENANT

**Pour Option 1 :** Ouvrir `PLAN_CORRECTION_REFRESH_AUTO.md` → Commencer Phase 1

**Pour Option 2 :** Répondre "OUI, corrige" → Je lance corrections immédiatement

---

**Quelle option choisissez-vous ?** 🚀
