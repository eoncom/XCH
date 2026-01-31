# Analyse des écarts Frontend vs Backend

**Date:** 2026-01-31
**Problème:** Le frontend ne présente pas tous les champs disponibles dans le backend

---

## 🔍 ERREURS CONSTATÉES

### 1. Upload Attachments - Erreur 500
**Erreur:** `Cannot read properties of undefined (reading 'originalname')`
**Cause:** Le fichier n'est pas envoyé correctement au backend
**Impact:** L'upload de documents ne fonctionne pas

### 2. Floor Plans - Erreur 401
**Erreur:** POST `/api/floor-plans` retourne 401 Unauthorized
**Cause:** Problème d'authentification ou de permissions
**Impact:** Impossible de créer des plans de sol

---

## 📊 COMPARAISON SCHÉMA DB vs FRONTEND

### SITES (Chantiers)

#### ✅ Champs présents dans le frontend:
- Code, nom, statut, adresse, ville, code postal, pays
- Coordonnées GPS
- Contacts (JSONB)
- Notes d'accès (JSONB)
- Connectivité (JSONB)
- Notes texte

#### ❌ Champs manquants/incomplets dans le frontend:
1. **emplacements** (JSONB) - Pas d'interface d'édition
   - Devrait contenir: Local technique, armoires réseau, zones de stockage

2. **governanceDocsRef** (TEXT) - Pas d'interface
   - Devrait référencer: Documents gouvernance, procédures, contrats

3. **healthStatus** - Géré par backend mais UI limitée
4. **lastHealthCheck** - Pas affiché/éditable

#### 🔍 Structure attendue des champs JSONB:

**contacts** (implémenté):
```json
{
  "principal": {
    "name": "string",
    "phone": "string",
    "email": "string",
    "role": "string"
  },
  "secondaires": [
    {
      "name": "string",
      "phone": "string",
      "email": "string",
      "role": "string"
    }
  ]
}
```

**connectivity** (implémenté):
```json
{
  "internet": {
    "type": "string",
    "provider": "string",
    "contractRef": "string",
    "bandwidth": "string"
  },
  "backup": {
    "type": "string",
    "provider": "string",
    "contractRef": "string"
  },
  "cutProcedure": "string"
}
```

**accessNotes** (implémenté):
```json
{
  "schedule": "string",
  "constraints": "string",
  "procedures": "string"
}
```

**emplacements** (NON implémenté):
```json
{
  "localTechnique": {
    "location": "string",
    "access": "string",
    "dimensions": "string"
  },
  "armoires": [
    {
      "name": "string",
      "location": "string",
      "type": "string"
    }
  ],
  "zones": [
    {
      "name": "string",
      "type": "string",
      "notes": "string"
    }
  ]
}
```

---

### ASSETS (Équipements)

#### ✅ Champs présents:
- Type, modèle, fabricant, numéro de série
- Tag inventaire, statut, localisation texte
- networkInfo (JSONB)
- Rack ID, position U, hauteur U
- Date achat, fin garantie
- Poids, consommation électrique
- Notes

#### ❌ Fonctionnalités manquantes:
1. **Onglet Documents/Attachments** - Backend prêt, frontend à implémenter
2. **Photos** - Table existe (photos) mais pas d'upload UI
3. **Références externes** - Table external_refs existe mais pas d'UI

---

### TASKS (Tâches)

#### ✅ Champs présents:
- Titre, description, statut, priorité
- Site, asset lié, assigné à, créé par
- Date d'échéance
- ticketRef, ticketUrl, ticketStatus
- checklist (JSONB)

#### ❌ Fonctionnalités manquantes:
1. **Checklist interactive** - Champ existe mais UI non fonctionnelle
2. **Onglet Documents/Attachments** - Backend prêt, frontend à implémenter
3. **Photos** - Table existe mais pas d'upload UI

#### 🔍 Structure checklist (partiellement implémenté):
```json
{
  "items": [
    {
      "id": "string",
      "text": "string",
      "checked": boolean,
      "order": number
    }
  ]
}
```

---

### RACKS (Baies)

#### ✅ Champs présents:
- Nom, type, hauteur U, site
- Localisation, numéro de série, fabricant
- Poids max, conso max, statut
- Notes

