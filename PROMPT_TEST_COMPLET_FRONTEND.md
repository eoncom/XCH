# Prompt Tests Complets Frontend XCH - Claude Chrome Extension

**Date :** 2026-01-22
**Version :** 1.0
**Application :** XCH - https://xch.eoncom.io
**Objectif :** Tests E2E automatisés complets + validation refresh automatique

---

## 🎯 CONTEXTE TESTS

**Problème rapporté :**
Les informations affichées ne se mettent pas à jour automatiquement. L'utilisateur doit rafraîchir (F5) ou changer de page dans le menu puis revenir pour voir les nouvelles données.

**Objectifs tests :**
1. ✅ Validation fonctionnelle complète (18 pages MVP)
2. ✅ Vérification refresh automatique après mutation (CRUD)
3. ✅ Identification points de régression UX
4. ✅ Rapport détaillé avec screenshots

---

## 📋 PROMPT POUR CLAUDE CHROME EXTENSION

```
Tu es un testeur QA senior chargé de valider l'application XCH (gestion IT chantiers temporaires).

APPLICATION:
- URL: https://xch.eoncom.io
- Credentials: admin@xch.demo / admin123

MISSION:
Effectuer des tests E2E complets sur 18 pages en vérifiant SPÉCIFIQUEMENT que les données se rafraîchissent automatiquement après chaque action CRUD (Create, Read, Update, Delete).

PROTOCOLE DE TEST - REFRESH AUTOMATIQUE:
Pour CHAQUE action CRUD, tu dois:
1. Noter l'état initial des données (ex: "3 sites affichés")
2. Effectuer l'action (Create/Update/Delete)
3. **ATTENDRE 2-3 secondes** (laisser React Query invalider le cache)
4. **NE PAS RAFRAÎCHIR MANUELLEMENT (pas de F5)**
5. Vérifier si les données sont mises à jour automatiquement
6. Si NON: Noter "❌ REFRESH MANUEL REQUIS"
7. Si OUI: Noter "✅ REFRESH AUTOMATIQUE OK"

CHECKLIST COMPLÈTE:

---

## 1️⃣ DASHBOARD (/)

**Page:** https://xch.eoncom.io/dashboard

**Tests:**
- [ ] Stats affichées (total sites, assets, tasks, racks)
- [ ] Cartes métriques réactives
- [ ] Carte Leaflet interactive avec marqueurs sites
- [ ] Clustering marqueurs fonctionne
- [ ] Navigation menu latéral

**Test Refresh Automatique:**
- Créer un nouveau site via menu Sites
- Revenir au Dashboard **sans F5**
- ✅ Vérifier si "Total Sites" s'incrémente automatiquement

**Screenshot:** dashboard-overview.png

---

## 2️⃣ SITES - Liste (/dashboard/sites)

**Page:** https://xch.eoncom.io/dashboard/sites

**Tests:**
- [ ] Liste sites affichée avec données
- [ ] Recherche par nom fonctionne
- [ ] Bouton "Nouveau site" visible
- [ ] Cartes sites cliquables

**Test Refresh Automatique:**
1. Noter nombre initial de sites
2. Cliquer "Nouveau site" → Créer "Site Test Automatique"
3. **Revenir à la liste SANS F5**
4. ✅ Vérifier si nouveau site apparaît automatiquement

**Screenshot:** sites-list.png

---

## 3️⃣ SITES - Carte (/dashboard/sites?view=map)

**Page:** https://xch.eoncom.io/dashboard/sites?view=map

**Tests:**
- [ ] Carte Leaflet charge correctement
- [ ] Marqueurs sites visibles
- [ ] Popup au clic sur marqueur
- [ ] Clustering fonctionne (zoom in/out)
- [ ] Toggle Liste/Carte fonctionne

**Test Refresh Automatique:**
1. Créer nouveau site avec coordonnées GPS
2. **Revenir à la carte SANS F5**
3. ✅ Vérifier si nouveau marqueur apparaît automatiquement

**Screenshot:** sites-map.png

---

## 4️⃣ SITES - Détail (/dashboard/sites/[id])

**Page:** Cliquer sur un site existant (ex: Paris La Défense)

**Tests:**
- [ ] Informations site affichées (nom, adresse, contacts)
- [ ] Onglet "Informations" actif par défaut
- [ ] Onglet "Équipements" affiche liste assets
- [ ] Onglet "Baies" affiche liste racks
- [ ] Onglet "Tâches" affiche liste tasks
- [ ] Bouton "Modifier" visible
- [ ] Bouton "Supprimer" visible

**Test Refresh Automatique:**
1. Noter nombre d'équipements dans onglet "Équipements"
2. Aller dans Assets → Créer nouvel asset pour ce site
3. **Revenir au détail site SANS F5**
4. **Cliquer onglet "Équipements"**
5. ✅ Vérifier si nouvel équipement apparaît automatiquement

**Screenshot:** site-detail.png

---

## 5️⃣ SITES - Création (/dashboard/sites/new)

**Page:** https://xch.eoncom.io/dashboard/sites/new

**Tests:**
- [ ] Formulaire création affiché
- [ ] Champs obligatoires: Nom, Adresse
- [ ] Champs optionnels: GPS (lat/lng), Contacts, Notes
- [ ] Dropdown Status: PREPARATION, ACTIVE, CLOSED
- [ ] Bouton "Créer" actif
- [ ] Validation formulaire (champs requis)

**Test Refresh Automatique:**
1. Remplir formulaire "Site Test QA"
2. Cliquer "Créer"
3. **NE PAS rafraîchir**
4. ✅ Vérifier redirection automatique vers liste sites
5. ✅ Vérifier si nouveau site visible sans F5

**Screenshot:** site-create.png

---

## 6️⃣ SITES - Édition (/dashboard/sites/[id]/edit)

**Page:** Cliquer "Modifier" sur un site

**Tests:**
- [ ] Formulaire pré-rempli avec données existantes
- [ ] Modification nom fonctionne
- [ ] Modification status fonctionne
- [ ] Bouton "Enregistrer" actif
- [ ] Bouton "Annuler" retour détail

**Test Refresh Automatique:**
1. Modifier nom site (ex: "Paris La Défense" → "Paris La Défense (Modifié)")
2. Cliquer "Enregistrer"
3. **Revenir à la liste sites SANS F5**
4. ✅ Vérifier si nom modifié apparaît automatiquement

**Screenshot:** site-edit.png

---

## 7️⃣ ASSETS - Liste (/dashboard/assets)

**Page:** https://xch.eoncom.io/dashboard/assets

**Tests:**
- [ ] Liste équipements affichée
- [ ] Recherche par nom/modèle fonctionne
- [ ] Filtres status: IN_SERVICE, OUT_OF_SERVICE, IN_TRANSIT, STOCK, RETIRED
- [ ] Filtres type: PRINTER, IPAD, NETWORK, VISIO, OTHER
- [ ] QR code visible sur chaque carte
- [ ] Bouton "Nouvel équipement"

**Test Refresh Automatique:**
1. Noter nombre initial assets
2. Créer nouvel asset (ex: "iPad Test QA")
3. **Revenir liste assets SANS F5**
4. ✅ Vérifier si nouvel asset apparaît automatiquement

**Screenshot:** assets-list.png

---

## 8️⃣ ASSETS - Détail (/dashboard/assets/[id])

**Page:** Cliquer sur un asset

**Tests:**
- [ ] Informations asset affichées (nom, modèle, S/N, fabricant)
- [ ] QR code affiché (grand format)
- [ ] Bouton "Télécharger QR Code PNG"
- [ ] Site assigné visible
- [ ] Status badge coloré
- [ ] Bouton "Modifier"
- [ ] Bouton "Supprimer"

**Test Refresh Automatique:**
1. Modifier asset (ex: changer status IN_SERVICE → STOCK)
2. **Revenir détail asset SANS F5**
3. ✅ Vérifier si status badge se met à jour automatiquement

**Screenshot:** asset-detail.png

---

## 9️⃣ ASSETS - Scanner QR (/dashboard/assets/scan)

**Page:** https://xch.eoncom.io/dashboard/assets/scan

**Tests:**
- [ ] Page scanner charge
- [ ] Demande permission caméra (si première fois)
- [ ] Aperçu vidéo caméra visible
- [ ] Message "Scannez un QR code équipement"
- [ ] Bouton "Annuler" retour liste

**Test fonctionnel (si possible):**
- [ ] Scanner QR code depuis asset detail (screenshot QR)
- [ ] Vérifier redirection vers asset detail

**Note:** Test caméra peut échouer selon environnement (permissions navigateur)

**Screenshot:** asset-scan.png

---

## 🔟 TASKS - Kanban (/dashboard/tasks)

**Page:** https://xch.eoncom.io/dashboard/tasks

**Tests:**
- [ ] 3 colonnes: TODO, IN_PROGRESS, DONE
- [ ] Cartes tâches affichées dans colonnes
- [ ] Drag & drop fonctionne (TODO → IN_PROGRESS)
- [ ] Checklist visible sur cartes
- [ ] Bouton "Nouvelle tâche"
- [ ] Filtres priorité: LOW, MEDIUM, HIGH, URGENT

**Test Refresh Automatique:**
1. Créer nouvelle tâche "Task Test QA" (TODO)
2. **Revenir Kanban SANS F5**
3. ✅ Vérifier si nouvelle carte apparaît automatiquement dans TODO

**Test Drag & Drop + Refresh:**
1. Drag tâche TODO → IN_PROGRESS
2. **NE PAS rafraîchir**
3. ✅ Vérifier si tâche reste dans IN_PROGRESS (pas de rollback)
4. **Rafraîchir F5**
5. ✅ Vérifier si tâche toujours dans IN_PROGRESS (persisté backend)

**Screenshot:** tasks-kanban.png

---

## 1️⃣1️⃣ TASKS - Détail (/dashboard/tasks/[id])

**Page:** Cliquer sur une tâche Kanban

**Tests:**
- [ ] Informations tâche affichées (titre, description, status)
- [ ] Checklist items affichés
- [ ] Toggle checkbox fonctionne
- [ ] Bouton "Ajouter item checklist"
- [ ] Bouton "Modifier"
- [ ] Bouton "Supprimer"
- [ ] Site assigné visible
- [ ] Priorité badge coloré

**Test Refresh Automatique - Checklist:**
1. Cocher 1 item checklist
2. **Revenir Kanban SANS F5**
3. **Rouvrir détail tâche SANS F5**
4. ✅ Vérifier si checkbox reste cochée

**Screenshot:** task-detail.png

---

## 1️⃣2️⃣ RACKS - Liste (/dashboard/racks)

**Page:** https://xch.eoncom.io/dashboard/racks

**Tests:**
- [ ] Liste baies affichée
- [ ] Filtres par site
- [ ] Filtres status: IN_SERVICE, OUT_OF_SERVICE, PREPARATION
- [ ] Informations baie: Nom, Hauteur (U), Occupation (U/%)
- [ ] Bouton "Nouvelle baie"
- [ ] Cartes baies cliquables

**Test Refresh Automatique:**
1. Créer nouvelle baie "RACK-TEST-42U" (42U)
2. **Revenir liste racks SANS F5**
3. ✅ Vérifier si nouvelle baie apparaît automatiquement

**Screenshot:** racks-list.png

---

## 1️⃣3️⃣ RACKS - Viewer 2D Konva (/dashboard/racks/[id])

**Page:** Cliquer sur une baie (ex: RACK-A1)

**Tests:**
- [ ] Canvas Konva charge sans erreur
- [ ] Visualisation 2D baie (grille U)
- [ ] Équipements montés affichés (rectangles colorés)
- [ ] Positions U affichées (1U, 2U, etc.)
- [ ] Calcul occupation affiché (ex: "25U/42U utilisés - 59%")
- [ ] Bouton "Monter équipement"
- [ ] Bouton "Modifier baie"

**Test Refresh Automatique - Mount Equipment:**
1. Noter occupation actuelle (ex: "25U/42U")
2. Cliquer "Monter équipement"
3. Sélectionner asset disponible (STOCK) + position U
4. Cliquer "Monter"
5. **NE PAS rafraîchir**
6. ✅ Vérifier si:
   - Canvas Konva se met à jour automatiquement
   - Nouvel équipement apparaît visuellement
   - Occupation recalculée (ex: "27U/42U")

**Screenshot:** rack-viewer.png

---

## 1️⃣4️⃣ FLOOR PLANS - Liste (/dashboard/floor-plans)

**Page:** https://xch.eoncom.io/dashboard/floor-plans

**Tests:**
- [ ] Liste plans d'étage affichée
- [ ] Filtres par site
- [ ] Miniatures plans visibles (si uploads)
- [ ] Bouton "Nouveau plan"
- [ ] Cartes plans cliquables

**Test Refresh Automatique:**
1. Créer nouveau plan (upload PNG/PDF)
2. **Revenir liste plans SANS F5**
3. ✅ Vérifier si nouveau plan apparaît automatiquement

**Screenshot:** floorplans-list.png

---

## 1️⃣5️⃣ FLOOR PLANS - Upload (/dashboard/floor-plans/new)

**Page:** https://xch.eoncom.io/dashboard/floor-plans/new

**Tests:**
- [ ] Formulaire upload affiché
- [ ] Input file accepte: PDF, PNG, JPG
- [ ] Sélection site obligatoire
- [ ] Champ titre obligatoire
- [ ] Preview fichier après sélection
- [ ] Bouton "Créer plan"

**Test Upload + Refresh:**
1. Upload fichier PNG (ex: plan générique)
2. Remplir titre "Plan Test QA"
3. Sélectionner site
4. Cliquer "Créer plan"
5. **Revenir liste SANS F5**
6. ✅ Vérifier si plan uploadé apparaît automatiquement

**Screenshot:** floorplan-upload.png

---

## 1️⃣6️⃣ FLOOR PLANS - Viewer Konva (/dashboard/floor-plans/[id])

**Page:** Cliquer sur un plan d'étage

**Tests:**
- [ ] Canvas Konva charge sans erreur
- [ ] Image plan affichée (zoom/pan fonctionnent)
- [ ] Pins éditables (drag & drop)
- [ ] 4 types pins: EQUIPMENT, NETWORK, ALERT, INFO
- [ ] Bouton "Ajouter pin"
- [ ] Bouton "Télécharger fichier original"
- [ ] Liste pins affichée (sidebar)

**Test Refresh Automatique - Pins:**
1. Ajouter pin EQUIPMENT à position (x, y)
2. **NE PAS rafraîchir**
3. ✅ Vérifier si pin apparaît immédiatement sur canvas
4. **Rafraîchir F5**
5. ✅ Vérifier si pin toujours présent (persisté backend)

**Screenshot:** floorplan-viewer.png

---

## 1️⃣7️⃣ USERS - Liste (/dashboard/users)

**Page:** https://xch.eoncom.io/dashboard/users

**Tests:**
- [ ] Liste utilisateurs affichée
- [ ] Statistiques (total users, par rôle)
- [ ] Badges rôles colorés: ADMIN, MANAGER, TECHNICIEN, VIEWER
- [ ] Informations: Nom, Email, Rôle, Status
- [ ] Filtres rôle fonctionne
- [ ] Bouton "Nouvel utilisateur" (si permissions Admin)

**Test Permissions RBAC:**
- Tester avec credentials différents:
  - admin@xch.demo / admin123 → Accès complet ✅
  - manager@xch.demo / manager123 → Accès lecture/écriture limité
  - viewer@xch.demo / viewer123 → Accès lecture seule

**Screenshot:** users-list.png

---

## 1️⃣8️⃣ SETTINGS - Profil (/dashboard/settings)

**Page:** https://xch.eoncom.io/dashboard/settings

**Tests:**
- [ ] Onglet "Profil" actif par défaut
- [ ] Informations utilisateur affichées (nom, email)
- [ ] Formulaire édition profil
- [ ] Onglet "Intégrations" accessible
- [ ] Configuration NetBox (READ-ONLY)
- [ ] Configuration Uptime Kuma (READ-ONLY)

**Test Refresh Automatique - Profil:**
1. Modifier nom utilisateur
2. Cliquer "Enregistrer"
3. **Aller au menu autre page SANS F5**
4. **Revenir Settings SANS F5**
5. ✅ Vérifier si nom modifié persiste

**Screenshot:** settings-profile.png

---

## 📊 RAPPORT FINAL ATTENDU

À la fin des tests, génère un rapport Markdown avec:

### Structure Rapport:

```markdown
# Rapport Tests E2E XCH - [DATE]

