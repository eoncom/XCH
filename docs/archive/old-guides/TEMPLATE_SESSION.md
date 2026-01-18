# Templates de Session - XCH

**Dernière mise à jour :** 2026-01-03

Ce fichier contient des prompts templates pour démarrer rapidement de nouvelles sessions de développement avec Claude.

---

## 📝 MODE D'EMPLOI

### Avant de démarrer une session :

1. **Consulter l'état actuel :**
   ```bash
   # Lire ces 3 fichiers dans l'ordre :
   1. docs/status/PROJECT_STATUS.md  (source de vérité)
   2. TODO.md                         (backlog priorisé)
   3. DEVELOPMENT_LOG.md              (historique sessions)
   ```

2. **Choisir le template adapté :**
   - Développement local → Template 1
   - Serveur SSH → Template 2
   - Fix bug urgent → Template 3
   - Nouvelle feature → Template 4
   - Tests → Template 5
   - Optimisation → Template 6

3. **Copier le prompt et remplacer `[VARIABLES]`**

4. **Lancer la session**

---

## 🖥️ TEMPLATE 1 : Session développement local (Windows/WSL2)

**Contexte :** Développement quotidien sur machine locale.

```markdown
Projet XCH - Session développement local

**Contexte :**
- Machine : Windows 11 + WSL2 Ubuntu 24.04
- Repository : C:\xampp\htdocs\XCH
- Backend : http://localhost:3000
- Frontend : http://localhost:3001

**État actuel :**
Lis dans l'ordre :
1. docs/status/PROJECT_STATUS.md (source de vérité)
2. TODO.md (backlog)
3. DEVELOPMENT_LOG.md (dernière session)

**Mission :**
[DÉCRIRE LA TÂCHE ICI]

Exemples :
- "Corriger le bug PostgreSQL dans init.sql (xch_db → xch_dev)"
- "Ajouter tests E2E Playwright pour module Sites"
- "Optimiser performance page liste Assets (lazy loading)"
- "Créer jeu de données démo (seed.ts)"

**Instructions :**
1. Lis les 3 fichiers de contexte
2. Effectue la mission
3. Mets à jour DEVELOPMENT_LOG.md en fin de session
4. Mets à jour TODO.md (retirer tâche terminée)
5. Commit Git avec message conventionnel (feat/fix/docs/refactor/test/chore)

**Questions avant de commencer :**
- [POSER QUESTIONS CLARIFICATION SI NÉCESSAIRE]
```

**Quand utiliser :**
- Développement quotidien
- Bugs non-critiques
- Nouvelles features
- Refactoring
- Tests

---

## 🌐 TEMPLATE 2 : Session avec serveur SSH (Production/Staging)

**Contexte :** Déploiement ou debug sur serveur distant.

```markdown
Projet XCH - Session déploiement serveur

**Contexte serveur :**
- OS : [Ubuntu 24.04 / Debian 12 / CentOS 8]
- Accès : SSH [user@IP]
- Docker : [Version Docker installée]
- Repository : [Chemin clone Git]

**État actuel :**
Lis dans l'ordre :
1. docs/status/PROJECT_STATUS.md (source de vérité)
2. docs/installation/INSTALL_PROD.md (guide déploiement)
3. TODO.md (backlog)

**Mission :**
[DÉCRIRE LA TÂCHE ICI]

Exemples :
- "Déployer MVP XCH sur serveur Ubuntu (première fois)"
- "Débugger erreur PostgreSQL init.sql en production"
- "Configurer Nginx reverse proxy + SSL Let's Encrypt"
- "Tester performances production (100 utilisateurs simultanés)"

**Commandes SSH préliminaires :**
```bash
# Vérifier Docker
docker --version
docker-compose --version

# Vérifier ports disponibles
bash scripts/check-ports.sh

# Vérifier variables environnement
cat backend/.env | grep -v PASSWORD
```

**Instructions :**
1. Lis les 3 fichiers de contexte
2. Effectue la mission (prudence en production !)
3. Documente les problèmes rencontrés
4. Mets à jour DEVELOPMENT_LOG.md
5. Mets à jour TODO.md
6. Crée ADR si décision architecture (docs/decisions/adr-XXX.md)

**Sécurité :**
- JAMAIS `docker-compose down -v` en production (perte données)
- TOUJOURS backup avant modification DB
- TOUJOURS tester sur staging avant prod
```

