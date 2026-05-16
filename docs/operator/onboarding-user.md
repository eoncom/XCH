# XCH — Onboarding utilisateur (création tenant + délégation + invite)

> **Scope** : procédure opérateur pour onboarder un nouveau tenant + délégation + admin sur XCH. Pattern API + UI documenté.
> Placeholders : `<DEPLOY_DOMAIN>`, `<ADMIN_EMAIL>`, `<ADMIN_NAME>`, `<TENANT_NAME>`, `<TENANT_SUBDOMAIN>`, `<USER_EMAIL>`.

---

## 1. Cas d'usage : J1 cutover

**Setup wizard** : 1er tenant + 1er super-admin. Voir [bootstrap-runbook.md §6](bootstrap-runbook.md#6-smoke-66--setup-wizard).

---

## 2. Cas d'usage : N+1 tenant additionnel (multi-tenant futur)

> ⚠️ Track G future (post-2e client). En J1 pilote employeur, mono-tenant suffit.

```bash
# Via API (super-admin uniquement)
COOKIES=$(mktemp)
curl -s -c "$COOKIES" -X POST https://<DEPLOY_DOMAIN>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<SUPER_ADMIN_EMAIL>","password":"<SUPER_ADMIN_PASS>"}'

curl -s -b "$COOKIES" -X POST https://<DEPLOY_DOMAIN>/api/tenants \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"<TENANT_NAME>\",
    \"subdomain\": \"<TENANT_SUBDOMAIN>\",
    \"primaryColor\": \"#0070f3\"
  }"
```

---

## 3. Cas d'usage : 2e admin (D3.5 décision RSI)

Pilote employeur : opérateur 2e admin à nommer pendant E.3 (RSI propose, employeur valide). Procédure invite.

### 3.1 Via UI

1. Login en tant que super-admin existant sur `https://<DEPLOY_DOMAIN>/`
2. Navigate `Settings > Users > Invite`
3. Remplir : email + nom + rôle (Super Admin OR Admin) + délégation(s) auxquelles donner accès
4. Submit → email d'invitation envoyé via canal SMTP configuré (cf. [alerting.md §4](alerting.md))
5. L'invité reçoit lien `https://<DEPLOY_DOMAIN>/invite?token=<TOKEN>` valable 72h

### 3.2 Via API

```bash
curl -s -b "$COOKIES" -X POST https://<DEPLOY_DOMAIN>/api/users/invite \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"<USER_EMAIL>\",
    \"name\": \"<USER_NAME>\",
    \"isSuperAdmin\": true,
    \"delegationIds\": []
  }"
# → email envoyé via Nodemailer ; token retourné dans la response
```

### 3.3 Pattern recommandé pilote employeur

- Onboard 2e admin en M0 du cutover
- Lui faire suivre les 13 runbooks operator (handoff par session 1-2h)
- Drill trimestriel D4.4 : alterner 1er et 2e admin sur les scénarios

---

## 4. Cas d'usage : utilisateur opérationnel (non-admin)

### 4.1 Via UI

`Settings > Users > New` :
- Email + nom + password (ou invite token)
- Délégation(s) accessible(s)
- Permissions par scope (READ/WRITE/MANAGE sur sites/assets/tasks/etc.)

Pattern AccessOverride (post-ADR-021 + ADR-022) :
- Par défaut, user a permissions héritées de sa(ses) délégation(s)
- AccessOverride ALLOW ajoute permissions ; DENY retire

### 4.2 Via API

```bash
curl -s -b "$COOKIES" -X POST https://<DEPLOY_DOMAIN>/api/users \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"<USER_EMAIL>\",
    \"password\": \"<INITIAL_PASS>\",
    \"name\": \"<USER_NAME>\",
    \"isSuperAdmin\": false,
    \"delegationIds\": [\"<DELEGATION_ID>\"]
  }"
```

---

## 5. Cas d'usage : SSO LDAP (V3 J+1mois)

Une fois SSO LDAP activé (cf. [cutover-prod-airgap.md §V3](cutover-prod-airgap.md#5-v3-sso-ldap-j1mois--checklist-activation-différée)) :

1. User entre email + password LDAP sur `https://<DEPLOY_DOMAIN>/login`
2. Backend `AuthService.loginLdap` vérifie credentials via LDAPS
3. Premier login → matching email avec DB user existant → link
4. Si user n'existe pas en DB → auto-provision si flag enabled, sinon refuser

Migration users local → LDAP : voir checklist [cutover-prod-airgap.md §5.2](cutover-prod-airgap.md#52-migration-users-local--ldap-linked).

---

## 6. Cas d'usage : Délégation (organisation)

Délégation = unité d'organisation isolée (équipe, BU, agence, etc.). Pattern ADR-009 delegation-first + ADR-021 RBAC universal.

### 6.1 Création

```bash
curl -s -b "$COOKIES" -X POST https://<DEPLOY_DOMAIN>/api/organization/delegations \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"<DELEGATION_NAME>\",
    \"description\": \"<DESC>\"
  }"
```

### 6.2 Affecter users à une délégation

```bash
curl -s -b "$COOKIES" -X POST https://<DEPLOY_DOMAIN>/api/user-delegations \
  -H 'Content-Type: application/json' \
  -d "{
    \"userId\": \"<USER_ID>\",
    \"delegationId\": \"<DELEGATION_ID>\",
    \"defaultPermission\": \"READ\"
  }"
```

---

## 7. Audit + cleanup

```bash
# Liste users actifs
curl -s -b "$COOKIES" "https://<DEPLOY_DOMAIN>/api/users?active=true" | jq

# Liste délégations
curl -s -b "$COOKIES" "https://<DEPLOY_DOMAIN>/api/organization/delegations" | jq

# Audit log d'un user
curl -s -b "$COOKIES" "https://<DEPLOY_DOMAIN>/api/audit?userId=<USER_ID>" | jq
```

---

## 8. Cross-références

- Auth model : [docs/architecture/AUTH_MODEL.md](../architecture/AUTH_MODEL.md)
- ADR délégation : [docs/decisions/adr-009-delegation-first-model.md](../decisions/adr-009-delegation-first-model.md)
- ADR RBAC universal : [docs/decisions/adr-021-rbac-universal-data-filtering.md](../decisions/adr-021-rbac-universal-data-filtering.md)
- ADR SkipDelegation taxonomy : [docs/decisions/adr-028-audit-log-enrichment-skipdelegation-taxonomy.md](../decisions/adr-028-audit-log-enrichment-skipdelegation-taxonomy.md)
- Cutover air-gap (handoff D3.5) : [cutover-prod-airgap.md](cutover-prod-airgap.md)
- Alerting SMTP (invite emails) : [alerting.md](alerting.md)
