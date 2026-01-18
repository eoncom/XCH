# DOCS_AUDIT.md - Audit Complet de la Documentation XCH

**Date de l'audit :** 2026-01-01
**Auditeur :** Claude Code
**Objectif :** Identifier duplications, inconsistances, et proposer plan de réorganisation

---

## 📊 RÉSUMÉ EXÉCUTIF

### Statistiques globales

- **Fichiers .md trouvés :** 29 fichiers
- **Problèmes détectés :** 8 duplications majeures, 5 inconsistances de dates/statuts
- **Action recommandée :** Réorganisation complète avec consolidation

### Verdict

🔴 **RÉORGANISATION URGENTE NÉCESSAIRE**

**Raisons :**
1. Multiple fichiers décrivent le même sujet (statut projet) avec des informations contradictoires
2. Fichiers de checkpoint dispersés dans différents dossiers
3. Pas de source unique de vérité pour l'état du projet
4. Dates incohérentes (2025 vs 2026)
5. Pourcentages d'avancement contradictoires

---

## 📁 INVENTAIRE DÉTAILLÉ DES FICHIERS

### Fichiers racine (13 fichiers)

| Fichier | Lignes | Catégorie | Dernière MAJ | Statut |
|---------|--------|-----------|--------------|--------|
| `README.md` | ~400 | Documentation principale | 2026-01-01 | ✅ À jour |
| `CLAUDE.md` | 294 | Instructions agents | Non daté | ✅ À conserver racine |
| `DEVELOPMENT_GUIDE.md` | 744 | Guide développement | 2025-12-31 | ⚠️ À migrer `docs/guides/` |
| `DEVELOPMENT_STATUS.md` | 454 | Statut développement | 2025-12-31 | 🔴 DUPLICATE (50% frontend) |
| `DOCKER_PORTS.md` | 2154 | Guide Docker | 2026-01-01 | ⚠️ À migrer `docs/installation/` |
| `DOCS_INDEX.md` | 557 | Index documentation | 2026-01-01 | ⚠️ À devenir `docs/00-INDEX.md` |
| `DOCUMENTATION_COMPLETE.md` | ~300 | Rapport doc | 2026-01-01 | 🔴 ARCHIVE (rapport mission) |
| `INSTALL_DEV.md` | ~6600 | Installation dev | 2026-01-01 | ⚠️ À migrer `docs/installation/` |
| `INSTALL_PROD.md` | ~11000 | Installation prod | 2026-01-01 | ⚠️ À migrer `docs/installation/` |
| `LIVRAISON_FINALE.md` | ~500 | Livraison | 2025-12-31 | 🔴 OBSOLETE (30% frontend) |
| `LIVRAISON_MVP_100.md` | ~800 | Livraison finale | 2026-01-01 | ✅ SOURCE VÉRITÉ |
| `MVP_COMPLET.md` | ~200 | Synthèse MVP | 2026-01-01 | 🔴 DUPLICATE |
| `PROJECT_STATUS_FINAL.md` | ~300 | Statut projet | 2025-12-31 | 🔴 OBSOLETE (30% frontend) |

### Fichiers backend/ (1 fichier)

| Fichier | Lignes | Catégorie | Dernière MAJ | Statut |
|---------|--------|-----------|--------------|--------|
| `backend/CHECKPOINT_MODULES_6-8.md` | 782 | Checkpoint backend | 2025-12-31 | 🔴 À migrer `docs/archive/` |

### Fichiers de checkpoints racine (4 fichiers)

| Fichier | Lignes | Catégorie | Dernière MAJ | Statut |
|---------|--------|-----------|--------------|--------|
| `CHECKPOINT_BACKEND_FINAL.md` | 832 | Checkpoint backend | 2025-12-31 | 🔴 À migrer `docs/archive/` |
| `CHECKPOINT_FRONTEND_FINAL.md` | 759 | Checkpoint frontend | 2025-12-31 | 🔴 À migrer `docs/archive/` |
| `CHECKPOINT_FRONTEND_PHASE1.md` | 630 | Checkpoint frontend | 2025-12-31 | 🔴 À migrer `docs/archive/` |
| `CHECKPOINT_MODULES_1-4.md` | 394 | Checkpoint backend | 2025-12-31 | 🔴 À migrer `docs/archive/` |

### Fichiers docs/ (9 fichiers)

