# Guide Tests Frontend Complets XCH

**Date :** 2026-01-22
**Application :** https://xch.eoncom.io

---

## 🎯 OBJECTIF

Valider les 18 pages du frontend et identifier les problèmes de **refresh automatique** des données après mutations CRUD.

**Problème signalé :** Les données ne se mettent pas à jour automatiquement, l'utilisateur doit rafraîchir (F5) ou changer de page.

---

## 📋 OPTION 1 : TESTS AUTOMATIQUES (Claude Chrome Extension)

### ✅ Recommandé - Plus rapide et complet

### Étapes :

1. **Ouvrir Chrome avec extension Claude**
   - Aller sur https://xch.eoncom.io
   - Ouvrir panneau Claude (icône extension)

2. **Copier le prompt complet**
   - Ouvrir fichier : `PROMPT_TEST_COMPLET_FRONTEND.md`
   - Copier tout le contenu du prompt (section "PROMPT POUR CLAUDE CHROME EXTENSION")
   - Coller dans Claude

3. **Lancer les tests**
   - Claude va naviguer automatiquement sur les 18 pages
   - Pour chaque page : tester fonctionnalités + refresh automatique
   - Prendre screenshots
   - Générer rapport détaillé

4. **Récupérer le rapport**
   - Claude générera un fichier Markdown avec :
     - ✅ Pages avec refresh automatique OK
     - ❌ Pages nécessitant F5 (à corriger)
     - 🐛 Liste bugs identifiés
     - 📸 Screenshots de toutes les pages

### Durée estimée : 2-3 heures (automatique)

---

## 📋 OPTION 2 : TESTS MANUELS (Vous-même)

### Checklist simplifiée

Pour CHAQUE page, tester :

#### 1. Dashboard (/dashboard)
- [ ] Stats affichées
- [ ] Carte Leaflet fonctionne
- **Test refresh :** Créer site → Revenir dashboard SANS F5 → Total sites à jour ?

#### 2. Sites - Liste (/dashboard/sites)
- [ ] Liste affichée
- [ ] Recherche fonctionne
- **Test refresh :** Créer site → Voir nouveau site SANS F5 ?

#### 3. Sites - Carte (/dashboard/sites?view=map)
- [ ] Carte Leaflet + marqueurs
- **Test refresh :** Créer site GPS → Voir marqueur SANS F5 ?

#### 4. Sites - Détail (/dashboard/sites/[id])
- [ ] Infos + onglets (Équipements, Baies, Tâches)
- **Test refresh :** Créer asset → Onglet Équipements à jour SANS F5 ?

#### 5. Sites - Création (/dashboard/sites/new)
- [ ] Formulaire fonctionne
- **Test refresh :** Créer → Liste à jour SANS F5 ?

#### 6. Sites - Édition (/dashboard/sites/[id]/edit)
- [ ] Formulaire pré-rempli
- **Test refresh :** Modifier nom → Détail à jour SANS F5 ?

#### 7. Assets - Liste (/dashboard/assets)
- [ ] Liste + filtres
- [ ] QR codes visibles
- **Test refresh :** Créer asset → Liste à jour SANS F5 ?

#### 8. Assets - Détail (/dashboard/assets/[id])
- [ ] Infos + QR code grand format
- **Test refresh :** Modifier status → Détail à jour SANS F5 ?

#### 9. Assets - Scanner QR (/dashboard/assets/scan)
- [ ] Caméra fonctionne (si permissions)

#### 10. Tasks - Kanban (/dashboard/tasks)
- [ ] 3 colonnes + drag & drop
- **Test refresh :** Créer tâche → Carte visible SANS F5 ?
- **Test drag :** Drag TODO → IN_PROGRESS → Reste SANS F5 ?

#### 11. Tasks - Détail (/dashboard/tasks/[id])
- [ ] Infos + checklist
- **Test refresh :** Cocher item → Rouvrir détail → Checkbox reste cochée ?

#### 12. Racks - Liste (/dashboard/racks)
- [ ] Liste baies + occupation
- **Test refresh :** Créer baie → Liste à jour SANS F5 ?

#### 13. Racks - Viewer 2D (/dashboard/racks/[id])
- [ ] Canvas Konva + équipements montés
- **Test refresh :** Monter équipement → Canvas à jour SANS F5 ?

