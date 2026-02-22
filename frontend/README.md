# XCH Frontend

Application Next.js 15 pour la gestion IT de sites temporaires.

## 🚀 Stack Technique

- **Framework** : Next.js 15.1.3 (App Router)
- **React** : 19.0.0
- **TypeScript** : 5.7.2
- **Styling** : Tailwind CSS 3.4 + shadcn/ui
- **State Management** : Zustand 5.0
- **Data Fetching** : TanStack Query 5.62
- **Maps** : Leaflet + React Leaflet
- **Canvas** : Konva.js + React Konva
- **Forms** : React Hook Form + Zod
- **Icons** : Lucide React

## 📦 Installation

```bash
# Installer dépendances
npm install

# Copier variables environnement
cp .env.local.example .env.local

# Démarrer serveur développement
npm run dev
```

L'application sera disponible sur http://localhost:3001

## 🔧 Configuration

### Variables d'environnement (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=XCH
```

## 📂 Structure du projet

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Layout racine
│   │   ├── page.tsx            # Page d'accueil (redirect)
│   │   ├── login/              # Page login
│   │   └── dashboard/          # Dashboard (protégé)
│   │       ├── layout.tsx      # Layout avec sidebar
│   │       ├── page.tsx        # Dashboard principal
│   │       └── sites/          # Module Sites
│   │
│   ├── components/             # Composants React
│   │   └── ui/                 # Composants shadcn/ui
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── input.tsx
│   │
│   ├── lib/                    # Utilitaires
│   │   ├── api-client.ts       # Client API (JWT + refresh)
│   │   ├── api/                # Endpoints API
│   │   │   └── sites.ts
│   │   └── utils.ts            # Helpers
│   │
│   ├── stores/                 # Zustand stores
│   │   └── auth-store.ts       # Auth state
│   │
│   └── types/                  # TypeScript types
│       └── index.ts            # Types globaux
│
├── public/                     # Assets statiques
├── .env.local                  # Variables environnement
├── next.config.ts              # Config Next.js
├── tailwind.config.ts          # Config Tailwind
└── tsconfig.json               # Config TypeScript
```

## 🔐 Authentification

### Login local

```typescript
// Page login : /login
POST /auth/login
{
  "email": "admin@xch.local",
  "password": "admin"
}
```

### SSO / OIDC

Bouton "Se connecter avec SSO" sur page login redirige vers backend OIDC.

### Protection routes

Middleware vérifie token JWT. Redirection automatique vers `/login` si non authentifié.

## 📱 Modules implémentés

### Phase 1 (✅ Complété)

| Module | Statut | Routes |
|--------|--------|--------|
| **Auth** | ✅ | `/login` |
| **Dashboard** | ✅ | `/dashboard` |
| **Sites (liste)** | ✅ | `/dashboard/sites` |

### Phase 2 (⏳ À faire)

| Module | Statut | Routes |
|--------|--------|--------|
| **Sites (détails)** | ⏳ | `/dashboard/sites/[id]` |
| **Assets** | ⏳ | `/dashboard/assets` |
| **Racks** | ⏳ | `/dashboard/racks` |
| **Tasks** | ⏳ | `/dashboard/tasks` |
| **FloorPlans** | ⏳ | `/dashboard/floor-plans` |
| **Settings** | ⏳ | `/dashboard/settings` |

## 🎨 Composants UI

Utilise shadcn/ui (Radix UI + Tailwind CSS).

### Composants disponibles

- `Button` : Boutons avec variants (default, destructive, outline, ghost, link)
- `Card` : Cartes avec header, content, footer
- `Input` : Champs de texte

### Ajouter un composant

```bash
# Exemple : ajouter Dialog
npx shadcn-ui@latest add dialog
```

## 🔄 API Client

Client API avec gestion automatique JWT :

```typescript
import { apiClient } from '@/lib/api-client';

// GET
const sites = await apiClient.get('/sites');

// POST
const newSite = await apiClient.post('/sites', data);

// PATCH
await apiClient.patch(`/sites/${id}`, data);

// DELETE
await apiClient.delete(`/sites/${id}`);

// Upload fichier
await apiClient.upload(`/floor-plans/${id}/upload`, file);
```

### Gestion tokens

- **Access token** : 15 min, stocké localStorage
- **Refresh token** : 7 jours, refresh automatique sur 401
- **Auto-redirect** `/login` si refresh échoue

## 📊 State Management

### Zustand (Auth)

```typescript
import { useAuthStore } from '@/stores/auth-store';

const { user, isAuthenticated, login, logout } = useAuthStore();

// Login
await login({ email, password });

// Logout
logout();
```

### TanStack Query (Data fetching)

```typescript
import { useQuery } from '@tanstack/react-query';
import { sitesApi } from '@/lib/api/sites';

const { data, isLoading } = useQuery({
  queryKey: ['sites'],
  queryFn: sitesApi.getAll,
});
```

## 🎯 Prochaines étapes

1. **Sites** : Détails site + carte Leaflet
2. **Assets** : CRUD + QR scanner
3. **Racks** : Visualisation 2D baie
4. **Tasks** : Kanban board + checklist
5. **FloorPlans** : Upload + viewer Konva.js
6. **PWA** : Service worker + manifest

## 🐛 Troubleshooting

### Port 3001 déjà utilisé

```bash
# Changer port dans package.json
"dev": "next dev -p 3002"
```

### Erreur CORS

Vérifier que backend autorise `http://localhost:3001` (CORS config NestJS).

### Token expiré

Si session expire, logout automatique + redirect `/login`.

## 📝 Scripts disponibles

```bash
# Développement
npm run dev

# Build production
npm run build

# Démarrer production
npm run start

# Lint
npm run lint
```

## 📄 License

Privé - Projet XCH

## 🎉 MVP 100% Complet

### Modules livrés (7/7)

1. ✅ **Dashboard** - Stats overview
2. ✅ **Sites** - Liste, carte Leaflet, CRUD, détail
3. ✅ **Assets** - CRUD, QR generation, scanner caméra
4. ✅ **Tasks** - Kanban drag & drop, checklist interactive
5. ✅ **Racks** - Visualisation 2D Konva, mount/unmount
6. ✅ **FloorPlans** - Upload, viewer Konva, pins
7. ✅ **Settings** - Profil, tenant, intégrations

### Features

- ✅ Toast notifications (react-hot-toast)
- ✅ Error boundaries React
- ✅ PWA manifest + icons
- ✅ Responsive design
- ✅ TypeScript strict

### Génération PWA Icons

```bash
npm run generate-icons
```

---

**✅ Frontend MVP 100% : TERMINÉ**
**📅 Date :** 2026-01-01
**🚀 Status :** Production-Ready
