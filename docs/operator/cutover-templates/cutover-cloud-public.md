# XCH Cutover — Cloud public (template DRY-RUN)

> ⚠️ **TEMPLATE DRY-RUN** — validation réelle Track G future quand un client cloud public se présente. Ne PAS exécuter en l'état sans audit complet.
> Mode A (cf. [deployment-modes.md §3.1](../deployment-modes.md#31-cloud-public-mode-a)).
> Placeholders : `<DEPLOY_DOMAIN>`, `<ADMIN_EMAIL>`, `<ORG_NAME>`, `<SMTP_PROVIDER>`, `<SSO_TENANT_ID>`, `<CLOUD_REGION>`.

---

## 1. Pré-cutover (J-7 à J-1)

- [ ] Compte cloud provider (`<CSP>`) provisionné + budget validé
- [ ] DNS `<DEPLOY_DOMAIN>` pointé vers le LB (Cloudflare A record + proxy ON)
- [ ] Cert TLS via Let's Encrypt configuré (DNS-01 challenge si Cloudflare proxy)
- [ ] SMTP provider account (`<SMTP_PROVIDER>` : Mailgun, SES, Brevo, etc.) + DKIM/SPF validés sur `<DEPLOY_DOMAIN>`
- [ ] SSO Entra ID / Google Workspace / Okta : tenant créé, application redirect URI `https://<DEPLOY_DOMAIN>/api/auth/sso/callback`, secret généré + stocké vault
- [ ] Database managed (Postgres RDS / Cloud SQL / Azure Database) + extension PostGIS activée + backup auto activé
- [ ] Storage S3 ou MinIO managed (Backblaze B2, Wasabi, S3) — bucket `xch-storage` + `xch-backups` créés + versioning ON + cross-region replication
- [ ] Redis managed (Elasticache, Memorystore, Azure Cache) + AUTH password généré
- [ ] Monitoring Grafana Cloud OR Datadog : workspace prêt, datasource configurée
- [ ] VM applicatif provisioned (compute Engine, EC2, Azure VM) — 4 vCPU / 8 GB / 80 GB SSD
- [ ] Pre-bootstrap : `docker compose pull` (registry public + private si images custom)

## 2. Cutover (J-day)

Suivre [bootstrap-runbook.md](../bootstrap-runbook.md) §2-7 avec adaptations :

```bash
# .env adaptations Mode A vs C
DATABASE_URL=postgresql://xch_user:<RDS_PASS>@<RDS_HOST>:5432/xch_dev   # managed DB
REDIS_HOST=<ELASTICACHE_ENDPOINT>                                       # managed Redis
MINIO_ENDPOINT=s3.amazonaws.com                                         # OR https://s3.eu-west-3.amazonaws.com
MINIO_BUCKET=<XCH_STORAGE_BUCKET>
SMTP_HOST=<SMTP_PROVIDER_HOST>                                          # smtp.mailgun.org, etc.

# SSO (vs air-gap local-only)
SSO_PROVIDER=entra-id   # OR google, okta
SSO_CLIENT_ID=<...>
SSO_CLIENT_SECRET=<...>

COOKIE_SECURE=true
COOKIE_DOMAIN=.<DEPLOY_DOMAIN>   # subdomain wildcard

# GlitchTip cloud (optionnel — sinon SaaS Sentry)
GLITCHTIP_DSN_BACKEND=<...>
```

## 3. Post-cutover

- [ ] Smoke 6/6 PASS
- [ ] SSO login round-trip PASS (test avec compte directory)
- [ ] Email roundtrip via SMTP provider PASS
- [ ] DR drill cloud (snapshot RDS + S3 backup restore) — cf. [dr-drill.md](../dr-drill.md) adapté
- [ ] Backup automatique cron quotidien activé (vs on-demand Mode C)
- [ ] Monitoring : 4 panels minimum (Grafana cloud) + alerting PagerDuty / Opsgenie
- [ ] Audit log retention 7 ans + S3 lifecycle policy

## 4. Risques spécifiques Mode A (vs Mode C)

- ⚠️ CSP breach : multi-tenant blast radius si bug d'isolation tenant
- ⚠️ Cost spike inopiné (egress S3, RDS oversize) — alarme budget impérative
- ⚠️ Conformité RGPD : sous-traitant cloud = DPA contractuel obligatoire
- ⚠️ Vendor lock-in : migration cloud-to-cloud = projet de plusieurs semaines

## 5. Cross-références

- Référence mode : [deployment-modes.md §3.1](../deployment-modes.md#31-cloud-public-mode-a)
- Bootstrap commun : [bootstrap-runbook.md](../bootstrap-runbook.md)
- Décisions Track E parent (§D-décisions) : MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15`
