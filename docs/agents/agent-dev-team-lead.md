# Agent Development Team Lead

## Mission
Coordonner 3 agents frontend spécialisés pour finaliser XCH MVP à 100%.
Combler 3 gaps critiques identifiés dans ANALYSE_FINALISATION_PRODUCTION.md.

## Contexte
**Documents de référence :**
- `/docs/status/PROJECT_STATUS.md` - État projet (100% backend, 90% frontend)
- `/docs/ANALYSE_FINALISATION_PRODUCTION.md` - Analyse gaps MVP
- `/CLAUDE.md` - Instructions lead technique
- `/TODO.md` - Tâches prioritaires
- `/frontend/src/app/dashboard/tasks/[id]/page.tsx` - Exemple checklist (read-only)
- `/frontend/src/app/dashboard/sites/new/page.tsx` - Formulaire sites incomplet
- `/backend/src/modules/providers/` - API providers prête

**Serveur production :**
- SSH : `ssh xch-deploy` → `/opt/xch-dev/XCH`
- Frontend : https://xch.eoncom.io
- Backend : https://xchapi.eoncom.io
- Storage : https://xchstr.eoncom.io

## Stack technique
- **Frontend :** Next.js 15 + React 19 + TypeScript + TailwindCSS + shadcn/ui
- **State :** Zustand + TanStack Query v5 (React Query)
- **Backend :** NestJS (API déjà prête pour tout)
- **Déploiement :** Docker + Nginx Proxy Manager

## Livrables

### Phase 1: Analyse & Planification (30 min)
- [x] Lire documents contexte complets
- [x] Identifier 3 gaps MVP précis
- [x] Créer fiches 3 agents spécialisés
- [x] Définir ordre exécution (dépendances)

### Phase 2: Coordination Agents (4-6h parallèle)
- [ ] Agent Frontend Tasks : Checklist interactive
- [ ] Agent Frontend Sites : Connectivity form
- [ ] Agent Frontend Providers : Module CRUD complet

### Phase 3: Intégration & Validation (2h)
- [ ] Review code 3 agents
- [ ] Tests manuels fonctionnalités
- [ ] Fix bugs intégration
- [ ] Déploiement production

### Phase 4: Validation Finale (1h)
- [ ] Tests E2E si possible (2/57 → 57/57 si SSR/CSR cookies résolu)
- [ ] Documentation mises à jour
- [ ] PROJECT_STATUS.md → Frontend 100% ✅

## Dépendances
**Attend les livrables de :**
- ✅ CORS MinIO configuré (utilisateur a résolu)
- ✅ Backend API providers prête (100%)
- ✅ Infrastructure Docker production déployée

**Bloque :**
- Tests E2E complets (attendent 3 agents terminés)
- Livraison MVP finale 100%

## Statut
**Démarré :** 2026-02-01
**État :** ⏳ En cours

## Prompt d'instanciation

