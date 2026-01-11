# PROMPT TEST XCH - Validation Post-Session 9

**Application:** XCH - Gestion IT Chantiers Temporaires
**URL:** http://192.168.0.13:3001
**Version:** v1.0.2 (Post-Session 9 bugfixes)
**Date test:** 2026-01-11
**Durée estimée:** 60-90 minutes

---

## 🎯 OBJECTIF DU TEST

Valider que les **6 bugs critiques résolus en Session 9** fonctionnent correctement en production et identifier tout nouveau bug potentiel.

**Bugs Session 9 à vérifier:**
1. ✅ Bug #1: Rack Viewer Konva (devrait afficher fabricant + modèle)
2. ✅ Bug #2: Session/Auth redirects (devrait maintenir session > 15min)
3. ✅ Bug #3: RBAC Manager permissions (devrait voir données)
4. ✅ Bug #4: FloorPlans navigation (devrait être accessible)
5. ✅ Bug #5: Rack data inconsistency (devrait afficher occupation)
6. ✅ Bug #6: Site assets visibility (devrait afficher équipements/tâches)

---

## 🔑 CREDENTIALS DE TEST

```
Admin:
  Email: admin@xch.demo
  Password: admin123

Manager:
  Email: manager@xch.demo
  Password: manager123

Technicien:
  Email: tech@xch.demo
  Password: tech123

Viewer:
  Email: viewer@xch.demo
  Password: viewer123
```

---

## 📋 SCÉNARIOS DE TEST

### PHASE 1: Tests Rack Viewer (Bug #1 - CRITIQUE)

**Objectif:** Vérifier que le Rack Viewer affiche correctement les équipements avec fabricant et modèle

**Étapes:**
1. Login avec `admin@xch.demo`
2. Navigation: Sidebar → "Baies"
3. Chercher la baie "RACK-BDX-DC1" (Datacenter Bordeaux)
4. Cliquer sur la ligne pour ouvrir le Rack Viewer
5. Observer la visualisation 2D Konva

**Résultat attendu:**
- ✅ Page Rack Viewer charge sans erreur
- ✅ Canvas Konva affiche une grille U (1U à 42U)
- ✅ Équipements montés visibles avec:
  - Fabricant + Modèle (ex: "HP ProLiant DL380 (2U)")
  - Position U correcte
  - Hauteur U correcte
- ✅ Aucune erreur console "Cannot read properties of undefined (reading 'brand')"

**Test supplémentaire:**
- Cliquer sur rack "RACK-TLS-C1" (Toulouse - 24U)
- Vérifier affichage équipements réseau

**Si erreur:** Noter message exact + screenshot

---

### PHASE 2: Tests Occupation Baies (Bug #5 - CRITIQUE)

**Objectif:** Vérifier cohérence données occupation entre Dashboard et Liste Baies

**Étapes:**
1. Toujours connecté en Admin
2. Navigation: Sidebar → "Tableau de bord"
3. Noter occupation totale affichée (ex: "25U / 216U utilisés")
4. Navigation: Sidebar → "Baies"
5. Observer tableau liste des baies

**Résultat attendu:**
- ✅ Dashboard affiche stats globales occupation (ex: "25U / 216U")
- ✅ Liste Baies affiche pour chaque rack:
  - Occupation % (ex: 14%, 8%, 29%)
  - "X équipements" (ex: "2 équipements")
  - **PAS "0% / 0 équipements"**
- ✅ Cohérence: Somme occupations liste = Total dashboard

**Test calcul:**
```
Exemple attendu:
RACK-BDX-DC1 (42U): 6U utilisés = 14% occupation
RACK-BDX-DC2 (42U): 3U utilisés = 7% occupation
RACK-TLS-C1 (24U): 2U utilisés = 8% occupation
```

**Si incohérence:** Noter valeurs exactes Dashboard vs Liste

---

### PHASE 3: Tests RBAC Manager (Bug #3 - CRITIQUE)

**Objectif:** Vérifier que Manager voit les données avec permissions correctes