## Résumé Exécutif

- **Pages testées:** X/18
- **Tests passants:** X/Y
- **Tests échouants:** X/Y
- **Bugs critiques:** X

## 🔄 Analyse Refresh Automatique

### ✅ Refresh Automatique OK (Pages):
- Dashboard: ✅
- Sites Liste: ✅
- ...

### ❌ Refresh Manuel Requis (Pages):
- Assets Liste: ❌ (F5 requis après création)
- ...

## 🐛 Bugs Identifiés

### Bug #1: [Titre]
**Sévérité:** Critique/Majeur/Mineur
**Page:** [URL]
**Reproduction:**
1. ...
2. ...
**Comportement attendu:** ...
**Comportement observé:** ...
**Screenshot:** [nom fichier]

## 📸 Screenshots

[Tous screenshots attachés]

## ✅ Recommandations

1. **Priorité Haute:** Implémenter invalidation cache React Query après toutes mutations
2. **Priorité Moyenne:** Ajouter loading states visuels
3. **Priorité Basse:** ...

```

---

## 🎯 CHECKLIST TECHNIQUE - REFRESH AUTOMATIQUE

Pour identifier les problèmes de refresh, vérifie dans DevTools:

### Console Browser:
- Rechercher erreurs React Query
- Vérifier `queryClient.invalidateQueries()` après mutations

### Network Tab:
- Vérifier si requêtes GET refetch après POST/PUT/DELETE
- Vérifier cache-control headers

### React DevTools (si installé):
- Vérifier state Zustand/React Query
- Vérifier re-renders après mutations

---

## 📞 CREDENTIALS TESTS

**Admin:**
- Email: admin@xch.demo
- Password: admin123

**Manager:**
- Email: manager@xch.demo
- Password: manager123

**Viewer:**
- Email: viewer@xch.demo
- Password: viewer123

---

## ⏱️ ESTIMATION DURÉE

**Total estimé:** 2-3 heures
- Setup + Login: 5 min
- Dashboard: 10 min
- Sites (4 pages): 30 min
- Assets (3 pages): 25 min
- Tasks (2 pages): 20 min
- Racks (2 pages): 20 min
- FloorPlans (3 pages): 25 min
- Users (1 page): 10 min
- Settings (1 page): 10 min
- Rapport final: 15 min

---

FIN DU PROMPT
```