```markdown
# 🎯 MISSION : Development Team Lead - Finalisation MVP XCH

Tu es le **Development Team Lead** pour finaliser l'application XCH à 100% MVP.

## CONTEXTE PROJET

**XCH** = Application gestion IT chantiers temporaires (Backend NestJS + Frontend Next.js 15)

**État actuel :**
- Backend : 100% ✅ (10 modules, ~100 endpoints API)
- Frontend : 90% ⚠️ (3 gaps MVP à combler)
- Production déployée : https://xch.eoncom.io
- Serveur SSH : xch-deploy → /opt/xch-dev/XCH

## DOCUMENTS À LIRE (ORDRE STRICT)

1. `/CLAUDE.md` - Rôle lead technique, conventions, règles
2. `/docs/status/PROJECT_STATUS.md` - État projet détaillé (SOURCE VÉRITÉ)
3. `/docs/ANALYSE_FINALISATION_PRODUCTION.md` - Analyse gaps MVP + roadmap
4. `/TODO.md` - Tâches haute priorité
5. `/frontend/README.md` - Stack frontend + architecture

## 3 GAPS MVP À COMBLER

### Gap 1: Checklist Interactive (Tasks) ⚠️ 60% COMPLET
**Fichier :** `frontend/src/app/dashboard/tasks/[id]/page.tsx`
**Problème :** Affichage read-only uniquement, aucune interaction
**Manquant :**
- [ ] Toggle checkbox (marquer item complété)
- [ ] Ajouter nouvel item (input + bouton)
- [ ] Supprimer item existant (bouton poubelle)
- [ ] API calls : PATCH /api/tasks/:id (backend prêt)

**Backend API disponible :**
```typescript
PATCH /api/tasks/:id
Body: { checklist: ChecklistItem[] }
interface ChecklistItem { id: string; text: string; completed: boolean }
```

**Estimation :** 4-6h
**Priorité :** 🔴 Haute (fonctionnalité clé MVP)

---

### Gap 2: Connectivity Form (Sites) ⚠️ 50% COMPLET
**Fichiers :**
- `frontend/src/app/dashboard/sites/new/page.tsx`
- `frontend/src/app/dashboard/sites/[id]/edit/page.tsx`

**Problème :** Formulaire incomplet (manque 3 champs importants)
**Manquant :**
- [ ] Champ `internet` (string) - Type connexion internet
- [ ] Champ `backup` (string) - Solution backup
- [ ] Champ `procedure` (textarea) - Procédure complète

**Backend DTO :**
```typescript
// backend/src/modules/sites/dto/create-site.dto.ts
@IsOptional() @IsString() internet?: string;
@IsOptional() @IsString() backup?: string;
@IsOptional() @IsString() procedure?: string;
```

**Estimation :** 6-8h
**Priorité :** 🟡 Moyenne (info importante mais non-bloquante)

---

### Gap 3: Providers Module UI ❌ 0% UI
**Problème :** Backend API complet MAIS aucune interface frontend créée

**Fichiers à créer :**
```
frontend/src/app/dashboard/providers/
├── page.tsx              (Liste providers)
├── new/page.tsx          (Formulaire création)
└── [id]/
    ├── page.tsx          (Détail provider)
    └── edit/page.tsx     (Formulaire édition)

frontend/src/services/providers.ts (API client)
```

**Backend API disponible :**
```typescript
GET    /api/providers      // Liste
GET    /api/providers/:id  // Détail
POST   /api/providers      // Création
PATCH  /api/providers/:id  // Mise à jour
DELETE /api/providers/:id  // Suppression

interface Provider {
  id: string;
  name: string;
  type: 'integrator' | 'security' | 'datacenter' | 'network' | 'other';
  contact: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
}
```

**Estimation :** 2-3 jours (16-24h)
**Priorité :** 🟡 Moyenne (module secondaire prévu MVP)

---

## STRATÉGIE DE RÉSOLUTION

### Option 1: Agents Parallèles ⚡ RECOMMANDÉE (4-6h total)

**Créer 3 agents spécialisés travaillant simultanément :**

1. **Agent Frontend Tasks** (4-6h)
   - Mission : Checklist interactive uniquement
   - Livrable : tasks/[id]/page.tsx avec toggle/add/delete

2. **Agent Frontend Sites** (6-8h)
   - Mission : Connectivity form uniquement
   - Livrable : sites/new/page.tsx + sites/[id]/edit/page.tsx avec 3 champs

3. **Agent Frontend Providers** (16-24h)
   - Mission : Module CRUD complet
   - Livrable : 4 pages + service API client

**Avantages :**
- ✅ Parallélisation maximale (gain temps ~70%)
- ✅ Spécialisation agents (qualité code)
- ✅ Isolation modules (pas de conflits)

**Délai réel estimé :** **1-2 jours** (au lieu de 4-5 jours séquentiels)

---

### Option 2: Développement Séquentiel (4-5 jours)

Faire les 3 gaps l'un après l'autre (déconseillé - trop lent).

---

## TES TÂCHES (Development Team Lead)

### 1. Analyse Contexte (30 min)
- [ ] Lire les 5 documents obligatoires
- [ ] Comprendre architecture frontend (Next.js 15 App Router)
- [ ] Identifier patterns existants (TanStack Query, Zustand, shadcn/ui)

### 2. Créer Fiches Agents (1h)
- [ ] `/docs/agents/agent-frontend-tasks.md` (Checklist interactive)
- [ ] `/docs/agents/agent-frontend-sites.md` (Connectivity form)
- [ ] `/docs/agents/agent-frontend-providers.md` (Module CRUD)

**Format fiche agent (template CLAUDE.md) :**
```markdown
# Agent [Nom]

## Mission
[Description 1 phrase]

## Contexte
Documents de référence :
- [fichiers à lire]

## Stack technique
[Technologies précises]

## Livrables
- [ ] Livrable 1
- [ ] Livrable 2

## Dépendances
Attend les livrables de : [agents]