#### 14. Floor Plans - Liste (/dashboard/floor-plans)
- [ ] Liste plans
- **Test refresh :** Upload plan → Liste à jour SANS F5 ?

#### 15. Floor Plans - Upload (/dashboard/floor-plans/new)
- [ ] Upload PNG/PDF fonctionne
- **Test refresh :** Upload → Liste à jour SANS F5 ?

#### 16. Floor Plans - Viewer (/dashboard/floor-plans/[id])
- [ ] Canvas Konva + zoom/pan
- **Test refresh :** Ajouter pin → Pin visible SANS F5 ?

#### 17. Users - Liste (/dashboard/users)
- [ ] Liste utilisateurs + stats
- **Test refresh :** Créer user → Liste à jour SANS F5 ?

#### 18. Settings - Profil (/dashboard/settings)
- [ ] Formulaire profil
- **Test refresh :** Modifier nom → Revenir → Nom à jour SANS F5 ?

### Durée estimée : 3-4 heures (manuel)

---

## 📊 RAPPORT À CRÉER

Après tests, créer fichier `RAPPORT_TESTS_FRONTEND_[DATE].md` avec :

```markdown
# Rapport Tests Frontend XCH - [DATE]

## Résumé

- **Pages testées :** X/18
- **Tests passants :** X/Y
- **Bugs critiques :** X

## Refresh Automatique

### ✅ OK (données se mettent à jour SANS F5)
- Dashboard : ✅
- Sites Liste : ✅
- ...

### ❌ KO (F5 requis pour voir nouvelles données)
- Assets Liste : ❌ Créer asset → Liste ne rafraîchit pas
- Tasks Kanban : ❌ Drag & drop → Rollback au refresh
- ...

## Bugs Identifiés

### Bug #1 : Assets Liste - Pas de refresh après création
**Sévérité :** Majeur
**Reproduction :**
1. Aller sur /dashboard/assets
2. Créer nouvel asset "iPad Test"
3. Revenir liste SANS F5
4. **Résultat :** Ancien cache, iPad Test invisible
5. **Attendu :** iPad Test visible immédiatement

### Bug #2 : ...

## Recommandations

1. Ajouter `queryClient.invalidateQueries(['assets'])` dans assets/new/page.tsx
2. Ajouter `queryClient.invalidateQueries(['tasks'])` dans tasks mutations
3. ...
```

---

## 🔧 CORRECTIONS AUTOMATIQUES

Une fois rapport reçu, je pourrai :

1. **Identifier fichiers à corriger** (analyse déjà faite dans `ANALYSE_REFRESH_AUTOMATIQUE.md`)
2. **Appliquer corrections** (ajouter `invalidateQueries` dans mutations)
3. **Tester en local** (build + vérification)
4. **Déployer en production** (si validations OK)

---

## 🎯 QUELLE OPTION CHOISIR ?

### Choisir Option 1 (Claude Chrome) si :
- ✅ Vous avez extension Claude installée
- ✅ Vous voulez rapport détaillé automatique
- ✅ Vous voulez screenshots automatiques
- ✅ Vous voulez gagner du temps (2h vs 4h)

### Choisir Option 2 (Manuel) si :
- ✅ Vous préférez contrôler chaque test
- ✅ Vous voulez comprendre chaque fonctionnalité
- ✅ Vous n'avez pas extension Claude

---

## 📞 CREDENTIALS

**Admin :**
- Email : admin@xch.demo
- Password : admin123

**Manager :**
- Email : manager@xch.demo
- Password : manager123

**Viewer :**
- Email : viewer@xch.demo
- Password : viewer123

---

## 🚀 DÉMARRER MAINTENANT

### Option 1 (Claude Chrome) :
1. Ouvrir Chrome → https://xch.eoncom.io
2. Ouvrir extension Claude
3. Copier prompt depuis `PROMPT_TEST_COMPLET_FRONTEND.md`
4. Coller dans Claude → Lancer

### Option 2 (Manuel) :
1. Ouvrir https://xch.eoncom.io
2. Login avec admin@xch.demo / admin123
3. Suivre checklist ci-dessus
4. Noter résultats dans rapport

---

**Bonne chance avec les tests !** 🎯

Une fois le rapport prêt, partagez-le et je m'occupe des corrections.

---

**Dernière mise à jour :** 2026-01-22
**Mainteneur :** Équipe XCH