**Quand utiliser :**
- Déploiement initial
- Mise à jour production
- Debug serveur distant
- Configuration infrastructure

---

## 🐛 TEMPLATE 3 : Fix bug urgent

**Contexte :** Bug bloquant détecté.

```markdown
Projet XCH - Fix bug urgent

**Bug détecté :**
[TITRE BUG]

**Symptômes :**
[DESCRIPTION PROBLÈME]

Exemples :
- "Erreur PostgreSQL au démarrage : database xch_db does not exist"
- "QR codes non générés (MinIO inaccessible)"
- "Crash frontend sur page FloorPlan viewer (canvas Konva)"
- "Session utilisateur expire immédiatement (refresh token)"

**Environnement :**
- [Développement local / Serveur staging / Production]
- Backend : [Version / Commit Git]
- Frontend : [Version / Commit Git]

**Logs d'erreur :**
```
[COLLER LOGS COMPLETS ICI]
```

**État actuel :**
Lis TODO.md (vérifier si bug déjà identifié)

**Instructions :**
1. Reproduire le bug localement
2. Analyser logs et identifier cause racine
3. Proposer fix (ne pas coder immédiatement)
4. Valider approche avec moi
5. Implémenter fix
6. Tester fix (cas nominal + edge cases)
7. Commit avec message : `fix: [description courte]`
8. Mettre à jour DEVELOPMENT_LOG.md
9. Retirer de TODO.md si présent

**Priorité :** URGENTE
```

**Quand utiliser :**
- Bug bloquant développement
- Bug production critique
- Régression détectée

---

## ✨ TEMPLATE 4 : Nouvelle feature

**Contexte :** Ajout fonctionnalité (hors MVP ou amélioration).

```markdown
Projet XCH - Nouvelle feature

**Feature demandée :**
[TITRE FEATURE]

**Description :**
[DESCRIPTION COMPLÈTE]

Exemples :
- "Ajouter export Excel pour liste Assets"
- "Implémenter dark mode (Tailwind + toggle Settings)"
- "Créer API webhook pour notifications externes"
- "Ajouter recherche full-text PostgreSQL (ts_vector)"

**Contexte business :**
[POURQUOI CETTE FEATURE EST NÉCESSAIRE]

**Utilisateurs impactés :**
- [Rôles : Admin / Manager / Technicien / Viewer]

**État actuel :**
Lis dans l'ordre :
1. docs/status/PROJECT_STATUS.md (vérifier si déjà planifié)
2. docs/business/CAHIER_DES_CHARGES.md (vérifier scope MVP)
3. TODO.md (vérifier backlog)

**Instructions :**
1. Vérifier si feature dans scope MVP (sinon → backlog TODO.md)
2. Proposer architecture technique (backend + frontend)
3. Estimer effort (heures/jours)
4. Demander validation approche
5. Implémenter feature (backend d'abord, puis frontend)
6. Tester manuellement (checklist complète)
7. Documenter API (Swagger) et composants React
8. Commit : `feat: [description]`
9. Créer ADR si décision technique importante
10. Mettre à jour DEVELOPMENT_LOG.md
11. Ajouter/retirer de TODO.md

**Critères d'acceptation :**
- [ ] [Critère 1]
- [ ] [Critère 2]
- [ ] [Critère 3]
```

**Quand utiliser :**
- Nouvelle fonctionnalité métier
- Amélioration UX
- Extension API

---

## 🧪 TEMPLATE 5 : Tests (unitaires/E2E)

**Contexte :** Ajout couverture tests.