**Étapes:**
1. Logout (Menu utilisateur → Déconnexion)
2. Login avec `manager@xch.demo` / `manager123`
3. Observer Dashboard après login
4. Navigation: Sidebar → "Sites"
5. Navigation: Sidebar → "Équipements"
6. Navigation: Sidebar → "Tâches"
7. Navigation: Sidebar → "Baies"
8. Navigation: Sidebar → "Plans"
9. Tenter: Sidebar → "Utilisateurs"

**Résultat attendu:**
- ✅ Dashboard affiche stats (sites, équipements, tâches)
- ✅ Sites: Liste visible (5 sites attendus)
- ✅ Équipements: Liste visible (36 assets attendus)
- ✅ Tâches: Kanban visible (15 tâches attendues)
- ✅ Baies: Liste visible (6 racks attendus)
- ✅ Plans: Page accessible (même si vide)
- ✅ Utilisateurs: Accessible en lecture seule OU masqué (selon RBAC)

**Actions à tester (MANAGER doit pouvoir):**
- ✅ Créer nouveau site
- ✅ Modifier site existant
- ✅ Créer nouvel équipement
- ✅ Assigner tâche
- ❌ Supprimer utilisateur (doit être refusé)

**Si Manager voit 0 données:** Bug CRITIQUE - noter page exacte

---

### PHASE 4: Tests Session/Auth (Bug #2 - CRITIQUE)

**Objectif:** Vérifier que session persiste > 15 minutes avec activité

**Étapes:**
1. Toujours connecté en Manager
2. Navigation: Sidebar → "Plans d'étage"
3. Attendre 30 secondes
4. Navigation: Sidebar → "Utilisateurs"
5. Attendre 30 secondes
6. Navigation: Sidebar → "Sites"
7. Rafraîchir page (F5)

**Résultat attendu:**
- ✅ Navigation vers Plans: RESTE connecté (pas de redirect /login)
- ✅ Navigation vers Utilisateurs: RESTE connecté
- ✅ Navigation vers Sites: RESTE connecté
- ✅ Rafraîchissement page: RESTE connecté
- ✅ Aucun logout inopiné pendant 2-3 minutes d'activité

**Test long (optionnel):**
- Laisser onglet ouvert 20 minutes avec clics toutes les 2 minutes
- Vérifier session maintenue

**Si logout avant 15min:** Bug CRITIQUE - noter timestamp exact

---

### PHASE 5: Tests FloorPlans Navigation (Bug #4 - CRITIQUE)

**Objectif:** Vérifier accès FloorPlans pour tous les rôles

**Étapes:**
1. Connecté en Manager
2. Clic: Sidebar → "Plans d'étage"
3. Observer URL et page affichée
4. Logout
5. Login avec `tech@xch.demo` / `tech123`
6. Clic: Sidebar → "Plans d'étage"
7. Logout
8. Login avec `viewer@xch.demo` / `viewer123`
9. Clic: Sidebar → "Plans d'étage"

**Résultat attendu:**
- ✅ Manager: URL `/dashboard/floor-plans` + Page charge
- ✅ Technicien: URL `/dashboard/floor-plans` + Page charge
- ✅ Viewer: URL `/dashboard/floor-plans` + Page charge (lecture seule)
- ✅ Aucun redirect automatique vers `/login`

**Si redirect /login:** Bug CRITIQUE - noter rôle exact

---

### PHASE 6: Tests Site Detail (Bug #6 - MINEUR)

**Objectif:** Vérifier affichage équipements/baies/tâches dans détail site

**Étapes:**
1. Login avec `admin@xch.demo`
2. Navigation: Sidebar → "Sites"
3. Chercher site "Paris La Défense"
4. Cliquer sur la ligne pour ouvrir détail
5. Observer onglets: Vue d'ensemble / Équipements / Baies / Tâches

