# SESSION 9 - Corrections Bugs Critiques

**Date:** 2026-01-11
**Rapport de tests:** Rapport diagnostique complet Claude Extension Chrome
**Bugs critiques identifiés:** 7
**Status:** 🔴 EN COURS

---

## 📋 BUGS À CORRIGER (Priorité)

### 🔴 BUG #1: Rack Viewer Konva Crash
**Sévérité:** CRITIQUE - BLOQUANT
**Module:** `/dashboard/racks/[id]`
**Status:** 🔍 INVESTIGATION

**Symptômes:**
- Clic sur un rack → Page d'erreur "Une erreur est survenue"
- Impossible de visualiser la vue 2D Konva
- Pas d'erreur JavaScript côté client

**Hypothèses:**
1. ✅ Code RackVisualization.tsx correct (vérifié)
2. ✅ Dynamic import Konva correct (vérifié)
3. ⏳ Données rack manquantes/malformées côté API
4. ⏳ Relation rack.assets non chargée côté backend

**Tests à effectuer:**
- [ ] Tester API `/api/racks/:id` avec include assets
- [ ] Vérifier backend RacksService.findOne()
- [ ] Ajouter error boundary frontend

---

### 🔴 BUG #3: RBAC Manager Permissions
**Sévérité:** CRITIQUE - BLOQUANT
**Module:** RBAC / Auth
**Status:** ⏳ PENDING

**Symptômes:**
- Manager login OK mais dashboard affiche 0 données partout
- Expected: Manager voir au moins ses sites
- Actual: Aucune donnée retournée

**Hypothèses:**
1. Permissions RBAC mal configurées pour MANAGER role
2. Queries API filtrent incorrectement par tenant
3. Manager pas associé correctement aux sites

**Fichiers concernés:**
- `backend/src/modules/rbac/` - Policies RBAC
- `backend/src/modules/auth/guards/` - RBAC Guard
- `backend/prisma/seed.ts` - Seed data Manager

---

### 🔴 BUG #2: Session/Auth Redirects
**Sévérité:** CRITIQUE - BLOQUANT
**Module:** Auth / Navigation
**Status:** ⏳ PENDING

**Symptômes:**
- Navigation vers `/dashboard/floor-plans` → redirect `/login`
- Navigation vers `/dashboard/users` → redirect `/login`
- "Retour à l'accueil" depuis error page → logout

**Hypothèses:**
1. Routes protégées mal configurées
2. JWT expiration mal gérée
3. Middleware authentication rejette certaines routes

**Fichiers concernés:**
- `frontend/src/middleware.ts` - Route protection
- `backend/src/modules/auth/guards/` - Auth guards

---

### 🔴 BUG #4: FloorPlans Navigation
**Sévérité:** CRITIQUE
**Module:** Navigation / FloorPlans
**Status:** ⏳ PENDING

**Symptômes:**
- Clic "Plans" sidebar → URL change to `/dashboard/floor-plans` but redirects to `/login`

**Hypothèses:**
1. Route protection mal configurée
2. FloorPlans module permissions RBAC

---

### 🔴 BUG #5: Rack Data Inconsistency
**Sévérité:** CRITIQUE - DATA INTEGRITY
**Module:** Dashboard / Racks
**Status:** ⏳ PENDING

**Symptômes:**
- Dashboard: "25U / 216U utilisés"
- Racks list: Tous à 0% utilization, 0 équipements

**Hypothèses:**
1. Queries différentes entre dashboard et racks list
2. Assets pas correctement liés aux racks dans DB
3. Relation prisma rack.assets non include dans list

**Fichiers concernés:**
- `frontend/src/app/dashboard/page.tsx` - Dashboard stats
- `frontend/src/app/dashboard/racks/page.tsx` - Racks list
- `backend/src/modules/racks/racks.service.ts` - Queries

---

### ⚠️ BUG #6: Site Assets Visibility
**Sévérité:** MINEUR - DATA SYNC
**Module:** Sites Detail
**Status:** ⏳ PENDING

**Symptômes:**
- Site detail "Paris La Défense" → 0 équipements
- Assets list montre 10+ assets affectés à ce site

**Fichiers concernés:**
- `frontend/src/app/dashboard/sites/[id]/page.tsx`
- Assets tab query

---

### ⚠️ BUG #7: Mobile Responsive Design
**Sévérité:** MINEUR - UX
**Module:** Global Layout
**Status:** ⏳ PENDING

**Symptômes:**
- Mobile (375x667): Sidebar reste visible
- Pas de hamburger menu
- Layout ne s'adapte pas

**Fichiers concernés:**
- `frontend/src/components/layout/` - Layout components

---

## 🔧 CORRECTIONS EFFECTUÉES

### ✅ Bug #1: Rack Viewer Konva Crash
**Status:** EN COURS...

**Actions:**
1. [ ] Investigation API racks/:id

---

## 📊 PROGRESSION

**Total bugs:** 7
**Corrigés:** 0/7
**En cours:** 1/7 (Bug #1)
**Restants:** 6/7

**Temps estimé:** 4-6 heures

---

**Dernière mise à jour:** 2026-01-11 17:30