| Fichier | Lignes | Catégorie | Dernière MAJ | Statut |
|---------|--------|-----------|--------------|--------|
| `docs/cahier-des-charges.md` | ~2000 | Spécifications | Non daté | ⚠️ À migrer `docs/business/` |
| `docs/roadmap.md` | ~300 | Roadmap | Non daté | ⚠️ À migrer `docs/status/` |
| `docs/PLAN_FRONTEND.md` | ~500 | Plan frontend | Non daté | ⚠️ À migrer `docs/guides/` ou archive |
| `docs/architecture/tech-stack.md` | ~800 | Architecture | Non daté | ✅ Bien placé |
| `docs/architecture/database-schema.md` | ~1200 | Architecture | Non daté | ✅ Bien placé |
| `docs/decisions/adr-001-stack-typescript.md` | ~150 | ADR | 2024-12-XX | ✅ Bien placé |
| `docs/decisions/adr-002-multi-tenant-rls.md` | ~150 | ADR | 2024-12-XX | ✅ Bien placé |
| `docs/decisions/adr-003-auth-oidc-hybrid.md` | ~150 | ADR | 2024-12-XX | ✅ Bien placé |
| `docs/decisions/adr-004-rbac-casbin.md` | ~150 | ADR | 2024-12-XX | ✅ Bien placé |
| `docs/decisions/adr-005-cicd-gitlab.md` | ~150 | ADR | 2024-12-XX | ✅ Bien placé |

### Fichiers frontend/ (2 fichiers)

| Fichier | Lignes | Catégorie | Dernière MAJ | Statut |
|---------|--------|-----------|--------------|--------|
| `frontend/README.md` | ~200 | Doc frontend | 2026-01-01 | ✅ Bien placé |
| `frontend/public/ICONS_README.md` | ~100 | Doc icons PWA | 2026-01-01 | ✅ Bien placé |

---

## 🔍 PROBLÈMES DÉTECTÉS

### 1. 🔴 DUPLICATIONS MAJEURES - Statut du projet

**Fichiers concernés :**
- `DEVELOPMENT_STATUS.md` (2025-12-31) → **Backend 100%, Frontend 0%**
- `PROJECT_STATUS_FINAL.md` (2025-12-31) → **Backend 100%, Frontend 30%**
- `LIVRAISON_FINALE.md` (2025-12-31) → **Backend 100%, Frontend 30%**
- `LIVRAISON_MVP_100.md` (2026-01-01) → **Backend 100%, Frontend 100% ✅**
- `MVP_COMPLET.md` (2026-01-01) → **Backend 100%, Frontend 100%**

**Inconsistance :**
5 fichiers décrivant l'état du projet avec des pourcentages différents et des dates différentes !

**Impact :**
- Confusion totale sur l'état réel du projet
- Nouveau développeur ne sait pas quelle source croire
- Chef de projet voit des infos contradictoires

**Recommandation :**
- **CONSERVER UNIQUEMENT** : `LIVRAISON_MVP_100.md` (version la plus récente et complète)
- **ARCHIVER** : `LIVRAISON_FINALE.md`, `PROJECT_STATUS_FINAL.md` (historique 30% frontend)
- **FUSIONNER** : `MVP_COMPLET.md` → contenu dans `LIVRAISON_MVP_100.md`
- **TRANSFORMER** : `DEVELOPMENT_STATUS.md` → devenir `docs/status/PROJECT_STATUS.md` (source de vérité)

---

### 2. 🔴 DUPLICATIONS - Checkpoints backend

**Fichiers concernés :**
- `CHECKPOINT_MODULES_1-4.md` (racine)
- `backend/CHECKPOINT_MODULES_6-8.md` (dossier backend)
- `CHECKPOINT_BACKEND_FINAL.md` (racine)

**Problème :**
Checkpoints backend dispersés dans 2 dossiers différents, pas de cohérence de nommage.

**Recommandation :**
- **CRÉER** : `docs/archive/backend/`
- **MIGRER** : Tous les checkpoints backend vers ce dossier
- **RENOMMER** :
  - `CHECKPOINT_MODULES_1-4.md` → `backend-checkpoint-phase1.md`
  - `CHECKPOINT_MODULES_6-8.md` → `backend-checkpoint-phase2.md`
  - `CHECKPOINT_BACKEND_FINAL.md` → `backend-checkpoint-final.md`

---

### 3. 🔴 DUPLICATIONS - Checkpoints frontend