**Résultat attendu:**
- ✅ Onglet "Équipements": Affiche liste (12 équipements attendus)
- ✅ Onglet "Baies": Affiche liste (2 baies attendues: RACK-PAR-A1, RACK-PAR-B1)
- ✅ Onglet "Tâches": Affiche liste (6 tâches attendues)
- ✅ **PAS "0 équipements / 0 baies / 0 tâches"**

**Test autre site:**
- Site "Lyon Part-Dieu": 8 équipements, 1 baie, 3 tâches
- Site "Datacenter Bordeaux": 8 équipements, 2 baies, 3 tâches

**Si affiche 0:** Noter site exact + onglet concerné

---

### PHASE 7: Tests Fonctionnels Généraux

**Objectif:** Vérifier features principales MVP

**7.1 - Gestion Équipements:**
1. Navigation: "Équipements" → "Nouvel équipement"
2. Remplir formulaire:
   - Type: "Switch"
   - Fabricant: "Cisco"
   - Modèle: "Catalyst 2960"
   - Numéro série: "TEST-001"
   - Site: "Paris La Défense"
3. Soumettre
4. Vérifier apparition dans liste

**Attendu:** ✅ Création réussie + redirect liste + équipement visible

---

**7.2 - QR Code:**
1. Dans liste équipements, trouver équipement "iPad Pro 11" M2"
2. Cliquer sur la ligne pour ouvrir détail
3. Chercher section "QR Code"
4. Cliquer "Générer QR Code"

**Attendu:** ✅ QR Code affiché + Option télécharger

---

**7.3 - Montage Baie:**
1. Navigation: "Baies" → Ouvrir "RACK-PAR-A1"
2. Cliquer bouton "Monter équipement"
3. Sélectionner équipement créé précédemment (Catalyst 2960)
4. Position U: 10
5. Hauteur U: 1
6. Soumettre

**Attendu:** ✅ Équipement monté visible dans visualisation 2D

---

**7.4 - Gestion Tâches:**
1. Navigation: "Tâches"
2. Vérifier Kanban 3 colonnes: TODO / IN_PROGRESS / DONE
3. Drag & drop une tâche de TODO vers IN_PROGRESS

**Attendu:** ✅ Tâche déplacée + Status mis à jour

---

**7.5 - Carte Sites:**
1. Navigation: "Sites"
2. Cliquer onglet "Carte"
3. Observer markers sur carte Leaflet

**Attendu:** ✅ 5 markers visibles (Paris, Lyon, Marseille, Bordeaux, Toulouse)

---

### PHASE 8: Tests Responsive Mobile (Bug #7 - MINEUR)

**Objectif:** Identifier problèmes UI mobile (non bloquant)

**Étapes:**
1. Ouvrir DevTools Chrome (F12)
2. Mode responsive: iPhone 12 Pro (390x844)
3. Naviguer: Dashboard → Sites → Équipements

**Résultat attendu (bugs connus acceptables):**
- ⚠️ Sidebar reste visible (pas de hamburger menu)
- ⚠️ Tableaux débordent horizontalement
- ⚠️ Cartes pas optimisées mobile

**Noter:** Si bugs plus graves que ça (crash, inaccessible)

---

## 📊 FORMAT RAPPORT

**Génère un rapport structuré comme suit:**

