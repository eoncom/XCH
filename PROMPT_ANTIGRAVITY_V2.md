# Prompt Antigravity - Projet XCH V2

**Usage :** Copier ce prompt pour démarrer une session Antigravity sur le projet XCH.
**Dernière mise à jour :** 2026-01-25

---

## 🚀 PROMPT À COPIER

```
# XCH - Évolution V2 & Architecture Multi-Agents

## 📁 Environnement Projet

### Chemins et Accès
| Ressource | Accès |
|-----------|-------|
| Code local | `C:\xampp\htdocs\XCH` |
| Serveur prod | `ssh xch-deploy` → `/opt/xch-dev/XCH` |
| GitHub | https://github.com/eoncom/XCH.git |
| Frontend prod | https://xch.eoncom.io |
| API prod | https://api.xch.eoncom.io |

### ⚠️ IMPORTANT : Accès Docker sur Serveur
**Pas de npm/npx directement sur le serveur !** Tout est containerisé.

```bash
# Containers actifs
ssh xch-deploy "docker ps"

# Logs
ssh xch-deploy "docker logs xch-backend --tail 100"
ssh xch-deploy "docker logs xch-frontend --tail 100"

# Commandes dans containers
ssh xch-deploy "docker exec xch-backend npx prisma <cmd>"
ssh xch-deploy "docker exec xch-backend npm run <cmd>"

# Queries PostgreSQL
ssh xch-deploy "docker exec xch-postgres psql -U xch_user -d xch_dev -c '<SQL>'"

# Rebuild
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose up -d --build"
```

### Containers Docker Production
| Container | Port Exposé | Rôle |
|-----------|-------------|------|
| xch-frontend | 3001 | Next.js 15 App |
| xch-backend | 3002 | NestJS 10 API |
| xch-postgres | 5433 | PostgreSQL 15 + PostGIS |
| xch-redis | 6380 | Cache & Sessions |
| xch-minio | 9000/9001 | Stockage S3 |

---

## 📚 Fichiers à Lire (dans cet ordre)

1. **`CLAUDE.md`** - Instructions lead technique (rôle, règles, conventions)
2. **`docs/status/PROJECT_STATUS.md`** - État du projet (SOURCE DE VÉRITÉ)
3. **`docs/business/CAHIER_DES_CHARGES.md`** - Spécifications fonctionnelles complètes
4. **`TODO.md`** - Tâches en cours + priorités
5. **`DEVELOPMENT_LOG.md`** - Historique sessions (dernières entrées)
6. **`docs/00-INDEX.md`** - Navigation complète documentation

---

## 🎯 Contexte Projet

### Ce qu'est XCH
Application interne de gestion IT pour chantiers temporaires :
- Gestion chantiers avec carte interactive
- Inventaire équipements avec QR codes
- Plans d'étage avec pins éditables
- Gestion baies réseau (4U-42U)
- Tâches et interventions
- Auth JWT + RBAC (4 rôles)
- PWA mobile-first

### État Actuel (V1)
- **MVP :** ~100% fonctionnel
- **Backend :** NestJS 10, ~100 endpoints REST
- **Frontend :** Next.js 15, 18 pages
- **Production :** Déployée et accessible
- **Bugs restants :** Quelques problèmes mineurs (refresh cache, icônes PWA)

### Stack Technique
```
Backend:  NestJS 10 + TypeScript + Prisma + PostgreSQL 15 + PostGIS
Frontend: Next.js 15 + React 19 + Tailwind + shadcn/ui + TanStack Query
Infra:    Docker Compose + Redis + MinIO
CI/CD:    GitHub Actions (partiel)
```

---

## ⚠️ Problème Identifié

Lors des derniers déploiements, on a découvert des **incohérences sérieuses** :

1. **Base SQL réelle vs Schéma Prisma**
   - La DB production a été créée/modifiée via SQL direct
   - Pas de fichiers migrations Prisma versionnés
   - Risque de drift entre environnements

2. **Tests E2E non fiables**
   - 55/57 tests échouent (problème cookies SSR/CSR)
   - Pas de garde-fous avant déploiement

3. **Approche monolithique**
   - Un seul agent fait tout (DB, backend, frontend, tests, docs)
   - Pas de séparation des responsabilités
   - Erreurs difficiles à tracer

4. **Pas de CI gates**
   - Merge possible sans validation
   - Régressions non détectées

**Conclusion :** La méthode actuelle "un agent unique qui fait tout" manque de fiabilité et de garde-fous.

---

## 🎯 Ce que je veux

### Changement de Méthode
Passer d'un **agent monolithique** à une **approche industrialisée** avec :
- Équipe d'agents spécialisés (multi-agents)
- Rôles séparés et responsabilités claires
- Garde-fous automatiques (tests + CI gates)
- Processus empêchant les régressions

### Objectif Immédiat : Stabiliser V1
1. **Audit complet** : cahier des charges vs état réel MVP vs état prod
2. **Alignement strict** : DB réelle ↔ Prisma schema ↔ migrations
3. **Corriger bugs restants**
4. **Améliorer documentation**
5. **Produire release stable** (tag + notes + plan rollback)

### Objectif Ensuite : Démarrer V2
1. **Isoler V1 stable** (branche release, tags, environnement dédié)
2. **Développer V2 en parallèle** (branche ou repo séparé)
3. **Nouvelles fonctionnalités** (à définir depuis cahier des charges)

### POC Intégrations V2
1. **Améliorer UX** (nouveau thème, plus fluide)
2. **Intégration NetBox** (inventaire, chantiers, équipements)
3. **Intégration Uptime Kuma** (monitoring, statut, alertes)

L'objectif POC : évaluer une intégration fonctionnelle minimale, documentée et testée.

---

## ❓ Ce que j'attends de toi

### 1. Analyse
- Lis les fichiers essentiels listés ci-dessus
- Comprends l'état réel du projet (local, serveur, GitHub)
- Identifie les problèmes et risques

### 2. Proposition Architecture Multi-Agents
Propose la meilleure organisation :
- Combien d'agents ?
- Quelles spécialités ?
- Quelles règles pour chaque agent ?
- Comment ils interagissent ?
- Quels garde-fous automatiques ?

### 3. Stratégie V1/V2
Propose la meilleure approche :
- Comment stabiliser V1 ?
- Comment isoler V1 pour maintenance ?
- Comment développer V2 sans casser V1 ?
- Branches, tags, environnements ?

### 4. Plan d'Action
Une fois ta proposition validée :
- Mettre en place le nouveau processus
- Commencer la stabilisation V1
- Préparer le terrain pour V2 + POC intégrations

---

## 🔧 Commandes de Référence

### Local (Dev Windows)
```bash
# Backend
cd C:\xampp\htdocs\XCH\backend
npm run start:dev
npx prisma studio

