# ADR-008 : Résolution Known Issue SSR/CSR Cookies Authentication

**Date :** 2026-01-17
**Statut :** Proposé
**Décideurs :** Lead Technique XCH
**Contexte :** Session 13 - Analyse Known Issue tests E2E

---

## Contexte

### Problème Actuel

L'application XCH utilise une **architecture hybride SSR + CSR** pour l'authentification qui cause des échecs de tests E2E et des problèmes de persistance de session :

**Composants impliqués :**

1. **Next.js 15 avec Pages Router** (frontend)
   - Middleware SSR (`middleware.ts`) vérifie cookie `accessToken`
   - Zustand store CSR (`auth-store.ts`) gère localStorage + cookies JavaScript
   - Login page CSR (`login/page.tsx`) effectue appels API

2. **NestJS Backend** (`auth.controller.ts`)
   - Retourne tokens JSON dans body response
   - Tentative envoi cookie `Set-Cookie` (Session 12)

**Symptômes :**

```
✅ Login initial fonctionne (CSR)
❌ Reload page → redirect /login (middleware ne voit pas cookie)
❌ Navigation SSR → échec auth (cookie non persisté)
❌ Tests E2E persistance/logout échouent (2/57 passent)
```

**Cause racine :**

```typescript
// auth-store.ts ligne 38
document.cookie = `accessToken=${response.accessToken}; path=/; max-age=900; SameSite=Lax`;

// ❌ PROBLÈME : Cookies créés via JavaScript côté client ne sont PAS
// automatiquement inclus dans headers HTTP des requêtes Next.js SSR
```

**Impact :**
- Tests E2E : 2/57 passants (96% échec)
- UX : Session perdue sur reload page
- Sécurité : Tokens exposés dans localStorage

---

## Analyse des Solutions

### Option 1 : Désactiver Middleware SSR ❌

**Principe :** Retirer protection SSR, tout en CSR uniquement

**Changements :**
```typescript
// frontend/src/middleware.ts
export function middleware(request: NextRequest) {
  // DÉSACTIVÉ - Protection auth uniquement côté client
  return NextResponse.next();
}
```

**Avantages :**
- ✅ Implémentation : 5 minutes
- ✅ Tests E2E passent immédiatement (57/57)
- ✅ Zero breaking changes

**Inconvénients :**
- ❌ Pas de protection SSR (pages accessibles sans auth côté serveur)
- ❌ SEO : Pages protégées indexables avant redirect CSR
- ❌ Sécurité diminuée (protection uniquement JavaScript)
- ❌ Flash de contenu non-auth avant redirect
- ❌ Ne résout pas problème de fond

**Estimation :** 5 min
**Recommandation :** ❌ **NON** (quick fix mais architecture dégradée)

---

### Option 2 : Cookies HTTP-Only Backend-Driven ✅ RECOMMANDÉ

**Principe :** Backend maître de l'auth, cookies HTTP-only natifs, frontend suit

**Architecture cible :**

```
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (NestJS)                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /api/auth/login                                  │  │
│  │   → Set-Cookie: accessToken (httpOnly, secure, 15min)│  │
│  │   → Set-Cookie: refreshToken (httpOnly, secure, 7d)  │  │
│  │   → Response body: { user }                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ GET /api/auth/session                                 │  │
│  │   ← Cookie: accessToken (auto-envoyé par browser)    │  │
│  │   → Response: { user, isAuthenticated }              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /api/auth/refresh                                │  │
│  │   ← Cookie: refreshToken (auto-envoyé)               │  │
│  │   → Set-Cookie: accessToken (nouveau 15min)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             ▲
                             │ HTTP Cookies (auto-managed)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 15)                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ middleware.ts (SSR)                                   │  │
│  │   → Lit cookie accessToken (natif Next.js)           │  │
│  │   → Si absent → redirect /login                      │  │
│  │   → Si présent → autoriser accès                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ auth-store.ts (CSR - Zustand)                        │  │
│  │   → SUPPRIME localStorage tokens                     │  │
│  │   → CONSERVE localStorage user (cache)               │  │
│  │   → APPELLE GET /api/auth/session pour vérifier auth│  │
│  │   → Cookies gérés automatiquement par browser        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ api-client.ts                                         │  │
│  │   → credentials: 'include' (envoie cookies auto)     │  │
│  │   → SUPPRIME header Authorization manual             │  │
│  │   → Auto-retry 401 → appelle /auth/refresh           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Changements détaillés :**

#### Backend (NestJS) - 6 fichiers

**1. `backend/src/modules/auth/auth.controller.ts`**
```typescript
import { Response } from 'express';

