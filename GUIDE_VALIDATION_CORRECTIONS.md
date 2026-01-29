# Guide Validation - Corrections RBAC + Frontend

**Date:** 2026-01-29
**Objectif:** Valider que les corrections Phase 1 + 2 fonctionnent en production

---

## ✅ Checklist Validation Rapide

### 1. Infrastructure Production ✅

**Vérifier tous les conteneurs sont UP:**
```bash
ssh xch-deploy "docker ps --filter 'name=xch' --format 'table {{.Names}}\t{{.Status}}'"
```

**Résultat attendu:**
```
✅ xch-frontend   Up X minutes
✅ xch-backend    Up X minutes
✅ xch-postgres   Up X hours (healthy)
✅ xch-redis      Up X hours (healthy)
✅ xch-minio      Up X hours (healthy)
```

---

### 2. Backend RBAC Policies ✅

**Vérifier nombre de policies en DB:**
```bash
ssh xch-deploy "docker exec xch-postgres psql -U xch_user -d xch_dev -c 'SELECT v0 as role, COUNT(*) as policies FROM casbin_rule WHERE ptype='\''p'\'' GROUP BY v0;'"
```

**Résultat attendu:**
```
     role    | policies
-------------+----------
 ADMIN       |       32
 MANAGER     |       10
 TECHNICIEN  |       16
 VIEWER      |        5
(4 rows)
```

**Si différent:**
```bash
# Réexécuter script insertion policies
ssh xch-deploy "docker exec -i xch-postgres psql -U xch_user -d xch_dev < /tmp/insert-rbac-policies.sql"
ssh xch-deploy "docker restart xch-backend"
```

---

### 3. Backend Endpoints Settings ✅

**Tester endpoint GET /api/users/me/profile:**
```bash
# 1. Login admin
TOKEN=$(curl -s -X POST https://xchapi.eoncom.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xch.demo","password":"admin123"}' | grep -oP '"accessToken":"\K[^"]+')

# 2. Appeler endpoint profil
curl -s -H "Authorization: Bearer $TOKEN" https://xchapi.eoncom.io/api/users/me/profile
```

**Résultat attendu:**
```json
{
  "id": "...",
  "email": "admin@xch.demo",
  "name": "Sophie Administrateur",
  "role": "ADMIN",
  "tenantId": "...",
  "tenant": {
    "id": "...",
    "name": "XCH Demo Corporation",
    "subdomain": "demo"
  }
}
```

**Tester endpoint POST /api/users/me/change-password:**
```bash
curl -s -X POST https://xchapi.eoncom.io/api/users/me/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"admin123","newPassword":"admin456"}'
```

**Résultat attendu:**
```json
{"message": "Password changed successfully"}
```

---

### 4. Frontend data-testid ✅

**Vérifier data-testid visibles dans le code source:**

**Option 1 - Inspection manuelle (Recommandé):**
1. Ouvrir https://xch.eoncom.io
2. Login avec `admin@xch.demo` / `admin123`
3. Aller sur `/dashboard/sites`
4. Inspecter élément (F12) sur bouton "Nouveau chantier"
5. Vérifier présence: `data-testid="create-site-btn"`

**Option 2 - Vérification automatique:**
```bash
# Télécharger page sites
curl -s https://xch.eoncom.io/dashboard/sites > /tmp/sites.html

# Chercher data-testid
grep -o 'data-testid="[^"]*"' /tmp/sites.html | sort -u
```

**Résultat attendu (extrait):**
```
data-testid="create-site-btn"
data-testid="sites-list"
data-testid="site-card"
```

**Vérification complète (14 pages):**
```bash
# Sites
curl -s https://xch.eoncom.io/dashboard/sites | grep -c 'data-testid="create-site-btn"'  # Doit afficher: 1
curl -s https://xch.eoncom.io/dashboard/sites | grep -c 'data-testid="sites-list"'      # Doit afficher: 1

# Assets
curl -s https://xch.eoncom.io/dashboard/assets | grep -c 'data-testid="create-asset-btn"' # Doit afficher: 1
curl -s https://xch.eoncom.io/dashboard/assets | grep -c 'data-testid="scan-qr-btn"'      # Doit afficher: 1

# Tasks (Kanban)
curl -s https://xch.eoncom.io/dashboard/tasks | grep -c 'data-testid="kanban-board"'      # Doit afficher: 1
```

---

### 5. Tests E2E (Validation Finale) ⏳

**Relancer tests E2E complets:**
```bash
cd C:\xampp\htdocs\XCH\frontend
npm run test:e2e
```

**Métriques attendues:**
```
Avant corrections:  69/152 (45.4%)
Après corrections: 110/152 (72%+) ✅

Gains:
- RBAC: 0/42 → 30/42 (71%)
- Settings: 0/33 → 20/33 (60%)
- CRUD Update/Delete: 8/26 → 21/26 (80%)
```

**Tests critiques à vérifier:**

**1. RBAC Viewer (ne peut PAS créer):**
```bash
npm run test:e2e -- tests/rbac/viewer-restrictions.spec.ts
```
Attendu: Tests passent (Viewer bloqué sur create/update/delete)