```markdown
# RAPPORT TEST XCH v1.0.2 - Post-Session 9

**Date:** 2026-01-11
**Durée test:** XX minutes
**Navigateur:** Chrome XX
**Testeur:** [AI Extension Name]

---

## ✅ RÉSUMÉ EXÉCUTIF

- Bugs Session 9 validés: X/6
- Nouveaux bugs identifiés: X
- Sévérité globale: [CRITIQUE / MAJEUR / MINEUR / AUCUN]

---

## 🐛 BUGS IDENTIFIÉS

### BUG #1: [Titre court]
**Sévérité:** [CRITIQUE / MAJEUR / MINEUR]
**Module:** [Dashboard / Sites / Racks / etc.]
**Reproductibilité:** [100% / 50% / Aléatoire]

**Symptômes:**
- [Description précise de ce qui ne fonctionne pas]

**Étapes de reproduction:**
1. [Étape 1]
2. [Étape 2]
3. [Résultat observé]

**Résultat attendu:**
- [Ce qui devrait se passer]

**Résultat actuel:**
- [Ce qui se passe réellement]

**Screenshots:** [Si disponible]

**Erreurs console:**
```
[Copier erreurs JavaScript si présentes]
```

**Hypothèses cause:**
- [Hypothèse 1]
- [Hypothèse 2]

---

### BUG #2: [etc...]

[Répéter pour chaque bug trouvé]

---

## ✅ VALIDATIONS SESSION 9

### Bug #1 - Rack Viewer Konva
**Status:** [✅ VALIDÉ / ❌ ÉCHOUÉ]
**Détails:** [Fabricant affiché correctement / Erreur brand undefined / etc.]

### Bug #2 - Session/Auth
**Status:** [✅ VALIDÉ / ❌ ÉCHOUÉ]
**Détails:** [Session maintenue 20min / Logout après 5min / etc.]

### Bug #3 - RBAC Manager
**Status:** [✅ VALIDÉ / ❌ ÉCHOUÉ]
**Détails:** [Manager voit 5 sites / Manager voit 0 données / etc.]

### Bug #4 - FloorPlans Navigation
**Status:** [✅ VALIDÉ / ❌ ÉCHOUÉ]
**Détails:** [Accessible tous rôles / Redirect login pour Viewer / etc.]

### Bug #5 - Rack Occupation
**Status:** [✅ VALIDÉ / ❌ ÉCHOUÉ]
**Détails:** [Occupation affichée 14% / Toujours 0% / etc.]

### Bug #6 - Site Detail Assets
**Status:** [✅ VALIDÉ / ❌ ÉCHOUÉ]
**Détails:** [12 équipements affichés / 0 équipements / etc.]

---

## 📈 MÉTRIQUES PERFORMANCE

- Temps chargement Dashboard: XXms
- Temps chargement Liste Sites: XXms
- Temps chargement Rack Viewer: XXms
- Erreurs console totales: X

---

## 💡 RECOMMANDATIONS

### Priorité 1 (Blocantes production):
- [Bug à corriger immédiatement]

### Priorité 2 (Importantes):
- [Bugs impactants mais non bloquants]

### Priorité 3 (Améliorations):
- [Nice to have]

---

## 📝 NOTES ADDITIONNELLES

[Observations générales, points positifs, suggestions...]

---

**Rapport généré par:** [AI Extension]
**Timestamp:** [Date/Heure]
```

---

## 🎯 CONSIGNES SPÉCIALES

1. **Sois exhaustif:** Teste TOUTES les étapes, même si tout semble OK
2. **Screenshots:** Prends captures d'écran pour chaque bug
3. **Console:** Ouvre DevTools et note TOUTES les erreurs JavaScript
4. **Timing:** Note durée exacte de chaque phase
5. **Comparaison:** Compare résultats actuels vs résultats attendus Session 9
6. **Nouveaux bugs:** Cherche activement bugs NON listés dans Session 9
7. **Sévérité:** Sois précis sur impact (CRITIQUE = bloque production)

---

## ⚠️ FOCUS PRIORITAIRE

**Top 3 à vérifier en priorité:**
1. **Rack Viewer:** DOIT afficher fabricant sans crash
2. **RBAC Manager:** DOIT voir les données (pas 0)
3. **Occupation Baies:** DOIT être cohérent Dashboard vs Liste

**Si un de ces 3 échoue → Bug CRITIQUE à signaler immédiatement**

---

## 🚀 LANCEMENT TEST

**Commande:**
1. Ouvre http://192.168.0.13:3001
2. Suis scénarios dans l'ordre (Phase 1 → Phase 8)
3. Note TOUT ce qui diffère de l'attendu
4. Génère rapport final structuré

**Durée estimée:** 60-90 minutes pour test complet

**Bonne chance! 🎯**
