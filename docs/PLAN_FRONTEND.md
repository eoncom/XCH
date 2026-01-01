# PLAN FRONTEND - XCH Application

**Date :** 2025-12-31
**Prérequis :** Backend 100% complet (10 modules)
**Objectif :** Application web responsive, mobile-first, PWA

---

## 🎯 OBJECTIFS FRONTEND

### Fonctionnalités MVP

1. **Authentification**
   - Login local (email/password)
   - Login OIDC (redirection + callback)
   - Session persistante (localStorage)
   - Logout

2. **Dashboard**
   - Vue d'ensemble (stats chantiers, assets, tâches)
   - Widgets interactifs (graphiques, listes)
   - Raccourcis actions rapides

3. **Chantiers (Sites)**
   - Liste avec recherche/filtres
   - Carte interactive Leaflet (clustering)
   - Détails chantier (infos + health status)
   - CRUD (création, édition, suppression)

4. **Inventaire (Assets)**
   - Liste avec filtres multi-critères
   - Génération QR codes
   - Scanner QR (PWA camera)
   - CRUD assets
   - Filtres : sans S/N, sans localisation

5. **Baies (Racks)**
   - Liste baies
   - Visualisation 2D baie (schéma vertical)
   - Montage équipements (drag & drop ou form)
   - Détection overlap visuelle
   - Espace disponible highlight

6. **Tâches (Tasks)**
   - Kanban board (TODO, IN_PROGRESS, DONE)
   - Liste avec filtres (statut, priorité, assigné)
   - Checklist interactive
   - Mes tâches / Tâches en retard
   - CRUD tâches

7. **Plans de sol (FloorPlans)**
   - Upload plans (PDF, PNG, JPG)
   - Viewer plan avec zoom/pan
   - Pins drag & drop (Konva.js canvas)
   - Types pins : ASSET, POI, ISSUE, NETWORK
   - Association pins ↔ assets

8. **Intégrations**
   - Page config intégrations
   - Test connexions (NetBox, Uptime Kuma)
   - Sync sites/devices (boutons + logs)
   - Statut temps-réel

9. **Administration**
   - Gestion utilisateurs (CRUD)
   - Configuration tenant
   - RBAC (affichage permissions)

10. **Mobile & PWA**
    - Responsive design (mobile-first)
    - PWA installable (manifest + service worker)
    - Mode offline basique (cache API calls)
    - Scanner QR natif (camera)

---

## 🛠️ STACK TECHNIQUE

### Core

| Technologie | Version | Usage |
|-------------|---------|-------|
| **Next.js** | 14.x | Framework React (App Router) |
| **React** | 18.x | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 3.x | Styling utility-first |
| **shadcn/ui** | Latest | Composants UI (Radix UI) |

### Bibliothèques UI

| Bibliothèque | Usage |
|--------------|-------|
| **Leaflet** | Carte interactive sites |
| **react-leaflet** | Wrapper React pour Leaflet |
| **Konva.js** | Canvas interactif pour plans |
| **react-konva** | Wrapper React pour Konva |
| **Recharts** | Graphiques dashboard |
| **html5-qrcode** | Scanner QR code |
| **qrcode.react** | Affichage QR codes |

### Gestion état & data

| Bibliothèque | Usage |
|--------------|-------|
| **Zustand** | State management léger |
| **react-hook-form** | Gestion formulaires |
| **zod** | Validation schémas |
| **SWR** ou **TanStack Query** | Fetching + cache API |

### PWA & Performance

| Bibliothèque | Usage |
|--------------|-------|
| **next-pwa** | Service worker + manifest |
| **next/image** | Optimisation images |
| **next/font** | Optimisation fonts |

---

## 📐 ARCHITECTURE FRONTEND

### Structure dossiers