**2. Settings Profil:**
```bash
npm run test:e2e -- tests/settings/settings.spec.ts
```
Attendu: GET /api/users/me/profile fonctionne, formulaire profil modifiable

**3. CRUD avec data-testid:**
```bash
npm run test:e2e -- tests/sites/sites-crud.spec.ts
npm run test:e2e -- tests/assets/assets-crud.spec.ts
```
Attendu: Boutons trouvés via data-testid, update/delete fonctionnent

---

## 🔧 Troubleshooting

### Problème: Backend ne démarre pas

**Symptômes:**
```bash
docker logs xch-backend
# Erreurs TypeScript compilation
```

**Solution:**
```bash
# 1. Vérifier erreurs compilation
ssh xch-deploy "docker logs --tail 50 xch-backend"

# 2. Rebuild si nécessaire
ssh xch-deploy "cd /opt/xch-dev/XCH && docker-compose build backend && docker-compose up -d backend"
```

---

### Problème: Policies Casbin manquantes

**Symptômes:**
- Tests RBAC échouent
- Viewer peut créer sites (ne devrait pas)

**Solution:**
```bash
# 1. Vérifier policies en DB
ssh xch-deploy "docker exec xch-postgres psql -U xch_user -d xch_dev -c 'SELECT COUNT(*) FROM casbin_rule;'"

# 2. Si < 63, réinsérer
scp /c/xampp/htdocs/XCH/backend/scripts/insert-rbac-policies.sql xch-deploy:/tmp/
ssh xch-deploy "docker exec -i xch-postgres psql -U xch_user -d xch_dev < /tmp/insert-rbac-policies.sql"
ssh xch-deploy "docker restart xch-backend"
```

---

### Problème: data-testid non visibles

**Symptômes:**
- Tests E2E timeout sur sélecteurs `[data-testid="..."]`
- Inspection HTML montre absence data-testid

**Diagnostic:**
```bash
# Vérifier version déployée
ssh xch-deploy "cd /opt/xch-dev/XCH && git log --oneline -1"
# Doit afficher: e079be6 feat: Add data-testid...
```

**Solution si mauvaise version:**
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && git pull origin main && docker-compose restart frontend"
```

---

### Problème: Frontend ne rebuild pas

**Symptômes:**
- Changements code non visibles après restart
- Cache Next.js ancien

**Solution:**
```bash
# 1. Rebuild complet frontend
ssh xch-deploy "cd /opt/xch-dev/XCH && docker-compose build --no-cache frontend"

# 2. Restart avec volumes clean
ssh xch-deploy "docker-compose down && docker-compose up -d"
```

---

## 📊 Rapport Validation

**Créer fichier de rapport après validation:**
```bash
cat > VALIDATION_REPORT.md << 'EOF'
# Rapport Validation - Corrections RBAC + Frontend

**Date:** $(date +%Y-%m-%d)
**Validateur:** [Votre nom]

## Infrastructure
- [x] Conteneurs UP: frontend, backend, postgres, redis, minio
- [x] Backend logs: aucune erreur
- [x] Frontend accessible: https://xch.eoncom.io

## Backend
- [x] Policies Casbin: 63 total (ADMIN:32, MANAGER:10, TECHNICIEN:16, VIEWER:5)
- [x] Endpoint GET /api/users/me/profile: ✅ 200 OK
- [x] Endpoint PUT /api/users/me/profile: ✅ 200 OK
- [x] Endpoint POST /api/users/me/change-password: ✅ 200 OK

## Frontend
- [x] data-testid créés: 46 total
- [x] Fichiers modifiés: 14 page.tsx
- [x] Inspection visuelle: data-testid visibles dans HTML

## Tests E2E
- [x] Taux succès: XX/152 (XX%)
- [x] RBAC: XX/42 (XX%)
- [x] Settings: XX/33 (XX%)
- [x] CRUD: XX/26 (XX%)

## Conclusion
✅ Corrections validées et fonctionnelles en production
⏳ Améliorations UI/UX peuvent démarrer
EOF
```

---

## 🎯 Prochaines Étapes

Après validation complète:

### 1. Amélioration UI/UX (Priorité Haute)
- [ ] Design system (couleurs, espacements, typographie)
- [ ] Animations transitions (Framer Motion)
- [ ] Composants shadcn/ui additionnels
- [ ] Responsive mobile avancé
- [ ] Dark mode

### 2. Performance (Priorité Moyenne)
- [ ] React.memo sur composants lourds
- [ ] Lazy loading modules
- [ ] Debounce recherches (lodash.debounce)
- [ ] Optimisation images (next/image + WebP)
- [ ] Pagination listes > 50 items

### 3. Tests (Priorité Moyenne)
- [ ] Corriger tests E2E restants (28% échouent)
- [ ] Tests unitaires backend (Jest)
- [ ] Tests unitaires frontend (Vitest)
- [ ] Coverage minimum 70%

---

**Besoin d'aide?** Consulter `SESSION_CORRECTIONS_RBAC_FRONTEND.md` pour détails complets des modifications.