```markdown
Projet XCH - Ajout tests

**Type tests :**
[Tests unitaires backend / Tests unitaires frontend / Tests E2E Playwright]

**Modules à tester :**
[LISTE MODULES]

Exemples :
- "Tests unitaires backend : Module Auth (stratégies Passport, refresh tokens)"
- "Tests unitaires frontend : Composants Kanban (drag & drop)"
- "Tests E2E : Parcours complet utilisateur (login → création site → ajout asset → QR code)"

**État actuel :**
Lis dans l'ordre :
1. docs/status/PROJECT_STATUS.md (actuellement 10% tests manuels)
2. TODO.md (vérifier backlog tests)

**Framework :**
- Backend : Jest
- Frontend : Vitest + React Testing Library
- E2E : Playwright

**Instructions :**
1. Installer dépendances si nécessaire
2. Créer fichiers tests (*.spec.ts)
3. Écrire tests critiques d'abord (auth, permissions, CRUD)
4. Viser coverage minimum 70%
5. Lancer tests : `npm run test`
6. Corriger code si tests échouent
7. Commit : `test: [module testé]`
8. Mettre à jour DEVELOPMENT_LOG.md
9. Mettre à jour TODO.md (retirer tâche)

**Checklist tests critiques :**
Backend :
- [ ] Auth : Login local + OIDC + refresh tokens
- [ ] RBAC : Vérification policies Casbin (4 rôles)
- [ ] QR codes : Génération + validation
- [ ] Overlap racks : Détection collision équipements
- [ ] Circuit breakers : Gestion erreurs API externes

Frontend :
- [ ] API Client : Auto-refresh JWT
- [ ] Kanban : Drag & drop tasks
- [ ] RackViewer : Montage équipements (Konva)
- [ ] FloorPlanViewer : Pins drag & drop
- [ ] Error boundaries : Gestion crashes React

E2E :
- [ ] Parcours : Login → Dashboard → Logout
- [ ] Parcours : Création site → Ajout asset → QR code scan
- [ ] Parcours : Création tâche → Assignation → Drag Kanban
```

**Quand utiliser :**
- Ajout tests automatisés
- Augmentation coverage
- Validation non-régression

---

## ⚡ TEMPLATE 6 : Optimisation performance

**Contexte :** Amélioration vitesse/mémoire.

```markdown
Projet XCH - Optimisation performance

**Zone à optimiser :**
[Backend / Frontend / Database / Infrastructure]

**Problème détecté :**
[DESCRIPTION LENTEUR]

Exemples :
- "Page liste Assets prend 5s à charger (100+ assets)"
- "Recherche sites sur carte prend 2s (PostGIS lent)"
- "Canvas Konva RackViewer lag sur drag équipement"
- "Requête DB Tasks avec 10 JOIN (N+1 queries)"

**Métriques actuelles :**
- Temps chargement : [Xs]
- Mémoire utilisée : [XMB]
- Requêtes DB : [X queries]

**Métriques cibles :**
- Temps chargement : [Xs] (amélioration [X%])
- Mémoire utilisée : [XMB] (réduction [X%])
- Requêtes DB : [X queries] (réduction [X%])

**État actuel :**
Lis docs/status/PROJECT_STATUS.md (section Performance)

**Instructions :**
1. Profiler l'application :
   - Frontend : React DevTools Profiler
   - Backend : NestJS Logger + timestamps
   - Database : EXPLAIN ANALYZE
2. Identifier goulots d'étranglement (top 3)
3. Proposer optimisations :
   - Frontend : React.memo, lazy loading, debounce
   - Backend : Cache Redis, index DB, pagination
   - Database : Index, requêtes optimisées, vacuum
4. Implémenter optimisations (1 par 1)
5. Mesurer impact (avant/après)
6. Documenter résultats
7. Commit : `perf: [zone optimisée]`
8. Mettre à jour DEVELOPMENT_LOG.md

**Optimisations possibles :**
Frontend :
- [ ] React.memo sur composants lourds (Kanban, RackViewer)
- [ ] Lazy loading pages (React.lazy + Suspense)
- [ ] Debounce recherches (lodash.debounce 300ms)
- [ ] Virtualisation listes longues (react-window)
- [ ] Optimisation images (next/image + WebP)

Backend :
- [ ] Cache Redis listes (TTL 5min)
- [ ] Pagination systématique (limit 50)
- [ ] Compression réponses (gzip)
- [ ] Index DB manquants (EXPLAIN queries lentes)
- [ ] Connection pooling PostgreSQL

Database :
- [ ] Index colonnes recherchées (WHERE, JOIN)
- [ ] Index GiST PostGIS (recherche géospatiale)
- [ ] Vacuum régulier (maintenance)
- [ ] Statistiques à jour (ANALYZE)
```