**Fichiers concernés :**
- `CHECKPOINT_FRONTEND_PHASE1.md` (racine)
- `CHECKPOINT_FRONTEND_FINAL.md` (racine)

**Problème :**
Checkpoints frontend à la racine au lieu d'être archivés.

**Recommandation :**
- **CRÉER** : `docs/archive/frontend/`
- **MIGRER** :
  - `CHECKPOINT_FRONTEND_PHASE1.md` → `frontend-checkpoint-phase1.md`
  - `CHECKPOINT_FRONTEND_FINAL.md` → `frontend-checkpoint-final.md`

---

### 4. ⚠️ FICHIERS MAL PLACÉS - Guides

**Fichiers concernés :**
- `INSTALL_DEV.md` (racine) → devrait être dans `docs/installation/`
- `INSTALL_PROD.md` (racine) → devrait être dans `docs/installation/`
- `DOCKER_PORTS.md` (racine) → devrait être dans `docs/installation/`
- `DEVELOPMENT_GUIDE.md` (racine) → devrait être dans `docs/guides/`

**Recommandation :**
- **CRÉER** : `docs/installation/` et `docs/guides/`
- **MIGRER** : Tous les guides vers ces dossiers
- **METTRE À JOUR** : Tous les liens dans README.md et autres fichiers

---

### 5. ⚠️ FICHIER INDEX MAL PLACÉ

**Fichier concerné :**
- `DOCS_INDEX.md` (racine) → devrait être `docs/00-INDEX.md`

**Problème :**
L'index de documentation devrait être DANS le dossier docs/ pour cohérence.

**Recommandation :**
- **DÉPLACER** : `DOCS_INDEX.md` → `docs/00-INDEX.md`
- **METTRE À JOUR** : Liens dans README.md

---

### 6. ⚠️ DATES INCONSISTANTES

**Problèmes détectés :**
- Certains fichiers datés de **2025-12-31** (backend 100%, frontend 30%)
- D'autres datés de **2026-01-01** (backend 100%, frontend 100%)
- ADR datés de **2024-12-XX** (placeholder générique)

**Impact :**
Confusion sur la timeline réelle du développement.

**Recommandation :**
- **STANDARDISER** : Toutes les dates au format `YYYY-MM-DD`
- **AJOUTER** : "Dernière mise à jour" dans TOUS les fichiers
- **CORRIGER** : ADR avec dates réelles ou "Date : Phase 1 Backend"

---

### 7. ⚠️ FICHIERS SANS DATE

**Fichiers concernés :**
- `CLAUDE.md` - Pas de date
- `docs/cahier-des-charges.md` - Pas de date
- `docs/roadmap.md` - Pas de date
- `docs/PLAN_FRONTEND.md` - Pas de date
- Tous les ADR - Dates placeholder "2024-12-XX"

**Recommandation :**
Ajouter "**Dernière mise à jour :** YYYY-MM-DD" en haut de chaque fichier.

---

### 8. 🟡 LIENS CASSÉS (potentiels)

**À vérifier :**
- README.md référence `docs/architecture/tech-stack.md` ✅
- README.md référence `INSTALL_DEV.md` ✅ (mais sera déplacé)
- DOCS_INDEX.md référence tous fichiers (liens relatifs) ✅

**Action après migration :**
- **VÉRIFIER** tous les liens après déplacement des fichiers
- **CRÉER** script `scripts/check-docs.sh` pour valider liens

---

## 📋 PLAN DE MIGRATION DÉTAILLÉ

### Phase 1 : Créer nouvelle structure

```bash
# Créer tous les dossiers
mkdir -p docs/installation
mkdir -p docs/guides
mkdir -p docs/status
mkdir -p docs/archive/backend
mkdir -p docs/archive/frontend
mkdir -p docs/archive/livraisons
mkdir -p docs/business
```

### Phase 2 : Déplacer fichiers (avec renommage si nécessaire)

#### A. Installation → docs/installation/
```bash
# Déplacer guides installation
mv INSTALL_DEV.md docs/installation/
mv INSTALL_PROD.md docs/installation/
mv DOCKER_PORTS.md docs/installation/
```

#### B. Guides → docs/guides/
```bash
# Déplacer guides développement
mv DEVELOPMENT_GUIDE.md docs/guides/
mv docs/PLAN_FRONTEND.md docs/guides/  # ou archiver si obsolète
```

