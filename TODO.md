# TODO - Backlog XCH

**Dernière mise à jour :** 2026-01-03
**Version :** 1.0.0-MVP

Ce fichier centralise toutes les tâches à effectuer, organisées par priorité.

## 🔥 URGENT (Blocage - À faire MAINTENANT)

_Aucune tâche urgente actuellement._

**Dernière tâche résolue :**
- ✅ Fix PostgreSQL init.sql (2026-01-03, Session 4) - `xch_db` → `xch_dev` corrigé

---

## ⚡ HAUTE PRIORITÉ (Cette semaine)

### Tester déploiement serveur Ubuntu
**Priorité :** Haute
**Impact :** Validation production
**Estimation :** 2-3h
**Dépend de :** ✅ Fix init.sql (résolu)

**Actions :**
1. ✅ Corriger init.sql (fait Session 4)
2. Push corrections sur repository Git
3. Pull sur serveur Ubuntu (192.168.0.13)
4. Lancer backend + frontend Docker Compose
5. Vérifier tous services opérationnels
6. Tester connectivité backend ↔ frontend
7. Valider génération QR codes (MinIO)
8. Tester recherche géospatiale (PostGIS)

**Checklist infrastructure :**
- [x] PostgreSQL démarre sans erreur
- [ ] Redis connecté
- [ ] MinIO accessible (http://192.168.0.13:9000)
- [ ] Backend répond (http://192.168.0.13:3000/api/health)
- [ ] Frontend accessible (http://192.168.0.13:3001)

**Checklist fonctionnalités :**
- [ ] Login fonctionnel
- [ ] Upload fichier OK (FloorPlans)
- [ ] QR codes générés correctement
- [ ] Recherche sites géospatiale OK

**Documentation :**
Suivre [docs/installation/INSTALL_PROD.md](docs/installation/INSTALL_PROD.md)

---

### Tests manuels complets 17 pages
**Priorité :** Haute
**Impact :** Validation fonctionnelle MVP
**Estimation :** 3-4h

**Checklist par page :**

**Dashboard (1 page) :**
- [ ] Stats affichées correctement (total sites, assets, tasks)
- [ ] Cartes métriques réactives
- [ ] Navigation menu latéral

**Sites (3 pages) :**
- [ ] Liste : affichage, recherche, pagination
- [ ] Carte : clustering, markers, popup
- [ ] Détail : tabs (infos, assets, racks, plans, tasks)
- [ ] CRUD : création, édition, suppression

**Assets (3 pages) :**
- [ ] Liste : affichage, recherche, filtres (type, status)
- [ ] Détail : QR code visible, download PNG
- [ ] Scanner QR : caméra PWA, redirection asset
- [ ] CRUD : création, édition, suppression

**Tasks (2 pages) :**
- [ ] Kanban : 3 colonnes (TODO, IN_PROGRESS, DONE)
- [ ] Drag & drop fonctionnel
- [ ] Checklist : ajout/suppression items, toggle état
- [ ] CRUD : création tâche, assignation, priorité

**Racks (3 pages) :**
- [ ] Liste : affichage baies par site
- [ ] Viewer : canvas Konva, équipements montés
- [ ] Mount/unmount : détection overlap, calcul U
- [ ] CRUD : création baie 4U-42U

**FloorPlans (3 pages) :**
- [ ] Liste : affichage plans par site
- [ ] Upload : PDF/PNG/JPG, preview, stockage MinIO
- [ ] Viewer : canvas Konva, zoom/pan, pins drag & drop
- [ ] Pins : 4 types (équipement, réseau, alerte, info)

**Settings (2 pages) :**
- [ ] Profil : édition nom/email
- [ ] Intégrations : NetBox/Uptime Kuma read-only

**Total :** 17 pages à valider

---

### Préparer données démo
**Priorité :** Haute
**Impact :** Démo utilisateurs
**Estimation :** 2h

**Objectif :**
Créer jeu de données réaliste pour présentation.

**Script seed à compléter :**
`backend/prisma/seed.ts`

**Données à créer :**
- 1 tenant "Acme Corp"
- 4 utilisateurs (1 admin, 1 manager, 2 techniciens)
- 10 sites répartis géographiquement (Paris, Lyon, Marseille, etc.)
- 50 assets variés (imprimantes, iPads, switchs, serveurs, visio)
- 5 baies avec équipements montés
- 10 plans d'étage (images génériques)
- 15 tâches (5 TODO, 5 IN_PROGRESS, 5 DONE)

**Commande :**
```bash
cd backend
npx prisma db seed
```

**Validation :**
- Backend : Vérifier données via Prisma Studio (http://localhost:5555)
- Frontend : Naviguer et voir données réalistes

---

## 📋 MOYENNE PRIORITÉ (Ce mois)

### Tests E2E Playwright
**Priorité :** Moyenne
**Impact :** Qualité code
**Estimation :** 1 semaine
**Status :** Hors MVP

**Actions :**
1. Installer Playwright
2. Configurer tests E2E (playwright.config.ts)
3. Créer tests critiques :
   - Auth : login/logout
   - Sites : CRUD complet
   - Assets : QR code génération
   - Tasks : Kanban drag & drop
   - Racks : Mount équipement
4. Intégrer CI/CD (GitLab)

**Référence :**
ADR-005 (docs/decisions/adr-005-cicd-pipeline.md)

---

### Optimisation performance
**Priorité :** Moyenne
**Impact :** UX
**Estimation :** 3-4 jours
**Status :** Hors MVP

**Zones identifiées :**
1. **Frontend :**
   - React.memo sur composants lourds (Kanban, RackViewer, FloorPlanViewer)
   - Lazy loading modules (React.lazy + Suspense)
   - Optimisation images (next/image + formats WebP)
   - Debounce recherches (lodash.debounce)

2. **Backend :**
   - Index DB manquants (vérifier EXPLAIN sur requêtes lentes)
   - Cache Redis pour listes (sites, assets)
   - Compression réponses API (gzip)
   - Pagination systématique (limit 50 par défaut)

**Métriques cibles :**
- Temps chargement pages < 2s (actuellement ~3s)
- Actions utilisateur < 500ms (actuellement ~1s)
- Recherche < 300ms (actuellement ~500ms)

---

### Screenshots application
**Priorité :** Moyenne
**Impact :** Documentation/Marketing
**Estimation :** 1h

**Objectif :**
Captures d'écran pour README.md et documentation.

**Pages à capturer :**
1. Dashboard (vue d'ensemble)
2. Carte sites (clustering)
3. Liste assets avec QR code
4. Kanban tasks (drag & drop)
5. Rack viewer (visualisation 2D)
6. FloorPlan viewer (pins interactifs)

**Stockage :**
`docs/screenshots/` (à créer)

**Format :**
- PNG haute résolution (1920x1080)
- Données démo anonymisées
- Noms fichiers descriptifs (dashboard.png, sites-map.png, etc.)

---

## 💡 BACKLOG (Post-MVP - Pas de deadline)

### Tests unitaires backend
**Priorité :** Basse
**Impact :** Maintenabilité
**Estimation :** 2 semaines

**Framework :** Jest
**Modules à tester :**
- Auth : Stratégies Passport, refresh tokens
- RBAC : Policies Casbin
- Services : Logic métier (QR codes, overlap racks, etc.)
- Intégrations : Circuit breakers NetBox/Uptime Kuma

**Cible :** Coverage 70%

---

### CI/CD GitLab
**Priorité :** Basse
**Impact :** DevOps
**Estimation :** 3-4 jours

**Pipeline défini dans ADR-005 :**
```yaml
stages:
  - test
  - build
  - deploy

test:
  - npm run test (backend + frontend)
  - npm run test:e2e

build:
  - docker build backend/frontend
  - push registry GitLab

deploy:staging:
  - auto (merge develop)

deploy:production:
  - manuel (tag Git)
```

---

### Monitoring production
**Priorité :** Basse
**Impact :** Observabilité
**Estimation :** 1 semaine

**Stack :**
- Prometheus (métriques)
- Grafana (dashboards)
- Loki (logs centralisés)
- Alerting Slack/Email

**Dashboards à créer :**
1. Infrastructure : CPU, RAM, Disk, Network
2. Application : Requêtes/s, latence P95/P99, errors
3. Business : Utilisateurs actifs, sites créés, tâches terminées
4. Base données : Connexions, queries lentes, cache hit rate

---

### Features post-MVP (Hors scope)

**Mode offline complet :**
- Service Worker
- IndexedDB local
- Sync différé

**Notifications push PWA :**
- Web Push API
- Notifications tâches assignées
- Alertes monitoring

**Dark mode :**
- Thème sombre Tailwind
- Toggle Settings
- Persistance localStorage

**i18n (FR/EN) :**
- react-i18next
- Extraction clés traduction
- Fallback FR par défaut

**Export Excel/CSV :**
- Librairie exceljs
- Export liste sites/assets/tasks
- Rapports planifiés

**SSO 2FA :**
- TOTP (Google Authenticator)
- SMS (Twilio)
- Email (backup codes)

**Multi-tenant actif :**
- Group Console (gestion multi-tenants)
- Dashboard aggrégé
- Isolation stricte (RLS PostgreSQL activé)

**API publique documentée :**
- OpenAPI 3.0 Swagger
- SDK clients (TypeScript, Python)
- Rate limiting par tenant
- Webhooks

---

## 📊 STATISTIQUES TODO

**Total tâches :** 14
- 🔥 Urgent : 0 (✅ PostgreSQL init.sql résolu)
- ⚡ Haute : 3
- 📋 Moyenne : 3
- 💡 Backlog : 8

**Estimation totale :**
- MVP haute priorité : ~7-9h
- Moyenne priorité : ~2-3 semaines
- Backlog complet : ~2-3 mois

---

## 🔄 MAINTENANCE FICHIER

**Ce fichier doit être mis à jour :**
- Après chaque session de développement
- Quand tâche terminée → retirer de la liste
- Quand nouveau problème détecté → ajouter en URGENT
- Quand nouvelle feature planifiée → ajouter en BACKLOG

**Synchroniser avec :**
- `DEVELOPMENT_LOG.md` (log sessions)
- `docs/status/PROJECT_STATUS.md` (source vérité)
- `docs/status/ROADMAP.md` (planning phases)

---

**Dernière révision :** 2026-01-03
**Mainteneur :** Équipe XCH
**Version :** 1.0