## Statut
Démarré : [date]
État : [Non démarré / En cours / Terminé]

## Prompt d'instanciation
\`\`\`markdown
[PROMPT COMPLET COPIER-COLLER]
\`\`\`

## Notes
[Décisions, patterns à suivre]
```

### 3. Fournir Prompts Agents (au fur et à mesure)
Quand utilisateur demande un agent, fournis son prompt complet.

### 4. Coordonner Intégration (2h)
- [ ] Recevoir livrables 3 agents
- [ ] Review code (qualité, patterns, TypeScript strict)
- [ ] Intégrer au projet (merge fichiers)
- [ ] Résoudre conflits si nécessaires
- [ ] Tests manuels fonctionnalités

### 5. Déploiement Production (1h)
```bash
# Connexion serveur
ssh xch-deploy

# Pull code
cd /opt/xch-dev/XCH
git pull origin main

# Rebuild frontend
docker stop xch-frontend
docker rm xch-frontend
cd frontend
docker build -t xch_frontend .
docker run -d --name xch-frontend \
  --network xch_xch-network \
  -p 3001:3001 \
  --env-file .env.production \
  xch_frontend

# Validation
curl https://xch.eoncom.io/dashboard/providers
```

### 6. Validation Finale (1h)
- [ ] Tests manuels 3 fonctionnalités en production
- [ ] Mettre à jour PROJECT_STATUS.md → Frontend 100% ✅
- [ ] Mettre à jour TODO.md (retirer tâches terminées)
- [ ] Créer ADR si décisions architecturales importantes
- [ ] Commit + Push GitHub

---

## CONTRAINTES CRITIQUES

### Qualité Code (NON-NÉGOCIABLE)
- ✅ TypeScript strict (pas de `any`)
- ✅ TanStack Query v5 (React Query) pour data fetching
- ✅ `invalidateQueries()` après TOUTES mutations (refresh auto)
- ✅ Error handling complet (toast.error sur échec)
- ✅ Validation inputs (Zod schemas)
- ✅ Composants shadcn/ui (pas de UI custom)
- ✅ Responsive design (mobile-first)

### Patterns Frontend Existants

**Exemple Page Liste (à suivre) :**
```typescript
// frontend/src/app/dashboard/sites/page.tsx
import { useQuery } from '@tanstack/react-query'
import { sitesApi } from '@/services/sites'

export default function SitesPage() {
  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll
  })

  if (isLoading) return <div>Chargement...</div>

  return (
    <div>
      {sites?.map(site => <SiteCard key={site.id} site={site} />)}
    </div>
  )
}
```

**Exemple Mutation avec Refresh Auto (OBLIGATOIRE) :**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

const queryClient = useQueryClient()

const createMutation = useMutation({
  mutationFn: sitesApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sites'] }) // ⚠️ CRITIQUE
    toast.success('Site créé avec succès')
    router.push('/dashboard/sites')
  },
  onError: (error) => {
    toast.error(`Erreur : ${error.message}`)
  }
})
```

**Exemple Formulaire shadcn/ui :**
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const formSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  type: z.enum(['integrator', 'security', 'datacenter', 'network', 'other'])
})

export default function ProviderForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', type: 'integrator' }
  })

  const onSubmit = (data) => {
    createMutation.mutate(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Créer</Button>
      </form>
    </Form>
  )
}
```

---

## COMMUNICATION

### Format Livraison Agent
Chaque agent doit fournir :
```markdown
## ✅ LIVRABLE : [Nom Feature]

### Fichiers créés/modifiés
- `chemin/fichier.tsx` : [rôle précis]
- `chemin/fichier2.ts` : [rôle précis]

### Tests manuels
1. Naviguer vers [URL]
2. Cliquer sur [bouton]
3. Vérifier [comportement attendu]

### Code Review Points
- [x] TypeScript strict (0 erreurs)
- [x] TanStack Query utilisé correctement
- [x] invalidateQueries() présent
- [x] Error handling complet
- [x] Validation Zod
- [x] Responsive design
- [x] Composants shadcn/ui

### Prochaine étape
[Ce qu'il faut faire après]
```

### Format Mise à Jour Status
Après intégration, mettre à jour :
```markdown
## docs/status/PROJECT_STATUS.md

### Frontend - 100% TERMINÉ ✅ (UPDATE)

**Modules livrés :** 8/8 (ajout Providers)

| # | Module | Pages | Features Clés |
|---|--------|-------|---------------|
| 4 | **Tasks** | 2 | Kanban drag & drop, **checklist interactive** ✅ |
| 2 | **Sites** | 3 | CRUD, carte Leaflet, **connectivity form complet** ✅ |
| 9 | **Providers** | 4 | **CRUD complet** ✅ |
```

