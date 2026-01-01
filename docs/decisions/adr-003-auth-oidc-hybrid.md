# ADR-003 : Authentification OIDC + Locale hybride

Date : 2025-12-31
Statut : Accepté

## Contexte

XCH doit supporter :
- **MVP** : Authentification locale (email/password) pour démarrage rapide
- **Future** : Intégration SSO entreprise (Microsoft Entra ID, Keycloak, etc.)
- **Flexibilité** : Coexistence auth locale + externe pour utilisateurs mixtes

Besoins entreprise :
- SSO avec Active Directory / Microsoft Entra ID
- Provisioning automatique utilisateurs (Just-In-Time)
- Pas de gestion mots de passe si SSO actif
- Support multi-fournisseurs OIDC (différents chantiers, prestataires)

## Décision

**Système d'authentification hybride avec Passport.js**

### Stack

- **Passport.js** : Middleware auth NestJS (@nestjs/passport)
- **Strategies** :
  - `passport-local` : Email/password (MVP actif)
  - `passport-openidconnect` : OIDC générique (architecture prête)
- **Sessions** : JWT (access token 15min + refresh token 7j)
- **Encryption** : bcrypt pour passwords locaux

### Modèle données

```prisma
model User {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Tenant    @relation(fields: [tenantId], references: [id])

  // Identité
  email         String
  passwordHash  String?   // NULL si auth externe uniquement

  // Profil
  name          String
  phone         String?
  avatarUrl     String?
  role          Role      @default(VIEWER)
  active        Boolean   @default(true)

  // Auth externe
  externalId    String?   // OIDC 'sub' claim ou SAML nameID
  authProvider  String    @default("local") // local, oidc, saml

  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())

  @@unique([tenantId, email])
  @@index([tenantId, externalId])
}

model AuthProvider {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])

  type          String   // oidc, saml
  name          String   // "Microsoft Entra ID"
  enabled       Boolean  @default(false)

  // OIDC config
  issuer        String?
  clientId      String?
  clientSecret  String?  // Encrypted at rest
  scopes        String[] @default(["openid", "profile", "email"])

  // Attribute mapping
  attributeMap  Json?    // Mapping claims → user fields

  createdAt     DateTime @default(now())

  @@unique([tenantId, type, name])
}
```

### Workflow authentification

**Login local** :
```
1. POST /auth/login {email, password}
2. Validation bcrypt hash
3. Génération JWT (access + refresh tokens)
4. Retour {accessToken, refreshToken, user}
```

**Login OIDC** :
```
1. GET /auth/oidc/{providerId}
2. Redirect vers provider (ex: login.microsoftonline.com)
3. User s'authentifie chez provider
4. Callback /auth/oidc/{providerId}/callback?code=xxx
5. Exchange authorization code → OIDC tokens
6. Récupération claims (sub, email, name, groups...)
7. Provisioning Just-In-Time :
   - Si user.externalId existe → update lastLoginAt
   - Sinon → create user {externalId: sub, email, name, authProvider: 'oidc'}
8. Génération JWT XCH
9. Retour {accessToken, refreshToken, user}
```

**Refresh token** :
```
POST /auth/refresh {refreshToken}
→ Nouveau access token si refresh valide
```

### Provisioning automatique (JIT)

Lors du premier login OIDC :
- Création automatique user avec `authProvider = 'oidc'`
- `externalId` = claim `sub` (unique par provider)
- Email, nom depuis claims OIDC
- Rôle par défaut : VIEWER (configurable par provider)
- Mapping groupes OIDC → rôles XCH (optionnel)

### Mapping attributs

Configuration flexible par provider :

```json
{
  "attributeMap": {
    "email": "preferred_username",
    "name": "name",
    "phone": "phone_number",
    "avatarUrl": "picture",
    "roleMapping": {
      "claimName": "groups",
      "rules": [
        {"oidcGroup": "XCH-Admins", "xchRole": "ADMIN"},
        {"oidcGroup": "XCH-Managers", "xchRole": "MANAGER"},
        {"oidcGroup": "XCH-Techs", "xchRole": "TECHNICIEN"}
      ]
    }
  }
}
```

## Conséquences

### Positives

- **Flexibilité déploiement** : Auth locale (MVP) → SSO (production) sans refonte
- **Provisioning automatique** : Pas de création manuelle users si SSO
- **Sécurité** : Pas de stockage passwords si SSO, 2FA délégué au provider
- **Multi-provider** : Support plusieurs OIDC (filiales, prestataires)
- **Standard** : OIDC largement supporté (Microsoft, Google, Keycloak, Okta...)
- **Expérience utilisateur** : Single Sign-On transparent

### Négatives

- **Complexité** : Deux chemins auth à maintenir (local + OIDC)
- **Dépendance externe** : Si provider OIDC DOWN, login impossible (mitigation : fallback local)
- **Configuration** : Setup OIDC nécessite expertise (issuer, scopes, claims)

## Alternatives considérées

### Auth locale uniquement
- **Rejetée** : Pas d'intégration Active Directory entreprise
- Gestion mots de passe complexe (reset, policies, 2FA)
- Pas de SSO

### SAML 2.0
- **Future** : Plus complexe qu'OIDC, moins moderne
- Support envisagé post-MVP si demande client

### Auth0 / Keycloak externe
- **Possible** : Compatible OIDC, peut être utilisé comme provider
- XCH reste agnostique du provider OIDC

## MVP

- ✅ Auth locale active et fonctionnelle
- ⏳ OIDC architecture complète, UI configuration disponible
- ❌ SAML hors MVP
- ❌ 2FA hors MVP (délégué au provider OIDC si activé)

## Configuration UI admin

Page "Paramètres > Authentification" :
- Toggle "Activer SSO"
- Liste providers OIDC configurés
- Formulaire ajout provider :
  - Nom, Issuer URL, Client ID, Client Secret
  - Scopes (openid, profile, email par défaut)
  - Attribute mapping (JSON editor)
  - Test connexion
- Logs authentifications (debug OIDC)

## Sécurité

- **Secrets OIDC** : Client secrets chiffrés at-rest (AES-256)
- **JWT** : Signé HS256 (secret rotatif), expiration courte (15min)
- **Refresh tokens** : Stockés DB hashés, révocables
- **Rate limiting** : 5 tentatives login / 15min par IP
- **HTTPS obligatoire** : Tokens jamais transmis en clair

## Notes

Décision validée en remplacement de "auth simple email/password" initial.
Support OIDC générique permet intégration Microsoft Entra ID, Google Workspace, Keycloak self-hosted, etc.