#### C. Status → docs/status/
```bash
# Créer source de vérité unique
# FUSIONNER contenu de DEVELOPMENT_STATUS.md + dernières infos MVP
# dans un nouveau fichier docs/status/PROJECT_STATUS.md

# Déplacer roadmap
mv docs/roadmap.md docs/status/
```

#### D. Business → docs/business/
```bash
# Déplacer cahier des charges
mv docs/cahier-des-charges.md docs/business/
```

#### E. Archive checkpoints → docs/archive/
```bash
# Backend checkpoints
mv CHECKPOINT_MODULES_1-4.md docs/archive/backend/backend-checkpoint-phase1.md
mv backend/CHECKPOINT_MODULES_6-8.md docs/archive/backend/backend-checkpoint-phase2.md
mv CHECKPOINT_BACKEND_FINAL.md docs/archive/backend/backend-checkpoint-final.md

# Frontend checkpoints
mv CHECKPOINT_FRONTEND_PHASE1.md docs/archive/frontend/frontend-checkpoint-phase1.md
mv CHECKPOINT_FRONTEND_FINAL.md docs/archive/frontend/frontend-checkpoint-final.md

# Livraisons historiques
mv LIVRAISON_FINALE.md docs/archive/livraisons/livraison-30pct-frontend.md
mv PROJECT_STATUS_FINAL.md docs/archive/livraisons/status-30pct-frontend.md
mv DOCUMENTATION_COMPLETE.md docs/archive/livraisons/documentation-complete-rapport.md

# Garder seulement à la racine
# LIVRAISON_MVP_100.md (livraison finale)
# MVP_COMPLET.md (synthèse) - OU fusionner dans LIVRAISON_MVP_100
```

#### F. Index → docs/00-INDEX.md
```bash
# Déplacer index
mv DOCS_INDEX.md docs/00-INDEX.md
```

### Phase 3 : Créer source unique de vérité

**Créer `docs/status/PROJECT_STATUS.md`** :

```markdown
# XCH - Statut du Projet

**Dernière mise à jour :** 2026-01-01
**Version actuelle :** 1.0.0-MVP
**Statut global :** ✅ Production-Ready

## État d'avancement

### Backend
- **Statut :** 100% TERMINÉ
- **Modules :** 10/10 complets
- **Endpoints :** ~100 REST
- **Date fin :** 2025-12-31

### Frontend
- **Statut :** 100% TERMINÉ
- **Modules :** 7/7 complets
- **Pages :** 17 fonctionnelles
- **Date fin :** 2026-01-01

### Documentation
- **Statut :** 100% TERMINÉ
- **Guides :** Installation (dev + prod), Docker, Développement
- **Checkpoints :** Backend complet, Frontend complet
- **Date fin :** 2026-01-01

### Déploiement
- **Statut :** Production-Ready
- **Docker Compose :** ✅ Fonctionnel
- **Scripts :** Backups, monitoring, vérification ports
- **SSL/TLS :** Guide complet Let's Encrypt

## Historique des versions

### v1.0.0-MVP (2026-01-01)
- ✅ Backend 100%
- ✅ Frontend 100%
- ✅ Documentation complète
- ✅ PWA icons + manifest
- ✅ Toast notifications
- ✅ Error boundaries

### v0.3.0 (2025-12-31)
- ✅ Backend 100%
- ✅ Frontend 30% (auth + dashboard + sites)

## Prochaines étapes

**Post-MVP (v1.1+) :**
- Tests E2E automatisés (Playwright)
- Service Worker complet (mode offline)
- Dark mode
- i18n (FR/EN)

**Voir :** [docs/status/roadmap.md](roadmap.md)
```

### Phase 4 : Fusionner duplicates

**Option 1 - Conserver MVP_COMPLET.md séparé** :
- Garder `MVP_COMPLET.md` à la racine comme résumé technique rapide
- Garder `LIVRAISON_MVP_100.md` comme document de livraison complet

**Option 2 - Fusionner (recommandé)** :
- Fusionner `MVP_COMPLET.md` dans `LIVRAISON_MVP_100.md`
- Une seule source de vérité pour la livraison finale
- Supprimer `MVP_COMPLET.md`

### Phase 5 : Mettre à jour tous les liens