@Post('login')
@UseGuards(LocalAuthGuard)
async login(
  @Request() req: AuthRequest,
  @Body() loginDto: LoginDto,
  @Res({ passthrough: true }) res: Response
) {
  const result = await this.authService.login(req.user);

  // Set HTTP-only cookies (pas accessible JavaScript)
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,       // ✅ Protection XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS uniquement en prod
    sameSite: 'lax',      // Protection CSRF
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    path: '/api/auth/refresh', // ✅ Restrict path
  });

  // Retourne seulement user (pas tokens)
  return { user: result.user };
}

@Get('session')
@UseGuards(JwtAuthGuard) // Vérifie cookie automatiquement
@ApiOperation({ summary: 'Get current session status' })
getSession(@Request() req: AuthRequest) {
  return {
    user: req.user,
    isAuthenticated: true,
  };
}

@Post('refresh')
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const refreshToken = req.cookies['refreshToken'];

  if (!refreshToken) {
    throw new UnauthorizedException('No refresh token');
  }

  const result = await this.authService.refreshAccessToken(refreshToken);

  // Set nouveau accessToken cookie
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });

  return { success: true };
}

@Post('logout')
@UseGuards(JwtAuthGuard)
async logout(@Res({ passthrough: true }) res: Response) {
  // Clear cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  return { success: true };
}
```

**2. `backend/src/modules/auth/strategies/jwt.strategy.ts`**
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaClient) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // ✅ Extraction depuis cookie (priorité 1)
        (request: Request) => {
          return request?.cookies?.['accessToken'];
        },
        // Fallback: Authorization header (pour Swagger/tests)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET,
      ignoreExpiration: false,
    });
  }
  // ... reste identique
}
```

**3. `backend/src/main.ts`**
```typescript
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Enable cookie parser
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true, // ✅ CRITICAL pour cookies cross-origin
  });

  // ... reste identique
}
```

**4. `backend/package.json`**
```json
{
  "dependencies": {
    "cookie-parser": "^1.4.7",
    "@types/cookie-parser": "^1.4.7"
  }
}
```

**5. Créer `backend/src/modules/auth/dto/session-response.dto.ts`**
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class SessionResponseDto {
  @ApiProperty()
  user: Omit<User, 'password'>;

  @ApiProperty()
  isAuthenticated: boolean;
}
```

#### Frontend (Next.js) - 4 fichiers

**6. `frontend/src/stores/auth-store.ts`**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginCredentials } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true });
        try {
          // ✅ Cookies gérés automatiquement par fetch credentials: 'include'
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // ✅ CRITICAL
            body: JSON.stringify(credentials),
          });

          if (!response.ok) throw new Error('Login failed');

          const { user } = await response.json();

          // ✅ Store seulement user (pas tokens)
          localStorage.setItem('user', JSON.stringify(user));

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          // ✅ Appelle backend pour clear cookies
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout failed:', error);
        }

        // Clear cache local
        localStorage.removeItem('user');
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      checkSession: async () => {
        set({ isLoading: true });
        try {
          // ✅ Vérifie session via cookie (automatique)
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
            credentials: 'include',
          });

          if (response.ok) {
            const { user } = await response.json();
            localStorage.setItem('user', JSON.stringify(user));
            set({ user, isAuthenticated: true, isLoading: false });
          } else {
            // Session expirée
            localStorage.removeItem('user');
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          console.error('Session check failed:', error);
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      setUser: (user: User) => {
        localStorage.setItem('user', JSON.stringify(user));
        set({ user });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        // ✅ NE PLUS persister isAuthenticated (calculé via session check)
      }),
    }
  )
);
```

**7. `frontend/src/lib/api-client.ts`**
```typescript
const apiClient = {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${url}`, {
      credentials: 'include', // ✅ Envoie cookies auto
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      // ✅ Tenter refresh automatique
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry request
        return this.get<T>(url);
      }
      // Redirect login si refresh échoue
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },

  async post<T>(url: string, data: any): Promise<T> {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      credentials: 'include', // ✅
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.post<T>(url, data);
      }
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  },

  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // ✅ Envoie refreshToken cookie
      });

      return response.ok; // Backend a set nouveau accessToken cookie
    } catch (error) {
      return false;
    }
  },
};