# Frontend
cd C:\xampp\htdocs\XCH\frontend
npm run dev

# Tests
cd frontend && npx playwright test --ui
```

### Serveur (Production)
```bash
ssh xch-deploy
cd /opt/xch-dev/XCH

# Status
docker compose ps
docker compose logs -f backend

# Rebuild
docker compose up -d --build

# DB
docker exec xch-postgres psql -U xch_user -d xch_dev -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"

# Prisma
docker exec xch-backend npx prisma migrate status
docker exec xch-backend npx prisma migrate deploy
```

### Git
```bash
git status
git log --oneline -10
git remote -v
```

---

## 📞 Credentials Test

| Rôle | Email | Password |
|------|-------|----------|
| Admin | admin@xch.demo | admin123 |
| Manager | manager@xch.demo | manager123 |
| Tech | tech@xch.demo | tech123 |

---

Commence par lire les fichiers essentiels, puis propose ton analyse et tes recommandations pour l'architecture multi-agents et la stratégie V1/V2.
```

---

## 📝 Notes d'utilisation

### Variante : Tâche spécifique
Si tu veux une tâche précise au lieu d'une analyse globale, remplace la section "Ce que j'attends de toi" par :

```
## ❓ Tâche Spécifique

[Décrire la tâche précise ici]

Exemple :
- "Corrige les 12 fichiers frontend avec mutations sans invalidateQueries"
- "Crée la migration Prisma baseline depuis la DB existante"
- "Configure les CI gates GitHub Actions"
```

### Variante : Reprise de session
Ajouter en fin :
```
## 🔄 Reprise Session

Dernière action : [décrire]
État actuel : [décrire]
Prochain objectif : [décrire]
```