**Quand utiliser :**
- Lenteur détectée (UX dégradée)
- Montée en charge (scalabilité)
- Consommation mémoire/CPU excessive

---

## 📚 EXEMPLES TÂCHES COURANTES

### Exemple 1 : Corriger bug PostgreSQL init.sql

**Template utilisé :** Template 3 (Fix bug urgent)

**Prompt complet :**
```markdown
Projet XCH - Fix bug urgent

**Bug détecté :**
Erreur PostgreSQL au démarrage serveur

**Symptômes :**
Le conteneur PostgreSQL démarre mais les permissions échouent avec l'erreur :
```
ERROR: database "xch_db" does not exist
GRANT ALL PRIVILEGES ON DATABASE xch_db TO xch_user;
```

**Environnement :**
- Serveur Ubuntu 24.04 distant
- Backend : Commit c095f0b
- Docker Compose : backend/docker-compose.yml

**Logs d'erreur :**
```
postgres_1 | ERROR: database "xch_db" does not exist
postgres_1 | GRANT ALL PRIVILEGES ON DATABASE xch_db TO xch_user;
postgres_1 |                        ^^^^^^^
```

**État actuel :**
Lis TODO.md (vérifier si bug déjà identifié)

**Instructions :**
1. Reproduire le bug localement
2. Analyser logs et identifier cause racine
3. Proposer fix (ne pas coder immédiatement)
4. Valider approche avec moi
5. Implémenter fix
6. Tester fix (cas nominal + edge cases)
7. Commit avec message : `fix: PostgreSQL init.sql xch_db → xch_dev`
8. Mettre à jour DEVELOPMENT_LOG.md
9. Retirer de TODO.md

**Priorité :** URGENTE
```

---

### Exemple 2 : Ajouter tests E2E Playwright module Sites

**Template utilisé :** Template 5 (Tests)

**Prompt complet :**
```markdown
Projet XCH - Ajout tests

**Type tests :**
Tests E2E Playwright

**Modules à tester :**
Module Sites (liste, carte, détail, CRUD)

**État actuel :**
Lis dans l'ordre :
1. docs/status/PROJECT_STATUS.md (actuellement 10% tests manuels)
2. TODO.md (vérifier backlog tests)

**Framework :**
- E2E : Playwright

**Instructions :**
1. Installer Playwright (`npm install -D @playwright/test`)
2. Créer fichiers tests (`frontend/tests/e2e/sites.spec.ts`)
3. Écrire tests critiques :
   - Navigation liste sites
   - Recherche sites (nom, ville)
   - Création nouveau site
   - Édition site existant
   - Suppression site
   - Carte interactive (clustering, markers)
4. Lancer tests : `npx playwright test`
5. Corriger code si tests échouent
6. Commit : `test: E2E Playwright module Sites`
7. Mettre à jour DEVELOPMENT_LOG.md
8. Mettre à jour TODO.md (retirer tâche)

**Checklist tests E2E Sites :**
- [ ] Parcours : Login → Sites liste → Recherche "Paris" → Résultats affichés
- [ ] Parcours : Sites liste → Bouton "Nouveau" → Formulaire → Création → Redirection détail
- [ ] Parcours : Sites détail → Bouton "Éditer" → Modification nom → Sauvegarde → Toast succès
- [ ] Parcours : Sites détail → Bouton "Supprimer" → Confirmation → Suppression → Redirection liste
- [ ] Parcours : Sites carte → Zoom → Click marker → Popup affiché → Redirection détail
```

---

### Exemple 3 : Optimiser performance page liste Assets

**Template utilisé :** Template 6 (Optimisation)