```
frontend/
├── public/
│   ├── icons/                 # PWA icons
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Layout racine
│   │   ├── page.tsx           # Page accueil (redirect auth)
│   │   │
│   │   ├── (auth)/            # Route group auth
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── oidc/
│   │   │       └── callback/
│   │   │           └── page.tsx
│   │   │
│   │   └── (dashboard)/       # Route group dashboard (protected)
│   │       ├── layout.tsx     # Layout avec sidebar
│   │       ├── dashboard/
│   │       │   └── page.tsx
│   │       ├── sites/
│   │       │   ├── page.tsx           # Liste
│   │       │   ├── [id]/
│   │       │   │   └── page.tsx       # Détails
│   │       │   └── new/
│   │       │       └── page.tsx       # Création
│   │       ├── assets/
│   │       │   ├── page.tsx
│   │       │   ├── [id]/
│   │       │   └── new/
│   │       ├── racks/
│   │       ├── tasks/
│   │       ├── floor-plans/
│   │       ├── integrations/
│   │       └── admin/
│   │           ├── users/
│   │           └── settings/
│   │
│   ├── components/            # Composants React
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layouts/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── sites/
│   │   │   ├── SiteCard.tsx
│   │   │   ├── SiteMap.tsx
│   │   │   └── SiteForm.tsx
│   │   ├── assets/
│   │   │   ├── AssetCard.tsx
│   │   │   ├── QRScanner.tsx
│   │   │   └── AssetForm.tsx
│   │   ├── racks/
│   │   │   ├── RackVisualizer.tsx  # Canvas 2D
│   │   │   └── MountEquipmentDialog.tsx
│   │   ├── tasks/
│   │   │   ├── KanbanBoard.tsx
│   │   │   └── ChecklistEditor.tsx
│   │   └── floor-plans/
│   │       ├── FloorPlanViewer.tsx  # Konva canvas
│   │       └── PinEditor.tsx
│   │
│   ├── lib/                   # Utilitaires
│   │   ├── api/               # API client
│   │   │   ├── client.ts      # Fetch wrapper avec JWT
│   │   │   ├── sites.ts       # Endpoints sites
│   │   │   ├── assets.ts
│   │   │   ├── racks.ts
│   │   │   ├── tasks.ts
│   │   │   ├── floor-plans.ts
│   │   │   └── integrations.ts
│   │   ├── auth.ts            # Auth helpers
│   │   ├── permissions.ts     # RBAC client
│   │   └── utils.ts           # Utilitaires divers
│   │
│   ├── hooks/                 # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── usePermissions.ts
│   │   ├── useSites.ts
│   │   └── useAssets.ts
│   │
│   ├── stores/                # Zustand stores
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   │
│   ├── types/                 # TypeScript types
│   │   ├── api.ts             # Types backend
│   │   ├── site.ts
│   │   ├── asset.ts
│   │   ├── rack.ts
│   │   └── task.ts
│   │
│   └── styles/
│       └── globals.css        # Tailwind imports
│
├── .env.local                 # Variables environnement
├── next.config.js             # Config Next.js + PWA
├── tailwind.config.ts         # Config Tailwind
└── package.json
```

---

## 🔐 AUTHENTIFICATION FRONTEND

### Flow login local

```typescript
// 1. Composant LoginForm
const handleLogin = async (email, password) => {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const { accessToken, refreshToken, user } = await response.json();

  // 2. Stockage tokens
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));

  // 3. Redirection dashboard
  router.push('/dashboard');
};
```

### Flow OIDC

```typescript
// 1. Bouton login OIDC
<Button onClick={() => window.location.href = 'http://localhost:3000/auth/oidc'}>
  Login with SSO
</Button>

// 2. Callback OIDC (app/oidc/callback/page.tsx)
const OidcCallbackPage = () => {
  useEffect(() => {
    // Récupérer query params (code, state)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    // Backend échange code → tokens
    fetch(`http://localhost:3000/auth/oidc/callback?code=${code}`)
      .then(res => res.json())
      .then(({ accessToken, refreshToken, user }) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        router.push('/dashboard');
      });
  }, []);

  return <p>Authenticating...</p>;
};
```

### API Client avec JWT

```typescript
// lib/api/client.ts
export const apiClient = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('accessToken');

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });

    // Si 401 → refresh token
    if (response.status === 401) {
      const newToken = await this.refreshToken();
      if (newToken) {
        return this.fetch(endpoint, options); // Retry
      } else {
        // Redirect login
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    return response.json();
  },

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const { accessToken } = await response.json();
      localStorage.setItem('accessToken', accessToken);
      return accessToken;
    }

    return null;
  },
};
```

---

## 🗺️ CARTE INTERACTIVE (Leaflet)

### Composant SiteMap

```tsx
// components/sites/SiteMap.tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';