**Fichiers à modifier :**
- `README.md` :
  - `INSTALL_DEV.md` → `docs/installation/INSTALL_DEV.md`
  - `INSTALL_PROD.md` → `docs/installation/INSTALL_PROD.md`
  - `DOCKER_PORTS.md` → `docs/installation/DOCKER_PORTS.md`
  - `DOCS_INDEX.md` → `docs/00-INDEX.md`
  - Ajouter lien vers `docs/status/PROJECT_STATUS.md`

- `docs/00-INDEX.md` (ancien DOCS_INDEX.md) :
  - Mettre à jour tous les chemins relatifs

- `LIVRAISON_MVP_100.md` :
  - Vérifier liens vers documentation

### Phase 6 : Ajouter dates partout

Ajouter en haut de chaque fichier :

```markdown
**Dernière mise à jour :** YYYY-MM-DD
```

**Fichiers à modifier :**
- `CLAUDE.md` → Ajouter date création
- `docs/cahier-des-charges.md` → Ajouter date
- `docs/roadmap.md` → Ajouter date + dates de chaque phase
- `docs/PLAN_FRONTEND.md` → Ajouter date (ou archiver si obsolète)
- Tous les ADR → Remplacer "2024-12-XX" par dates réelles ou "Phase 1", "Phase 2", etc.

### Phase 7 : Créer script de vérification

**Créer `scripts/check-docs.sh`** :

```bash
#!/bin/bash

echo "=== Vérification de la documentation XCH ==="
echo ""

# 1. Vérifier liens cassés
echo "1. Vérification des liens..."
BROKEN_LINKS=0

# Liste tous fichiers .md
for file in $(find . -name "*.md" -type f); do
    # Extraire liens markdown [text](link.md)
    grep -oP '\]\(\K[^)]+(?=\))' "$file" 2>/dev/null | while read link; do
        # Ignorer URLs externes (http/https)
        if [[ ! "$link" =~ ^https?:// ]]; then
            # Vérifier si fichier existe (relatif au fichier actuel)
            dir=$(dirname "$file")
            if [ ! -f "$dir/$link" ] && [ ! -f "$link" ]; then
                echo "  ❌ Lien cassé dans $file : $link"
                ((BROKEN_LINKS++))
            fi
        fi
    done
done

if [ $BROKEN_LINKS -eq 0 ]; then
    echo "  ✅ Aucun lien cassé détecté"
else
    echo "  ⚠️  $BROKEN_LINKS lien(s) cassé(s) trouvé(s)"
fi

echo ""

# 2. Vérifier dates "Dernière mise à jour"
echo "2. Vérification des dates..."
MISSING_DATES=0

for file in $(find . -name "*.md" -type f -not -path "*/node_modules/*"); do
    if ! grep -q "Dernière mise à jour" "$file" && ! grep -q "Date.*:" "$file"; then
        echo "  ⚠️  Pas de date dans : $file"
        ((MISSING_DATES++))
    fi
done

if [ $MISSING_DATES -eq 0 ]; then
    echo "  ✅ Tous les fichiers ont une date"
else
    echo "  ⚠️  $MISSING_DATES fichier(s) sans date"
fi

echo ""

# 3. Vérifier structure docs/
echo "3. Vérification structure dossiers..."
REQUIRED_DIRS=(
    "docs/installation"
    "docs/guides"
    "docs/status"
    "docs/archive"
    "docs/business"
    "docs/architecture"
    "docs/decisions"
)

MISSING_DIRS=0
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "  ⚠️  Dossier manquant : $dir"
        ((MISSING_DIRS++))
    fi
done

if [ $MISSING_DIRS -eq 0 ]; then
    echo "  ✅ Tous les dossiers requis existent"
fi

echo ""
echo "=== Fin de la vérification ==="
```

---

## 📊 STRUCTURE FINALE PROPOSÉE

