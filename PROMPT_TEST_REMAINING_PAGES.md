# 🧪 PROMPT TEST - Pages Restantes XCH

**URL :** https://xch.eoncom.io
**Date :** 2026-01-18
**Objectif :** Tester les 10 pages NON testées + identifier TOUS les bugs

---

## 🔐 CREDENTIALS

```
ADMIN: admin@xch.demo / admin123
```

---

## 📋 PAGES À TESTER (Focus bugs boutons "Modifier")

### ⚠️ BUGS SUSPECTÉS (à vérifier en priorité)

D'après l'utilisateur, il y a des bugs sur :
1. **Users** - Bouton "Modifier" ne fonctionne pas
2. **Racks/Baies** - Bouton "Modifier" problématique
3. **Autres pages** - À identifier

---

## 🔴 TEST 1 : USERS (HAUTE PRIORITÉ)

**URL :** `/dashboard/users`

**Actions :**
1. Login admin@xch.demo / admin123
2. Naviguer vers `/dashboard/users`
3. Vérifier affichage tableau utilisateurs (9 users attendus)
4. **CRITICAL :** Trouver un utilisateur dans la liste
5. **Cliquer bouton "Modifier" (icône crayon ou texte "Edit")**
6. Observer comportement

**Résultat attendu :**
- ✅ Modal édition utilisateur s'ouvre
- ✅ Formulaire pré-rempli avec données user
- ✅ Possibilité modifier nom, email, rôle

**Bug possible :**
- ❌ Bouton "Modifier" ne fait rien au click
- ❌ Aucune modal ne s'ouvre
- ❌ Erreur JavaScript console

**Si bug détecté, rapporter :**
- Screenshot bouton "Modifier"
- Erreur console JavaScript (F12 → Console)
- URL exacte de la page
- Ligne de code si visible dans erreur

---

## 🔴 TEST 2 : RACKS/BAIES (HAUTE PRIORITÉ)

**URL :** `/dashboard/racks`

**Actions :**
1. Naviguer vers `/dashboard/racks`
2. Vérifier affichage tableau baies (6 racks attendus)
3. **Cliquer bouton "Modifier" d'une baie**
4. Observer comportement

**Résultat attendu :**
- ✅ Modal ou page édition baie s'ouvre
- ✅ Formulaire pré-rempli (code, nom, site, type, hauteur U)

**Bug possible :**
- ❌ Bouton "Modifier" ne répond pas
- ❌ Redirection cassée
- ❌ Erreur console

**Tester aussi :**
- Cliquer sur une baie → Page détail `/dashboard/racks/{id}`
- Sur page détail, vérifier :
  - Canvas Konva charge correctement
  - Équipements montés visibles
  - Bouton "Monter équipement" fonctionne

---

## 🟡 TEST 3 : TASKS (Kanban)

**URL :** `/dashboard/tasks`

**Actions :**
1. Vérifier 3 colonnes Kanban (TODO, IN_PROGRESS, DONE)
2. Vérifier cartes tâches (15 tâches attendues)
3. **Drag & drop :** Déplacer tâche de TODO → IN_PROGRESS
4. Refresh page → Vérifier tâche reste dans IN_PROGRESS
5. **Cliquer sur carte tâche** → Modal détail
6. **Modifier tâche :** Changer titre, priorité, assignation
7. **Checklist :** Ajouter item, cocher/décocher
8. **TicketLink :** Ajouter lien externe (URL)
9. Cliquer "Nouvelle tâche" → Modal création

**Bugs possibles :**
- ❌ Drag & drop ne fonctionne pas
- ❌ Statut ne se sauvegarde pas
- ❌ Checklist cassée
- ❌ TicketLink ne sauvegarde pas
- ❌ Modal édition ne s'ouvre pas

---

## 🟡 TEST 4 : FLOOR PLANS

**URL :** `/dashboard/floor-plans`