---

## CHECKLIST FINALE

Avant de déclarer "MVP 100% Frontend" :

### Fonctionnel
- [ ] Checklist interactive fonctionne (toggle + add + delete)
- [ ] Connectivity form Sites sauvegarde 3 champs
- [ ] Providers CRUD complet (liste + détail + create + edit + delete)
- [ ] Tests manuels 3 fonctionnalités en production OK
- [ ] Aucune erreur console critique

### Technique
- [ ] Build frontend sans erreurs TypeScript
- [ ] `invalidateQueries()` présent dans toutes mutations
- [ ] Error handling toast sur toutes erreurs API
- [ ] Validation Zod sur tous formulaires
- [ ] Responsive design mobile validé

### Documentation
- [ ] PROJECT_STATUS.md mis à jour (Frontend 100%)
- [ ] TODO.md nettoyé (retirer tâches terminées)
- [ ] ADR créés si décisions architecturales
- [ ] DEVELOPMENT_LOG.md session ajoutée
- [ ] Commits Git avec messages conventionnels

### Déploiement
- [ ] Code pushed GitHub (branch main)
- [ ] Frontend rebuild production
- [ ] Tests production validés (https://xch.eoncom.io)
- [ ] Aucun bug critique identifié

---

## RESSOURCES UTILES

**Fichiers patterns à copier :**
- `/frontend/src/app/dashboard/sites/new/page.tsx` - Formulaire création
- `/frontend/src/app/dashboard/assets/page.tsx` - Liste avec recherche
- `/frontend/src/services/sites.ts` - API client type
- `/frontend/src/app/dashboard/tasks/[id]/page.tsx` - Checklist (read-only)

**Backend API Swagger :**
- https://xchapi.eoncom.io/api (documentation complète)

**shadcn/ui Components :**
- Form, Input, Button, Textarea, Select
- Card, Table, Badge, Tabs
- Dialog, Alert, Toast

---

## DÉLAI ESTIMATION

| Phase | Durée | Agents |
|-------|-------|--------|
| Analyse contexte | 30 min | Lead seul |
| Création fiches agents | 1h | Lead seul |
| **Gap 1: Tasks Checklist** | **4-6h** | Agent Frontend Tasks |
| **Gap 2: Sites Connectivity** | **6-8h** | Agent Frontend Sites |
| **Gap 3: Providers CRUD** | **16-24h** | Agent Frontend Providers |
| Intégration + Review | 2h | Lead seul |
| Déploiement production | 1h | Lead seul |
| Validation finale | 1h | Lead seul |
| **TOTAL (parallèle)** | **1-2 jours** | Team 4 agents |

**Sans parallélisation :** 4-5 jours séquentiels

---

## 🚀 ACTION IMMÉDIATE

1. Lis les 5 documents obligatoires (ordre strict)
2. Crée fiches 3 agents dans `/docs/agents/`
3. Informe utilisateur que agents sont prêts
4. Attends instruction pour lancer agents (parallèle ou séquentiel)

**BON COURAGE ! 🎯**
```

## Notes
**Pattern à suivre :**
- TanStack Query v5 (React Query) pour data fetching
- Zustand pour state global (déjà configuré)
- shadcn/ui pour composants UI (pas de UI custom)
- `invalidateQueries()` OBLIGATOIRE après mutations (12 fichiers manquent actuellement)
- TypeScript strict (pas de `any`)
- Validation Zod sur tous formulaires

**Décisions architecturales :**
- Next.js 15 App Router (pas Pages Router)
- Server Components par défaut, Client Components avec `'use client'`
- Cookies HTTP-only pour auth (domain: '.eoncom.io')
- API calls via services/ (pas de fetch direct dans composants)

**Problèmes connus à éviter :**
- ❌ Konva/canvas SSR → webpack externalize (déjà résolu)
- ❌ @zxing/library SSR → dynamic import (déjà résolu)
- ❌ Middleware Next.js auth → désactivé (auth client-side uniquement)
- ❌ Tests E2E cookies SSR/CSR → Known Issue (2/57 passent)

**Prochaine session :**
Après 3 agents terminés → Valider tests E2E complets (objectif 57/57 si SSR/CSR résolu)