```
XCH/
├── README.md                          ✅ Vue d'ensemble + liens
├── CLAUDE.md                          ✅ Instructions agents
├── LIVRAISON_MVP_100.md              ✅ Livraison finale (source vérité)
│
├── docs/
│   ├── 00-INDEX.md                   ← Déplacé depuis DOCS_INDEX.md
│   │
│   ├── installation/                 ← NOUVEAU DOSSIER
│   │   ├── INSTALL_DEV.md            ← Déplacé depuis racine
│   │   ├── INSTALL_PROD.md           ← Déplacé depuis racine
│   │   └── DOCKER_PORTS.md           ← Déplacé depuis racine
│   │
│   ├── guides/                       ← NOUVEAU DOSSIER
│   │   ├── DEVELOPMENT_GUIDE.md      ← Déplacé depuis racine
│   │   └── API_GUIDE.md              ← Optionnel (à créer si besoin)
│   │
│   ├── status/                       ← NOUVEAU DOSSIER
│   │   ├── PROJECT_STATUS.md         ← NOUVEAU (source unique vérité)
│   │   ├── ROADMAP.md                ← Déplacé depuis docs/roadmap.md
│   │   └── CHANGELOG.md              ← À créer
│   │
│   ├── architecture/                 ✅ Déjà bon
│   │   ├── tech-stack.md
│   │   └── database-schema.md
│   │
│   ├── decisions/                    ✅ Déjà bon
│   │   ├── adr-001-stack-typescript.md
│   │   ├── adr-002-multi-tenant-rls.md
│   │   ├── adr-003-auth-oidc-hybrid.md
│   │   ├── adr-004-rbac-casbin.md
│   │   └── adr-005-cicd-gitlab.md
│   │
│   ├── business/                     ← NOUVEAU DOSSIER
│   │   └── CAHIER_DES_CHARGES.md     ← Déplacé depuis docs/
│   │
│   └── archive/                      ← NOUVEAU DOSSIER
│       ├── backend/
│       │   ├── backend-checkpoint-phase1.md
│       │   ├── backend-checkpoint-phase2.md
│       │   └── backend-checkpoint-final.md
│       ├── frontend/
│       │   ├── frontend-checkpoint-phase1.md
│       │   └── frontend-checkpoint-final.md
│       └── livraisons/
│           ├── livraison-30pct-frontend.md
│           ├── status-30pct-frontend.md
│           └── documentation-complete-rapport.md
│
├── frontend/
│   ├── README.md                     ✅ Doc frontend
│   └── public/
│       └── ICONS_README.md           ✅ Doc PWA icons
│
├── backend/
│   └── (pas de .md)                  ✅ Checkpoints déplacés
│
└── scripts/
    └── check-docs.sh                 ← NOUVEAU script vérification
```

---

## ✅ CHECKLIST DE MIGRATION

### Préparation
- [ ] Créer branche Git `docs-reorganization`
- [ ] Sauvegarder état actuel (`git commit -am "Backup avant réorganisation docs"`)

### Création structure
- [ ] Créer dossier `docs/installation/`
- [ ] Créer dossier `docs/guides/`
- [ ] Créer dossier `docs/status/`
- [ ] Créer dossier `docs/archive/backend/`
- [ ] Créer dossier `docs/archive/frontend/`
- [ ] Créer dossier `docs/archive/livraisons/`
- [ ] Créer dossier `docs/business/`

### Déplacements
- [ ] Déplacer `INSTALL_DEV.md` → `docs/installation/`
- [ ] Déplacer `INSTALL_PROD.md` → `docs/installation/`
- [ ] Déplacer `DOCKER_PORTS.md` → `docs/installation/`
- [ ] Déplacer `DEVELOPMENT_GUIDE.md` → `docs/guides/`
- [ ] Déplacer `docs/roadmap.md` → `docs/status/`
- [ ] Déplacer `docs/cahier-des-charges.md` → `docs/business/`
- [ ] Déplacer `DOCS_INDEX.md` → `docs/00-INDEX.md`

### Archives
- [ ] Archiver `CHECKPOINT_MODULES_1-4.md` → `docs/archive/backend/backend-checkpoint-phase1.md`
- [ ] Archiver `backend/CHECKPOINT_MODULES_6-8.md` → `docs/archive/backend/backend-checkpoint-phase2.md`
- [ ] Archiver `CHECKPOINT_BACKEND_FINAL.md` → `docs/archive/backend/backend-checkpoint-final.md`
- [ ] Archiver `CHECKPOINT_FRONTEND_PHASE1.md` → `docs/archive/frontend/frontend-checkpoint-phase1.md`
- [ ] Archiver `CHECKPOINT_FRONTEND_FINAL.md` → `docs/archive/frontend/frontend-checkpoint-final.md`
- [ ] Archiver `LIVRAISON_FINALE.md` → `docs/archive/livraisons/livraison-30pct-frontend.md`
- [ ] Archiver `PROJECT_STATUS_FINAL.md` → `docs/archive/livraisons/status-30pct-frontend.md`
- [ ] Archiver `DOCUMENTATION_COMPLETE.md` → `docs/archive/livraisons/documentation-complete-rapport.md`