**Prompt complet :**
```markdown
Projet XCH - Optimisation performance

**Zone à optimiser :**
Frontend - Page liste Assets

**Problème détecté :**
La page /assets prend 4-5s à charger avec 100+ assets.
Tous les QR codes sont générés au rendu initial (bloquant).

**Métriques actuelles :**
- Temps chargement : 4500ms
- Mémoire utilisée : 180MB
- Requêtes API : 1 (GET /assets)
- QR codes générés : 100+ simultanément

**Métriques cibles :**
- Temps chargement : <2000ms (amélioration 55%)
- Mémoire utilisée : <100MB (réduction 44%)
- QR codes : Lazy load au scroll

**État actuel :**
Lis docs/status/PROJECT_STATUS.md (section Performance)

**Instructions :**
1. Profiler React DevTools (identifier composants lents)
2. Identifier goulots :
   - Génération QR codes synchrone
   - Pas de pagination
   - Pas de virtualisation liste
3. Proposer optimisations :
   - Lazy load QR codes (générer seulement visible viewport)
   - Pagination (50 assets par page)
   - react-window (virtualisation liste)
4. Implémenter optimisations (1 par 1)
5. Mesurer impact (avant/après)
6. Documenter résultats
7. Commit : `perf: optimisation liste Assets (lazy QR + pagination)`
8. Mettre à jour DEVELOPMENT_LOG.md

**Optimisations à implémenter :**
- [ ] Lazy load QR codes (IntersectionObserver)
- [ ] Pagination backend + frontend (limit 50)
- [ ] Debounce recherche (300ms)
- [ ] React.memo composant AssetCard
- [ ] Virtualisation liste (react-window)
```

---

## 🔄 WORKFLOW SESSION TYPE

### Session courte (30min - 1h)
1. Lire TODO.md → choisir 1 tâche HAUTE priorité
2. Copier template adapté
3. Effectuer mission
4. Mettre à jour DEVELOPMENT_LOG.md (session brève)
5. Commit Git

### Session moyenne (2-3h)
1. Lire PROJECT_STATUS.md + TODO.md
2. Choisir 2-3 tâches liées
3. Copier template adapté
4. Effectuer missions séquentiellement
5. Mettre à jour DEVELOPMENT_LOG.md (session détaillée)
6. Mettre à jour TODO.md
7. Commit(s) Git

### Session longue (demi-journée/journée)
1. Lire PROJECT_STATUS.md + TODO.md + DEVELOPMENT_LOG.md
2. Planifier sprint (5-10 tâches)
3. Créer checklist dans TODO.md
4. Copier template adapté (ou combiner plusieurs)
5. Effectuer missions avec pauses
6. Mettre à jour DEVELOPMENT_LOG.md (session complète)
7. Mettre à jour TODO.md (cocher terminées)
8. Créer ADR si décisions architecture
9. Multiple commits Git (atomiques)

---

## 📋 CHECKLIST AVANT FIN SESSION

Toujours faire avant de terminer :

- [ ] Code committé Git (message conventionnel)
- [ ] DEVELOPMENT_LOG.md mis à jour (nouvelle entrée session)
- [ ] TODO.md mis à jour (retirer terminées, ajouter nouvelles)
- [ ] Tests manuels effectués (si applicable)
- [ ] Documentation mise à jour (si API/composants modifiés)
- [ ] Aucun console.log/debugger oublié
- [ ] Aucun TODO/FIXME dans code (ou issus GitHub créés)

---

## 🚀 RACCOURCIS UTILES

### Lancer environnement développement complet
```bash
# Terminal 1 : Infrastructure
cd backend
docker-compose up -d
docker-compose logs -f

# Terminal 2 : Backend
cd backend
npm run start:dev

# Terminal 3 : Frontend
cd frontend
npm run dev

# Terminal 4 : Prisma Studio (optionnel)
cd backend
npx prisma studio
```

### Vérifier état application
```bash
# Health checks
curl http://localhost:3000/api/health   # Backend
curl http://localhost:3001              # Frontend

# Status conteneurs Docker
cd backend
docker-compose ps

# Logs erreurs
docker-compose logs postgres | grep ERROR
docker-compose logs redis | grep ERROR
docker-compose logs minio | grep ERROR
```

### Reset complet développement
```bash
# ATTENTION : Supprime toutes données locales !
cd backend
docker-compose down -v
rm -rf dist/ node_modules/
npm install
npx prisma generate
npx prisma migrate reset --skip-seed
npx prisma db seed
npm run start:dev
```

---

**Dernière mise à jour :** 2026-01-03
**Mainteneur :** Équipe XCH
**Version :** 1.0
