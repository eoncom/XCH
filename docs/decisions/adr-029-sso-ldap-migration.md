# ADR-029 — SSO LDAP/AD migration path (J+1mois)

Date : 2026-05-16
Statut : **Proposé** (Track E.3 Pass 8 — arbitrage stakeholder requis avant Accepté/Rejeté)
Tag cible : décision business pending — implémentation Track F si Accepté
Dépendances :
- [ADR-003](adr-003-auth-oidc-hybrid.md) — auth model OIDC hybride (J1 = local-only)
- [ADR-021](adr-021-rbac-universal-data-filtering.md) — RBAC universal (LDAP-linked users héritent du même pipeline)
- [docs/architecture/AUTH_MODEL.md](../architecture/AUTH_MODEL.md) — modèle MANAGE/WRITE/READ + AccessOverride
- MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15` vigilance V3 « SSO LDAP J+1mois »

---

## Contexte

Le pilote employeur (Mode C air-gap, cf. [deployment-modes.md §3.3](../operator/deployment-modes.md#33-air-gap-strict-mode-c--pilote-employeur-référence)) démarre J1 avec auth **local-only** : chaque user a un email + password hashé en DB. Pas de SSO entreprise.

L'employeur RSI a indiqué qu'un AD interne **pourrait être ouvert J+1mois** pour intégration SSO LDAP (vigilance V3 du plan Track E parent). À ce stade :

- **Code XCH actuel** : 0 module LDAP (vérifié grep `ldap|LDAP|SsoProvider` dans `backend/src` → 0 résultat).
- **AuthService** : login email/password local uniquement, `passwordHash` bcrypt en DB user.
- **ADR-003 OIDC hybrid** : conçu pour OIDC (Keycloak, Auth0, etc.), pas LDAP/AD bind direct.

Trois options s'offrent à l'arbitrage stakeholder :

### Option A — Implémenter LDAP/AD bind direct (`ldapjs` + AuthService.loginLdap)

Module SSO LDAP nouveau (~4-6h estimé) :
- Dépendance `ldapjs` (npm) ou `passport-ldapauth` (NestJS)
- AuthService nouvelle méthode `loginLdap(email, password)` → LDAPS bind + email match avec DB local user
- Configuration `.env` : `SSO_LDAP_URL`, `SSO_LDAP_BIND_DN`, `SSO_LDAP_BIND_PASSWORD`, `SSO_LDAP_USER_BASE_DN`, `SSO_LDAP_USER_FILTER`
- Migration users : champ `User.ssoProvider` (enum `local | ldap`) + lien `ssoExternalId` (sub LDAP)
- UI Settings > SSO : toggle LDAP + form configuration + test connection
- Tests jest : mock LDAP server, scénarios login OK / bind fail / user not in DB

### Option B — Implémenter OIDC bridge (Keycloak LDAP-federated)

L'employeur déploie un Keycloak self-hosted qui fédère son AD via LDAP. XCH parle OIDC à Keycloak.
- Re-use ADR-003 OIDC hybrid architecture (déjà conçu, partiellement implémenté ?)
- Pas de code LDAP dans XCH
- Coût : déploiement Keycloak côté employeur (1-2j IT employeur) + config OIDC client J+1mois
- Pattern recommandé pour multi-mode (Cloud public Mode A bénéficie aussi)

### Option C — Local-only durable + parking définitif

Si J+3mois aucun mouvement IT employeur sur LDAP/AD :
- Acter que le pilote restera **local-only durable**
- Procédure onboarding manuelle pour chaque nouvel admin (cf. [onboarding-user.md](../operator/onboarding-user.md))
- Cron mensuel automatique pour password rotation par user (vs SSO directory password policy enforcée)
- Risque : turnover admin → escalation auth manuelle

---

## Décision (PROPOSÉE — arbitrage stakeholder)

**Recommandation RSI Track E.3 Pass 8 :**

**Option C par défaut J1**, avec re-évaluation M1, M2, M3 :

- **M0 (cutover J-day)** : local-only durable (Option C). Pas de code LDAP. Pas de coordination IT employeur sur ce volet.
- **M1 (M+1 mois)** : ticket suivi cron mensuel (cf. [cutover-prod-airgap.md §5.3](../operator/cutover-prod-airgap.md#53-risque-dérive-jn)). RSI propose conversation IT employeur sur LDAP/AD ouverture.
- **M2 (M+2 mois)** : si LDAP/AD employeur disponible → choisir Option A OR B selon contexte. Sinon escaler RSI + business stakeholders.
- **M3 (M+3 mois)** : si toujours pas de LDAP/AD → **Accepter cet ADR-029 en mode « Option C durable »** (statut Accepté = parking définitif). Sinon migration vers A/B.

**Option A vs B sélection (M2 si LDAP/AD disponible) :**

| Critère | Option A (LDAP direct) | Option B (OIDC bridge Keycloak) |
|---|---|---|
| Effort code XCH | ~4-6h | ~1h (config OIDC client) |
| Effort IT employeur | aucun (juste créer service account) | déploiement Keycloak + LDAP federation (1-2j) |
| Sécurité | password LDAP transite par XCH | password jamais vu par XCH (federated) |
| Multi-mode reuse (Cloud public Mode A futur) | Non | Oui |
| Maintenance long-terme | LDAP dépendance directe | Keycloak abstraction |

→ Recommandation conditionnelle : **Option B** si l'employeur est ouvert au déploiement Keycloak, sinon **Option A**.

---

## Conséquences

### Positives

- Décision actée tracée même en parking (M3 si Option C durable)
- Pas de coût immédiat J1 (local-only fonctionne, cf. AuthService déjà testé)
- Procédure onboarding manuel documentée → opérateurs ne sont pas bloqués
- Ticket cron mensuel évite « oubli silencieux » du sujet

### Négatives (acceptées)

- Risque turnover admin → password recovery manuel via super-admin
- Pas de password policy enforcée OS-level (XCH bcrypt + ThrottlerGuard suffisent J1)
- Si LDAP/AD employeur arrive sans préparation → 4-6h implementation imprévue (Option A) ou 1-2j coordination IT (Option B)

### Forward dependencies

- Track F (post-cutover) : implementation Option A OR B si M2 trigger
- ADR-021 : RBAC universal s'applique identiquement aux users LDAP-linked (pas de re-design)
- ADR-028 : audit log enrichment (ipAddress + UA + delegationId) capture les events LDAP login comme tout autre login

---

## Alternatives considérées

1. **SAML 2.0** — Rejeté. Pattern legacy, complexité élevée vs OIDC pour le même use case.
2. **Magic link email-only auth** — Rejeté. Air-gap rend SMTP fragile en cas d'incident, et password reset email casse en panne SMTP.
3. **WebAuthn / passkeys** — Rejeté hors scope J1. Considéré Track G future (productisation Mode A multi-tenant SaaS).
4. **Cosign / Yubikey hardware-only** — Rejeté trop disruptive pour pilote employeur 5-10 admins.

---

## Plan d'exécution

- **Immédiat (Track E.3 closure)** : cet ADR-029 publié en statut **Proposé**. MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15` vigilance V3 référence cet ADR.
- **Cutover prod employeur J-day (Track E.3 Pass 11)** : config local-only J1 (Option C par défaut).
- **Ticket cron M+1, M+2, M+3** : opérateur reçoit reminder mensuel. Documenter dans [cutover-prod-airgap.md §5.3](../operator/cutover-prod-airgap.md#53-risque-dérive-jn).
- **M3 + decision** : update statut ADR-029 (Accepté Option A / B / C) + implementation Track F si applicable.

---

## Validation arbitrage

Cet ADR-029 est **Proposé** et nécessite arbitrage par les stakeholders :
- RSI (proposant)
- Employeur business owner (validateur principal)
- IT employeur (capacité technique LDAP/AD + Keycloak)

Décision finale à acter post-cutover M0-M3 selon évolution disponibilité LDAP/AD employeur.