### Fusion/Suppression
- [ ] Décider : Fusionner `MVP_COMPLET.md` dans `LIVRAISON_MVP_100.md` OU conserver séparé
- [ ] Créer `docs/status/PROJECT_STATUS.md` (source unique vérité)

### Mise à jour contenu
- [ ] Ajouter "Dernière mise à jour" dans `CLAUDE.md`
- [ ] Ajouter dates dans `docs/business/CAHIER_DES_CHARGES.md`
- [ ] Ajouter dates dans `docs/status/ROADMAP.md`
- [ ] Corriger dates ADR (remplacer "2024-12-XX")
- [ ] Ajouter dates dans `docs/guides/PLAN_FRONTEND.md` (si conservé)

### Mise à jour liens
- [ ] Mettre à jour tous liens dans `README.md`
- [ ] Mettre à jour tous liens dans `docs/00-INDEX.md`
- [ ] Mettre à jour liens dans `LIVRAISON_MVP_100.md`
- [ ] Vérifier liens dans frontend/README.md

### Scripts et vérification
- [ ] Créer `scripts/check-docs.sh`
- [ ] Rendre exécutable : `chmod +x scripts/check-docs.sh`
- [ ] Lancer vérification : `./scripts/check-docs.sh`
- [ ] Corriger tous liens cassés détectés

### Finalisation
- [ ] Créer `MIGRATION_DOCS.md` avec log des changements
- [ ] Commit : `git commit -am "docs: réorganisation complète documentation"`
- [ ] Tester installation dev avec nouveau guide
- [ ] Tester tous liens dans README
- [ ] Merger branche dans main

---

## 📝 TEMPLATE MIGRATION_DOCS.md

```markdown
# MIGRATION_DOCS.md - Log de Réorganisation Documentation

**Date :** 2026-01-01
**Auteur :** Équipe XCH
**Objectif :** Réorganiser documentation pour éliminer duplications et clarifier structure

---

## Changements appliqués

### Fichiers déplacés

| Ancien chemin | Nouveau chemin | Raison |
|---------------|----------------|--------|
| `INSTALL_DEV.md` | `docs/installation/INSTALL_DEV.md` | Regroupement guides installation |
| `INSTALL_PROD.md` | `docs/installation/INSTALL_PROD.md` | Regroupement guides installation |
| `DOCKER_PORTS.md` | `docs/installation/DOCKER_PORTS.md` | Regroupement guides installation |
| `DEVELOPMENT_GUIDE.md` | `docs/guides/DEVELOPMENT_GUIDE.md` | Regroupement guides développement |
| `docs/roadmap.md` | `docs/status/ROADMAP.md` | Regroupement statut projet |
| `docs/cahier-des-charges.md` | `docs/business/CAHIER_DES_CHARGES.md` | Séparation docs business |
| `DOCS_INDEX.md` | `docs/00-INDEX.md` | Index doit être dans docs/ |

### Fichiers archivés

| Ancien chemin | Nouveau chemin | Raison |
|---------------|----------------|--------|
| `CHECKPOINT_MODULES_1-4.md` | `docs/archive/backend/backend-checkpoint-phase1.md` | Checkpoint historique |
| `backend/CHECKPOINT_MODULES_6-8.md` | `docs/archive/backend/backend-checkpoint-phase2.md` | Checkpoint historique |
| `CHECKPOINT_BACKEND_FINAL.md` | `docs/archive/backend/backend-checkpoint-final.md` | Checkpoint historique |
| `CHECKPOINT_FRONTEND_PHASE1.md` | `docs/archive/frontend/frontend-checkpoint-phase1.md` | Checkpoint historique |
| `CHECKPOINT_FRONTEND_FINAL.md` | `docs/archive/frontend/frontend-checkpoint-final.md` | Checkpoint historique |
| `LIVRAISON_FINALE.md` | `docs/archive/livraisons/livraison-30pct-frontend.md` | Version obsolète (30% frontend) |
| `PROJECT_STATUS_FINAL.md` | `docs/archive/livraisons/status-30pct-frontend.md` | Version obsolète (30% frontend) |
| `DOCUMENTATION_COMPLETE.md` | `docs/archive/livraisons/documentation-complete-rapport.md` | Rapport mission archivé |

### Fichiers créés

| Fichier | Description |
|---------|-------------|
| `docs/status/PROJECT_STATUS.md` | Source unique de vérité pour état projet |
| `scripts/check-docs.sh` | Script vérification liens et structure |
| `MIGRATION_DOCS.md` | Ce fichier (log migration) |

### Fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| `README.md` | Mise à jour tous liens vers docs/ |
| `docs/00-INDEX.md` | Mise à jour chemins relatifs |
| `CLAUDE.md` | Ajout date "Dernière mise à jour" |
| Tous ADR | Correction dates "2024-12-XX" |

### Fichiers supprimés/fusionnés

| Fichier | Action | Raison |
|---------|--------|--------|
| `MVP_COMPLET.md` | ❓ À décider | Fusionner dans LIVRAISON_MVP_100.md ou conserver |
| `DEVELOPMENT_STATUS.md` | Transformé | Contenu fusionné dans docs/status/PROJECT_STATUS.md |

---

## Impact sur utilisateurs

### Développeurs
- **Changement** : Guides installation déplacés dans `docs/installation/`
- **Action** : Mettre à jour bookmarks vers nouveaux chemins
- **Avantage** : Documentation mieux organisée, plus facile à trouver

### DevOps
- **Changement** : `INSTALL_PROD.md` déplacé
- **Action** : Vérifier scripts déploiement qui référencent la doc
- **Avantage** : Tous guides installation au même endroit

### Nouveaux arrivants
- **Changement** : Index documentation déplacé dans `docs/00-INDEX.md`
- **Action** : Commencer par README.md qui pointe vers docs/00-INDEX.md
- **Avantage** : Chemin clair : README → docs/00-INDEX → guides spécifiques

---

## Vérifications post-migration

- [x] Tous liens dans README.md valides
- [x] Script check-docs.sh passe sans erreurs
- [x] Installation dev fonctionne avec nouveau guide
- [x] Installation prod fonctionne avec nouveau guide
- [x] Toutes dates ajoutées
- [x] Aucun duplicate restant

---

## Rollback

En cas de problème, restaurer depuis commit précédent :

```bash
git log --oneline | head -5
git reset --hard <commit-id-avant-migration>
```

---

**Migration terminée avec succès ✅**
**Date fin :** 2026-01-01
```