---

## 📝 INSTRUCTIONS UTILISATION

### Option 1: Tests Manuels avec Claude Chrome Extension

1. Ouvrir Chrome avec extension Claude
2. Aller sur https://xch.eoncom.io
3. Copier-coller le PROMPT ci-dessus dans Claude
4. Laisser Claude exécuter les tests automatiquement
5. Récupérer le rapport Markdown final

### Option 2: Tests Playwright Automatisés

Si préférence pour tests code (plus rapide), utiliser:

```bash
cd frontend
npm run test:e2e -- --project=chromium
```

**Limitations actuelles:**
- 2/57 tests passent (Known Issue SSR/CSR cookies documenté)
- Nécessite résolution Known Issue pour 100% coverage

---

## 🚀 PROCHAINES ÉTAPES

Après réception du rapport de tests:

1. **Analyser bugs refresh automatique**
   - Identifier pages sans `invalidateQueries()`
   - Corriger mutations React Query

2. **Corriger bugs critiques**
   - Prioriser bugs bloquants UX
   - Déployer fixes en production

3. **Documenter patterns corrects**
   - Guide "Best Practices React Query"
   - Ajouter dans `docs/guides/`

---

**Dernière mise à jour:** 2026-01-22
**Mainteneur:** Équipe XCH
**Version:** 1.0