#### ❌ Champs/fonctionnalités manquants:
1. **depth** - Existe en DB mais pas en frontend
2. **Température/Humidité** - Pas implémenté
3. **Photos** - Table existe mais pas d'UI

---

### FLOOR PLANS (Plans de sol)

#### ✅ Fonctionnalités présentes:
- Nom, description, site
- Upload image plan
- Pins avec positions X/Y
- Lien vers assets/racks

#### ❌ Problèmes:
1. **401 Unauthorized** sur création - Bug à corriger
2. **Photos** - Pas d'upload additionnel de photos

---

### USERS (Utilisateurs)

#### ✅ Champs présents:
- Email, nom, rôle, actif
- Téléphone
- Dernière connexion

#### ❌ Champs manquants:
- **authProvider** - Pas affiché
- **Photo de profil** - Pas d'upload

---

### TENANTS (Organisation)

#### ✅ Champs présents:
- Nom, sous-domaine, statut
- Couleur primaire

#### ❌ Champs manquants:
1. **logo** - Existe en DB mais pas d'upload UI
2. **Paramètres avancés** - Settings minimalistes

---

## 📋 ACTIONS PRIORITAIRES

### 🔴 CRITIQUE (Bugs bloquants)

1. **Corriger erreur 500 upload attachments**
   - Problème: Backend ne reçoit pas le fichier correctement
   - Solution: Vérifier le nom du champ FormData ('file' vs 'attachment')

2. **Corriger erreur 401 floor-plans**
   - Problème: Authentification/permissions
   - Solution: Vérifier les guards et le JWT

### 🟠 HAUTE PRIORITÉ (Fonctionnalités promises)

3. **Implémenter onglet Documents pour Assets**
   - Backend prêt (routes /api/assets/:id/attachments)
   - Frontend: Créer composant AttachmentsTab

4. **Implémenter onglet Documents pour Tasks**
   - Backend prêt (routes /api/tasks/:id/attachments)
   - Frontend: Réutiliser AttachmentsTab

5. **Rendre checklist interactive dans Tasks**
   - Backend supporte le JSONB
   - Frontend: Ajouter UI pour cocher/décocher items

6. **Ajouter onglet Emplacements dans Sites**
   - Champ DB existe (emplacements JSONB)
   - Frontend: Créer formulaire pour local technique, armoires, zones

### 🟡 MOYENNE PRIORITÉ (Améliorations UX)

7. **Upload photos pour Assets/Tasks/Racks/Sites**
   - Table photos existe
   - Créer composant PhotoUpload réutilisable

8. **Gouvernance docs dans Sites**
   - Champ governanceDocsRef existe
   - Ajouter input texte ou upload de référence

9. **Health status automatique**
   - Affichage existe mais pas de calcul/mise à jour auto

### 🟢 BASSE PRIORITÉ (Nice to have)

10. **Logo tenant**
11. **Photo profil utilisateurs**
12. **Température/Humidité racks**
13. **Références externes (NetBox, etc.)**

---

## 🛠️ PLAN DE CORRECTION

### Phase 1: Correction bugs critiques (2h)
1. Debug et fix upload attachments (vérifier nom champ FormData)
2. Fix 401 floor-plans (vérifier permissions)

### Phase 2: Documents & Checklist (4h)
3. Créer composant AttachmentsTab réutilisable
4. Intégrer dans Asset detail page
5. Intégrer dans Task detail page
6. Rendre checklist interactive

### Phase 3: Emplacements Sites (2h)
7. Créer formulaire Emplacements (local technique, armoires, zones)
8. Intégrer dans Sites edit page

### Phase 4: Photos (3h)
9. Créer composant PhotoUpload
10. Intégrer dans Assets, Tasks, Racks, Sites

### Phase 5: Gouvernance & Polish (2h)
11. Ajouter governanceDocsRef dans Sites
12. Tests et validation globale

**TOTAL ESTIMÉ: 13h de développement**

---

## 🎯 RÉSULTAT ATTENDU

Après corrections, le frontend exposera:
- ✅ Tous les champs du backend
- ✅ Upload de documents fonctionnel
- ✅ Checklist interactive
- ✅ Photos pour tous les types d'entités
- ✅ Emplacements détaillés pour sites
- ✅ Références gouvernance

**L'application sera alors 100% conforme au cahier des charges et au schéma DB.**