**Actions :**
1. Vérifier tableau plans (nombre attendu inconnu)
2. **Cliquer "Nouveau plan"** → Modal upload
3. **Uploader fichier PNG ou PDF** (plan d'étage test)
4. Renseigner nom + site → Créer
5. Vérifier plan dans liste
6. **Cliquer sur plan** → Page viewer `/dashboard/floor-plans/{id}`
7. Vérifier canvas Konva charge image plan
8. Tester zoom/pan (molette + drag)
9. **Cliquer "Ajouter pin"**
10. Choisir type pin (EQUIPEMENT, RESEAU, ALERTE, INFO)
11. Cliquer sur plan pour placer pin
12. Renseigner label → Sauvegarder
13. **Drag & drop pin existant** → Nouvelle position
14. Vérifier sauvegarde position

**Bugs possibles :**
- ❌ Upload fichier timeout
- ❌ Canvas ne charge pas image
- ❌ Zoom/pan cassé
- ❌ Pins ne s'affichent pas
- ❌ Drag & drop pins ne fonctionne pas
- ❌ Position pins ne se sauvegarde pas

---

## 🟡 TEST 5 : SETTINGS

**URL :** `/dashboard/settings`

### 5.1 Profil (`/dashboard/settings/profile`)

**Actions :**
1. Vérifier formulaire profil (nom, email, téléphone)
2. Modifier nom → "Test Admin Modified"
3. Cliquer "Enregistrer"
4. Vérifier nom changé en haut à droite
5. **Tester changement mot de passe :**
   - Mot de passe actuel : admin123
   - Nouveau : testpass123
   - Confirmation : testpass123
6. Sauvegarder
7. Logout → Re-login avec nouveau mot de passe

**Bugs possibles :**
- ❌ Sauvegarde ne fonctionne pas
- ❌ Nom ne se met pas à jour
- ❌ Changement mot de passe échoue

### 5.2 Intégrations (`/dashboard/settings/integrations`)

**Actions :**
1. Vérifier cartes NetBox et Uptime Kuma
2. Tester config NetBox :
   - URL : https://netbox.example.com
   - Token : test-token-123
   - Sauvegarder
3. Tester config Uptime Kuma similairement

**Bugs possibles :**
- ❌ Sauvegarde config cassée
- ❌ Token exposé en clair (faille sécurité)

---

## 🟢 TEST 6 : SITES (Vérification complète)

**Pages déjà testées, mais vérifier boutons "Modifier" :**

### 6.1 Liste Sites (`/dashboard/sites`)

**Actions :**
1. Vérifier tableau sites (5 sites attendus)
2. **Cliquer "Modifier" sur site existant**
3. Vérifier modal/page édition s'ouvre
4. Modifier nom site → Sauvegarder
5. Vérifier modification appliquée

**Bug rapporté précédemment :** ✅ CORRIGÉ (extension a confirmé)

### 6.2 Détail Site (`/dashboard/sites/{id}`)

**Actions :**
1. Cliquer sur carte site → Page détail
2. Vérifier onglets (Informations, Assets, Racks, Plans, Tâches)
3. **Cliquer bouton "Modifier" en haut**
4. Vérifier formulaire édition

---

## 🟢 TEST 7 : ASSETS (Vérification complète)

### 7.1 Liste Assets (`/dashboard/assets`)

**Actions :**
1. Tableau 36 assets
2. **Cliquer "Modifier" asset existant**
3. Vérifier modal édition s'ouvre

### 7.2 Scanner QR (`/dashboard/assets/scan`)

**Actions :**
1. Autoriser caméra
2. Scanner QR code (généré depuis détail asset)
3. Vérifier redirection vers détail asset

**Bugs possibles :**
- ❌ Caméra ne démarre pas
- ❌ Scanner ne détecte pas QR
- ❌ Redirection cassée

---

## 📊 FORMAT RAPPORT BUGS

Pour **CHAQUE BUG** trouvé, fournir :

```markdown
### BUG #{numéro} - {Page}

**Page :** /dashboard/{page}
**Gravité :** 🔴 Critique / 🟠 Haute / 🟡 Moyenne / 🟢 Basse

**Description courte :**
[1 phrase résumé]

**Étapes reproduire :**
1. [Action 1]
2. [Action 2]
3. → Résultat

**Comportement attendu :**
[Ce qui devrait se passer]

**Comportement actuel :**
[Ce qui se passe réellement]

**Erreur console (si applicable) :**
```
[Copier-coller erreur JavaScript]
```

**Screenshot :**
[Si pertinent]

**Impact utilisateur :**
[Pourquoi c'est bloquant]
```

---

## ✅ CHECKLIST COMPLÈTE

À la fin, fournir tableau récapitulatif :

| # | Page | Fonctionnalité | Statut | Bug# |
|---|------|----------------|--------|------|
| 1 | Users | Liste affichage | ✅/❌ | - |
| 2 | Users | **Bouton "Modifier"** | ✅/❌ | BUG #X |
| 3 | Users | Création user | ✅/❌ | - |
| 4 | Racks | Liste affichage | ✅/❌ | - |
| 5 | Racks | **Bouton "Modifier"** | ✅/❌ | BUG #Y |
| 6 | Racks | Viewer Konva | ✅/❌ | - |
| 7 | Racks | Mount équipement | ✅/❌ | - |
| 8 | Tasks | Kanban affichage | ✅/❌ | - |
| 9 | Tasks | Drag & drop | ✅/❌ | - |
| 10 | Tasks | Checklist | ✅/❌ | - |
| 11 | FloorPlans | Upload plan | ✅/❌ | - |
| 12 | FloorPlans | Viewer Konva | ✅/❌ | - |
| 13 | FloorPlans | Pins drag & drop | ✅/❌ | - |
| 14 | Settings | Profil édition | ✅/❌ | - |
| 15 | Settings | Intégrations | ✅/❌ | - |
| 16 | Assets | Scanner QR | ✅/❌ | - |

---

## 🎯 PRIORITÉS TEST

**Ordre de test recommandé :**

1. **🔴 USERS** (bug confirmé utilisateur)
2. **🔴 RACKS** (bug suspecté)
3. 🟡 TASKS (fonctionnalité complexe)
4. 🟡 FLOOR PLANS (fonctionnalité complexe)
5. 🟡 SETTINGS
6. 🟢 ASSETS Scanner QR
7. 🟢 SITES (vérification double)

**Temps estimé :** 20-30 minutes

---

## 📝 NOTES IMPORTANTES

1. **Erreurs console :** Ouvrir DevTools (F12) avant chaque test
2. **Network requests :** Surveiller onglet Network pour erreurs 403/500
3. **Screenshots :** Capturer écran quand bug visible
4. **Permissions RBAC :** Tester avec ADMIN pour éviter erreurs permissions

---

**Objectif final :** Liste complète TOUS bugs application, priorisés par gravité, avec détails techniques pour correction rapide. 🚀
