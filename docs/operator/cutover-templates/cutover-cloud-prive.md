# XCH Cutover — Cloud privé client (template DRY-RUN)

> ⚠️ **TEMPLATE DRY-RUN** — validation réelle Track G future. Ne PAS exécuter sans audit complet.
> Mode B (cf. [deployment-modes.md §3.2](../deployment-modes.md#32-cloud-privé-client-mode-b)).
> Placeholders : `<CLIENT_DC_NAME>`, `<DEPLOY_DOMAIN>`, `<DNS_INTERNE>`, `<CA_BUNDLE>`, `<LDAP_HOST>`, `<NFS_SHARE>`.

---

## 1. Pré-cutover (J-7 à J-1)

- [ ] VM(s) provisionnée(s) par IT client (vSphere, OpenStack, Proxmox, Hyper-V) — specs équivalentes Mode A
- [ ] Réseau interne client + proxy/whitelist documenté (égress autorisé : Postgres internal, MinIO internal, GlitchTip internal, NFS, NTP interne, DNS interne)
- [ ] DNS : interne `<DNS_INTERNE>` OR public `<DEPLOY_DOMAIN>` si DNS-over-VPN
- [ ] Cert : CA interne client (`<CA_BUNDLE>` à fournir + installer dans NPM) OR Let's Encrypt si DNS public résolvable depuis Let's Encrypt
- [ ] LDAP/AD client : endpoint `<LDAP_HOST>:636`, service account read-only, DN base + filtre utilisateurs
- [ ] NFS share `<NFS_SHARE>` pour offsite backup
- [ ] Postfix relay client (si dispo) OR Postfix container co-hébergé
- [ ] Pre-bootstrap : `docker pull` depuis registry client (mirror interne) OU `docker load` depuis tarball

## 2. Cutover (J-day)

Suivre [bootstrap-runbook.md](../bootstrap-runbook.md) §2-7 avec adaptations :

```bash
# .env adaptations Mode B vs C
DATABASE_URL=postgresql://xch_user:<PG_PASS>@postgres:5432/xch_dev   # interne containerized
COOKIE_DOMAIN=<DEPLOY_DOMAIN>
FRONTEND_URL=https://<DEPLOY_DOMAIN>

# SSO LDAP/AD (vs local-only air-gap)
SSO_PROVIDER=ldap
SSO_LDAP_URL=ldaps://<LDAP_HOST>:636
SSO_LDAP_BIND_DN=cn=xch-svc,ou=services,dc=client,dc=local
SSO_LDAP_BIND_PASSWORD=<...>
SSO_LDAP_USER_BASE_DN=ou=users,dc=client,dc=local
SSO_LDAP_USER_FILTER=(&(objectClass=user)(mail={email}))

# Monitoring self-hosted (idem Mode C)
GLITCHTIP_DSN_BACKEND=http://<KEY>@glitchtip-web:8000/<PROJ>
GLITCHTIP_DSN_WORKER=http://<KEY>@glitchtip-web:8000/<PROJ>

# SMTP relay client
SMTP_HOST=<SMTP_RELAY_INTERNE>
SMTP_PORT=587
```

## 3. Post-cutover

- [ ] Smoke 6/6 PASS
- [ ] LDAP login round-trip PASS (test avec compte LDAP)
- [ ] Email roundtrip via SMTP relay client PASS
- [ ] DR drill avec restore depuis NFS share PASS
- [ ] Monitoring : Grafana SQL panels Track E.2 §3.2 alimentés
- [ ] Audit log retention selon politique client (1-7 ans)
- [ ] Drill trimestriel D4.4 planifié

## 4. Risques spécifiques Mode B (vs Mode C)

- ⚠️ Dépendance forte IT client : coordination pour patches OS + provisioning VMs supplémentaires
- ⚠️ LDAP rotation password service account : à coordonner pour éviter downtime auth
- ⚠️ NFS share permissions : risque de write conflict si partage entre plusieurs services client

## 5. Cross-références

- Référence mode : [deployment-modes.md §3.2](../deployment-modes.md#32-cloud-privé-client-mode-b)
- Bootstrap commun : [bootstrap-runbook.md](../bootstrap-runbook.md)
- Cutover air-gap référence : [cutover-prod-airgap.md](../cutover-prod-airgap.md)