export { apiClient };
```

**8. `frontend/src/middleware.ts`** (INCHANGÉ ✅)
```typescript
// ✅ Reste identique - lit cookie natif Next.js
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = ['/login', '/auth/oidc/callback'];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // ✅ Lit cookie HTTP-only (automatique Next.js)
  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
```

**9. `frontend/src/app/dashboard/layout.tsx`**
```typescript
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    // ✅ Vérifier session au mount (hydratation)
    checkSession();
  }, [checkSession]);

  // ... reste identique
}
```

**Tests E2E - 2 fichiers**

**10. `frontend/e2e/fixtures/auth.fixture.ts`**
```typescript
// ✅ Plus besoin de gérer localStorage - cookies automatiques
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  // ✅ Attendre redirect (cookie set automatiquement)
  await page.waitForURL('/dashboard', { timeout: 5000 });
}

export async function logout(page: Page) {
  // ✅ Clic logout - backend clear cookies
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login', { timeout: 5000 });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  // ✅ Vérifier via cookie (automatique Playwright)
  const cookies = await page.context().cookies();
  return cookies.some(c => c.name === 'accessToken' && c.value);
}
```

**Avantages :**
- ✅ Architecture propre et standard (cookies HTTP natifs)
- ✅ Sécurité maximale (`httpOnly: true` → protection XSS)
- ✅ Middleware SSR fonctionne nativement
- ✅ Tests E2E passent (57/57 attendu)
- ✅ Pas de flash content / pas de reload session perdue
- ✅ Auto-refresh transparent (backend gère expiration)
- ✅ Compatibilité SSO/OIDC (cookies standard)

**Inconvénients :**
- ⚠️ Modifications backend + frontend (10 fichiers)
- ⚠️ Temps implémentation : 2-3h
- ⚠️ Testing requis (tests manuels + E2E)
- ⚠️ Migration données localStorage existantes (user seulement)

**Estimation :** 2-3h
**Recommandation :** ✅ **OUI** (architecture correcte long terme)

---

### Option 3 : Migration Next.js App Router ⏳

**Principe :** Migrer Pages Router → App Router (Next.js 13+)

**Avantages potentiels :**
- ✅ Server Components natifs
- ✅ Meilleure gestion cookies SSR
- ✅ Architecture moderne

**Inconvénients :**
- ❌ Refonte complète application (18 pages)
- ❌ Breaking changes (router, layouts, etc.)
- ❌ Temps : 1-2 semaines
- ❌ Ne résout PAS le problème cookies (même issue)

**Note :** L'application utilise **DÉJÀ App Router Next.js 15** (vérifié `package.json` ligne 37).
Le problème vient de l'architecture auth (localStorage + cookies JS), pas du router.

**Estimation :** N/A (déjà en App Router)
**Recommandation :** ❌ **NON** (ne résout pas le problème)

---

### Option 4 : Token dans URL Query ❌ DANGER

**Principe :** Passer accessToken dans query params

```typescript
// ❌ FAILLE SÉCURITÉ
router.push(`/dashboard?token=${accessToken}`);
```

**Avantages :**
- ✅ SSR peut lire query
- ✅ Implémentation rapide

**Inconvénients :**
- ❌ **FAILLE SÉCURITÉ CRITIQUE** : Tokens dans logs serveur
- ❌ Tokens dans historique navigateur
- ❌ Tokens dans referer headers
- ❌ Non-conforme standards sécurité
- ❌ OWASP Top 10 violation

**Estimation :** 30 min
**Recommandation :** ❌ **NON** (inacceptable sécurité)

---

## Décision

### Solution retenue : **Option 2 - Cookies HTTP-Only Backend-Driven** ✅

**Justification :**

1. **Architecture correcte** : Standard industrie (cookies HTTP-only)
2. **Sécurité maximale** : Protection XSS, CSRF, tokens non exposés
3. **Tests E2E** : Résolution complète (57/57 attendu)
4. **UX** : Pas de perte session, pas de flash content
5. **Maintenabilité** : Code propre, patterns standards

**Roadmap implémentation :**

### Phase 1 : Backend (1h)
1. ✅ Installer `cookie-parser` (5 min)
2. ✅ Modifier `auth.controller.ts` (20 min)
   - `login()` : Set cookies HTTP-only
   - `refresh()` : Refresh depuis cookie
   - `logout()` : Clear cookies
   - Nouveau `session()` : Check auth
3. ✅ Modifier `jwt.strategy.ts` (10 min)
   - Extraction depuis cookie prioritaire
4. ✅ Modifier `main.ts` (5 min)
   - Enable `cookieParser()`
   - CORS `credentials: true`
5. ✅ Tests backend (20 min)
   - Login → vérifier `Set-Cookie` headers
   - Session → vérifier auth via cookie
   - Refresh → vérifier nouveau cookie

### Phase 2 : Frontend (1h)
6. ✅ Modifier `auth-store.ts` (30 min)
   - Supprimer tokens localStorage
   - Login via fetch `credentials: 'include'`
   - Nouveau `checkSession()`
   - Logout appelle backend
7. ✅ Modifier `api-client.ts` (15 min)
   - Ajouter `credentials: 'include'` partout
   - Auto-refresh via `/auth/refresh`
8. ✅ Modifier `dashboard/layout.tsx` (5 min)
   - Appeler `checkSession()` au mount
9. ✅ Tests frontend (10 min)
   - Login → vérifier user stocké
   - Reload → vérifier session maintenue

### Phase 3 : Tests E2E (30 min)
10. ✅ Modifier `auth.fixture.ts` (10 min)
    - Utiliser cookies natifs Playwright
11. ✅ Lancer tests E2E (10 min)
    - Valider 57/57 tests passants
12. ✅ Tests manuels (10 min)
    - Login → reload → vérifier session OK
    - Logout → vérifier redirect login

### Phase 4 : Documentation (30 min)
13. ✅ Mettre à jour guides (20 min)
    - `E2E_VALIDATION_REPORT.md`
    - `DEVELOPMENT_LOG.md`
14. ✅ Commit + déploiement (10 min)

**Total estimation :** 3h (backend 1h + frontend 1h + tests 30min + docs 30min)

---

## Conséquences

### Positives

1. **Tests E2E** : 2/57 → 57/57 passants (100%)
2. **UX** : Session persistante après reload (production-ready)
3. **Sécurité** : Tokens protégés XSS (`httpOnly: true`)
4. **Architecture** : Standards industrie (cookies HTTP natifs)
5. **Maintenabilité** : Code propre, patterns clairs
6. **SSO/OIDC** : Compatibilité totale (cookies standard)

### Négatives

1. **Breaking changes** : Migration localStorage → cookies
2. **Temps** : 3h développement + tests
3. **Coordination** : Déploiement backend + frontend simultané
4. **Tests requis** : Validation manuelle + E2E complète
5. **Migration utilisateurs** : Sessions actuelles perdues (re-login requis)

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Cookies bloqués navigateur | Faible | Moyen | Détecter + message erreur |
| CORS misconfiguration | Moyen | Élevé | Tests complets dev + prod |
| Refresh token rotation fail | Faible | Élevé | Logging + monitoring |
| Session timeout inattendu | Faible | Faible | Configurer durées correctement |

### Plan de rollback

Si problème critique après déploiement :

1. **Rollback backend** : Revert commit auth.controller.ts
2. **Rollback frontend** : Revert commit auth-store.ts
3. **Downtime** : ~5 min (rebuild containers)
4. **Data loss** : Aucune (sessions re-login seulement)

---

## Alternatives considérées

| Solution | Temps | Sécurité | Tests E2E | Recommandation |
|----------|-------|----------|-----------|----------------|
| **Option 1** : Désactiver middleware | 5 min | ❌ Faible | ✅ 57/57 | ❌ Non |
| **Option 2** : Cookies HTTP-only | 3h | ✅ Élevée | ✅ 57/57 | ✅ **OUI** |
| **Option 3** : Migration App Router | 1-2 sem | 🟡 Moyenne | 🟡 Incertain | ❌ Non |
| **Option 4** : Token URL query | 30 min | ❌ **DANGER** | ✅ 57/57 | ❌ **NON** |

---

## Références

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Next.js Middleware Cookies](https://nextjs.org/docs/app/building-your-application/routing/middleware#using-cookies)
- [NestJS Cookies](https://docs.nestjs.com/techniques/cookies)
- `docs/testing/E2E_VALIDATION_REPORT.md` - Analyse Known Issue
- `DEVELOPMENT_LOG.md` Session 12 - Tests CI/CD

---

**Décision finale :** Implémenter **Option 2** (Cookies HTTP-Only) en priorité haute.

**Prochaine action :** Créer plan de migration détaillé par fichier avec code exact.

**Date révision :** 2026-01-17
**Mainteneur :** Lead Technique XCH