export const SiteMap = ({ sites }) => {
  return (
    <MapContainer
      center={[48.8566, 2.3522]} // Paris
      zoom={6}
      style={{ height: '600px', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      <MarkerClusterGroup>
        {sites.map(site => (
          <Marker
            key={site.id}
            position={[site.latitude, site.longitude]}
          >
            <Popup>
              <h3>{site.name}</h3>
              <p>Status: {site.healthStatus}</p>
              <a href={`/sites/${site.id}`}>Voir détails</a>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
};
```

---

## 🏗️ VISUALISATION BAIES (Konva.js)

### Composant RackVisualizer

```tsx
// components/racks/RackVisualizer.tsx
import { Stage, Layer, Rect, Text } from 'react-konva';

export const RackVisualizer = ({ rack }) => {
  const U_HEIGHT = 20; // Pixels par U
  const RACK_WIDTH = 300;
  const RACK_HEIGHT = rack.heightU * U_HEIGHT;

  return (
    <Stage width={RACK_WIDTH + 100} height={RACK_HEIGHT + 100}>
      <Layer>
        {/* Baie outline */}
        <Rect
          x={50}
          y={50}
          width={RACK_WIDTH}
          height={RACK_HEIGHT}
          stroke="black"
          strokeWidth={2}
        />

        {/* U markers */}
        {Array.from({ length: rack.heightU }, (_, i) => (
          <Text
            key={i}
            x={10}
            y={50 + (rack.heightU - i - 1) * U_HEIGHT}
            text={`U${i + 1}`}
            fontSize={12}
          />
        ))}

        {/* Équipements montés */}
        {rack.assets.map(asset => (
          <Rect
            key={asset.id}
            x={50}
            y={50 + (rack.heightU - asset.rackPositionU - asset.rackHeightU) * U_HEIGHT}
            width={RACK_WIDTH}
            height={asset.rackHeightU * U_HEIGHT}
            fill="#3b82f6"
            stroke="#1e40af"
            strokeWidth={1}
          />
        ))}
      </Layer>
    </Stage>
  );
};
```

---

## 📋 KANBAN BOARD (Tasks)

### Composant KanbanBoard

```tsx
// components/tasks/KanbanBoard.tsx
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const COLUMNS = {
  TODO: { title: 'À faire', color: 'gray' },
  IN_PROGRESS: { title: 'En cours', color: 'blue' },
  DONE: { title: 'Terminé', color: 'green' },
};

export const KanbanBoard = ({ tasks, onTaskMove }) => {
  const handleDragEnd = (result) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    onTaskMove(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        {Object.entries(COLUMNS).map(([status, { title, color }]) => (
          <Droppable key={status} droppableId={status}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-1 bg-gray-100 p-4 rounded"
              >
                <h3 className="font-bold mb-4">{title}</h3>

                {tasks
                  .filter(task => task.status === status)
                  .map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-white p-3 mb-2 rounded shadow"
                        >
                          <h4>{task.title}</h4>
                          <p className="text-sm text-gray-600">{task.priority}</p>
                        </div>
                      )}
                    </Draggable>
                  ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
};
```

---

## 📸 SCANNER QR CODE (PWA)

### Composant QRScanner

```tsx
// components/assets/QRScanner.tsx
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef } from 'react';

export const QRScanner = ({ onScan }) => {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    });

    scanner.render(
      (decodedText) => {
        // Parse URL: https://xch.app/assets/{id}/verify?token={token}
        const url = new URL(decodedText);
        const assetId = url.pathname.split('/')[2];
        const token = url.searchParams.get('token');

        onScan({ assetId, token });
        scanner.clear();
      },
      (error) => console.warn(error)
    );

    return () => scanner.clear();
  }, []);

  return <div id="qr-reader" />;
};
```

---

## 🎨 COMPOSANTS UI (shadcn/ui)

### Installation

```bash
npx shadcn-ui@latest init

# Installer composants
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add toast
```

### Exemple usage

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Sites</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Vous avez 42 chantiers actifs.</p>
    <Button onClick={() => router.push('/sites/new')}>
      Créer un chantier
    </Button>
  </CardContent>
</Card>
```

---

## 🔒 RBAC FRONTEND

### Hook usePermissions

```typescript
// hooks/usePermissions.ts
import { useAuth } from './useAuth';

const PERMISSIONS = {
  ADMIN: {
    sites: ['create', 'read', 'update', 'delete'],
    assets: ['create', 'read', 'update', 'delete'],
    // ... toutes permissions
  },
  MANAGER: {
    sites: ['read'],
    assets: ['read'],
    tasks: ['create', 'read', 'update'],
  },
  TECHNICIEN: {
    sites: ['create', 'read', 'update'],
    assets: ['create', 'read', 'update', 'delete'],
    racks: ['create', 'read', 'update'],
  },
  VIEWER: {
    sites: ['read'],
    assets: ['read'],
    racks: ['read'],
    tasks: ['read'],
  },
};

export const usePermissions = () => {
  const { user } = useAuth();

  const can = (resource: string, action: string): boolean => {
    if (!user) return false;
    return PERMISSIONS[user.role]?.[resource]?.includes(action) || false;
  };

  return { can };
};
```

### Usage

```tsx
const { can } = usePermissions();

{can('sites', 'create') && (
  <Button onClick={() => router.push('/sites/new')}>
    Créer un chantier
  </Button>
)}

{!can('assets', 'delete') && (
  <p>Vous n'avez pas la permission de supprimer des assets.</p>
)}
```

---

## 📱 PWA CONFIGURATION

### next.config.js

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  reactStrictMode: true,
  // ... autres configs
});
```

### manifest.json

```json
{
  "name": "XCH - Gestion IT Chantiers",
  "short_name": "XCH",
  "description": "Application de gestion IT pour chantiers temporaires",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 🚀 ROADMAP FRONTEND

### Phase 4A : Setup + Auth (3 jours)

- [ ] Setup Next.js 14 + TypeScript
- [ ] Installation Tailwind + shadcn/ui
- [ ] Architecture dossiers
- [ ] API client (fetch + JWT)
- [ ] Page login local
- [ ] Page OIDC callback
- [ ] Store auth (Zustand)
- [ ] Route protection (middleware)

### Phase 4B : Dashboard + Navigation (2 jours)

- [ ] Layout principal (sidebar + header)
- [ ] Dashboard page (stats widgets)
- [ ] Navigation responsive
- [ ] Composants UI de base (cards, tables)

### Phase 4C : Modules Business (10 jours)

**Sites (2 jours)**
- [ ] Liste sites + recherche
- [ ] Carte Leaflet + clustering
- [ ] Détails site
- [ ] Formulaire création/édition

**Assets (2 jours)**
- [ ] Liste assets + filtres
- [ ] Génération QR codes
- [ ] Scanner QR (PWA)
- [ ] Formulaire CRUD

**Racks (2 jours)**
- [ ] Liste baies
- [ ] Visualisation 2D (Konva)
- [ ] Montage équipement (dialog)
- [ ] Highlight espaces dispo

**Tasks (2 jours)**
- [ ] Kanban board (drag & drop)
- [ ] Checklist editor
- [ ] Filtres (mes tâches, en retard)
- [ ] Formulaire CRUD

**FloorPlans (2 jours)**
- [ ] Upload plans
- [ ] Viewer + zoom/pan (Konva)
- [ ] Pins drag & drop
- [ ] Dialog création pins

**Integrations (1 jour)**
- [ ] Page config
- [ ] Test connexions
- [ ] Boutons sync
- [ ] Logs temps-réel

**Admin (1 jour)**
- [ ] Gestion users
- [ ] Config tenant
- [ ] Affichage permissions

### Phase 4D : Polish + Tests (3 jours)

- [ ] PWA setup complet
- [ ] Service worker
- [ ] Tests E2E Playwright
- [ ] Optimisations performance
- [ ] Documentation utilisateur

---

## 📊 MÉTRIQUES SUCCÈS

### Performance

- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] PWA installable

### Fonctionnalités

- [ ] Toutes pages responsive (mobile + tablet + desktop)
- [ ] RBAC fonctionnel (permissions affichées)
- [ ] Scanner QR opérationnel
- [ ] Carte avec 100+ sites < 2s chargement
- [ ] Offline basique (cache requêtes)

---

## 📝 NOTES IMPORTANTES

### Sécurité Frontend

- ✅ Tokens JWT en localStorage (pas de cookies)
- ✅ HTTPS obligatoire en production
- ✅ Validation inputs côté client (+ backend)
- ✅ Sanitization affichage (éviter XSS)
- ✅ RBAC appliqué UI (hide/disable boutons)

### UX/UI

- Mobile-first design (breakpoints Tailwind)
- Loading states partout (skeletons shadcn/ui)
- Error boundaries React
- Toast notifications (succès, erreurs)
- Confirmation dialogs actions critiques (delete)

---

**✅ Plan frontend complet - Prêt à démarrer**
**📅 Durée estimée :** 3-4 semaines (1 dev full-time)
**🎯 Objectif :** Application production-ready, mobile-first, PWA