---

## 🎯 RECOMMANDATIONS FINALES

### Actions immédiates (Priorité 1)

1. **Créer `docs/status/PROJECT_STATUS.md`** - Source unique de vérité
2. **Archiver tous checkpoints** - Libérer racine projet
3. **Déplacer guides installation** - Dans `docs/installation/`
4. **Créer script `check-docs.sh`** - Automatiser validation

### Actions importantes (Priorité 2)

5. **Fusionner ou supprimer `MVP_COMPLET.md`** - Éviter duplication avec LIVRAISON_MVP_100
6. **Ajouter dates partout** - Traçabilité modifications
7. **Mettre à jour tous liens** - README, index, livraisons
8. **Créer MIGRATION_DOCS.md** - Tracer changements

### Actions recommandées (Priorité 3)

9. **Créer CHANGELOG.md** - Historique versions
10. **Standardiser noms de fichiers** - Kebab-case vs UPPER_CASE
11. **Ajouter badges README** - Statut build, coverage, version
12. **Documentation API** - Si pas déjà dans Swagger

---

## ✅ RÉSULTAT ATTENDU

Après migration complète :

### Structure claire
```
docs/
├── 00-INDEX.md                 (navigation principale)
├── installation/               (TOUS les guides install)
├── guides/                     (TOUS les guides dev)
├── status/                     (SOURCE VÉRITÉ état projet)
├── architecture/               (décisions techniques)
├── decisions/                  (ADR)
├── business/                   (specs fonctionnelles)
└── archive/                    (checkpoints, anciennes versions)
```

### Bénéfices
- ✅ **1 seule source de vérité** pour état projet
- ✅ **Zéro duplication** de contenu
- ✅ **Navigation logique** (installation → guides → status)
- ✅ **Dates partout** (traçabilité)
- ✅ **Liens vérifiés** (script automatique)
- ✅ **Historique préservé** (archive/ au lieu de supprimer)

---

**✅ AUDIT COMPLET TERMINÉ**
**📅 Date :** 2026-01-01
**🎯 Action suivante :** Valider plan avec utilisateur avant exécution
