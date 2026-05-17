# XCH — Handoff checklist 2e administrateur

> **Objet** : checklist d'onboarding d'un 2e administrateur opérationnel XCH (lever le bus-factor=1 critique pour pilote prod).
> **Public cible** : nouvel admin (RSI ou client final) reprenant ou doublant le rôle d'opérateur XCH.
> **Date** : 2026-05-17 — Track E.4 PR3
> **Versionnage** : v2.4.0
> **Décision Track E parent** : D3.5 — 2e admin nommé pendant Track E.3 (RSI propose, employeur valide).

---

## Comment utiliser cette checklist

1. Lire ce document de bout en bout (≈ 30 min)
2. Pour chaque section, cocher `[x]` au fur et à mesure (commit dans repo client OU PDF signé)
3. Section 6 — sign-off : signature numérique ou physique des deux admins (1er + 2e) et du DPO
4. Conservation : ce document signé dans le dossier RGPD client + un exemplaire au coffre RSI

---

## Section 1 — Credentials

### 1.1 SSH xch-deploy
- [ ] Clé SSH publique du 2e admin ajoutée à `~/.ssh/authorized_keys` de l'utilisateur `deploy` sur xch-deploy
- [ ] Test connexion : `ssh xch-deploy` répond
- [ ] Documentation alias SSH : `~/.ssh/config` côté admin (Host, User, IdentityFile)
- [ ] Procédure révocation documentée (qui retire la clé si l'admin quitte) — pointer `server-hardening.md`

### 1.2 Sudoers
- [ ] Compte unix `<NEW_ADMIN>` créé sur xch-deploy (groupe `sudo`)
- [ ] Test `sudo -i` répond
- [ ] Logging sudo activé (`/var/log/auth.log` cf `server-hardening.md`)

### 1.3 Comptes XCH applicatifs
- [ ] Compte super-admin XCH créé pour 2e admin (UI : Settings > Users > Create)
- [ ] Email reçu pour reset password initial
- [ ] Test login + SSO si configuré
- [ ] **NE PAS partager le compte du 1er admin** (audit trail individuel obligatoire)

### 1.4 Password démo et secrets opérationnels
- [ ] Password démo `Demo1234` connu **uniquement pour environnement de démo** — JAMAIS utilisé en prod
- [ ] Procédure rotation `JWT_SECRET` / `MINIO_ROOT_PASSWORD` / `POSTGRES_PASSWORD` documentée (pointer `secrets-rotation.sh`)
- [ ] Vault opérateur partagé (Bitwarden, KeePass, Vaultwarden self-hosted) — accès 2e admin validé
- [ ] Passphrase LUKS USB offsite communiquée (cf `offsite-backup.md` §5) — stockée dans le vault

### 1.5 Accès domain / DNS
- [ ] Si Mode A/D (DNS public) : accès registrar pour gérer cert renewal
- [ ] Si Mode B (DNS interne client) : contact IT client pour modifs DNS
- [ ] Si Mode C (air-gap) : pas de DNS externe, juste `<DNS_INTERNE>` interne

---

## Section 2 — Monitoring

### 2.1 GlitchTip
- [ ] URL GlitchTip self-hosted connue : `https://<DEPLOY_DOMAIN>/glitchtip` (ou port dédié selon mode)
- [ ] Compte 2e admin créé dans GlitchTip
- [ ] Test : recevoir une notification (peut être déclenché via `_test-error` endpoint)
- [ ] Rétention configurée : 90 jours (`GLITCHTIP_MAX_EVENT_LIFE_DAYS=90`)
- [ ] Pointer doc : référencer MCP `XCH_S8_GLITCHTIP_HANDOFF` pour détails internes

### 2.2 Grafana
- [ ] URL Grafana : `https://<DEPLOY_DOMAIN>:3000` (ou port selon mode)
- [ ] Compte 2e admin créé (rôle Editor ou Admin selon convention)
- [ ] Dashboards critiques connus :
  - System health (CPU / RAM / disk / network)
  - PostgreSQL metrics
  - Backup job duration (Track D.1 / D.2)
  - HTTP request latency p50/p95/p99
- [ ] Procédure : que faire si CPU > 80 % soutenu ? → pointer `incident-response.md`

### 2.3 Gatus / health monitoring
- [ ] URL Gatus connue (si déployé) : `https://<DEPLOY_DOMAIN>/gatus`
- [ ] Webhook alerting configuré (pointer `alerting.md`)
- [ ] Test : déclencher une alerte (stopper container backend → Gatus doit notifier)

### 2.4 Audit log
- [ ] Connaître la table `audit_log` (Prisma model `AuditLog`)
- [ ] Connaître les actions auditées (cf ADR-028 §A taxonomy `@SkipDelegation`)
- [ ] Connaître la purge cron mensuelle (rétention 1 an, D4.3 Track E parent)
- [ ] Procédure investigation : "qui a fait quoi à quelle heure depuis quelle IP ?" → query SQL exemple dans doc

---

## Section 3 — Runbooks must-read

Les 5 runbooks suivants doivent être **lus intégralement** + **exercés au moins une fois** avant le sign-off :

- [ ] [`bootstrap-runbook.md`](bootstrap-runbook.md) — wipe + bootstrap end-to-end (validé 2 cycles v2.3.4)
- [ ] [`dr-drill.md`](dr-drill.md) — RTO/RPO measured + §10 Pass 5 drill runbook
- [ ] [`recovery-runbook.md`](recovery-runbook.md) — service-down scenarios (Postgres / Redis / MinIO / Backend) + §9 migration v2.4.0 timing
- [ ] [`rollback.md`](rollback.md) — Git tag rollback + data restore procedure
- [ ] [`incident-response.md`](incident-response.md) — on-call escalation + playbooks

**Runbooks complémentaires** (à connaître mais pas obligatoire en sign-off) :
- [`alerting.md`](alerting.md) — SMTP relay + Grafana + Prometheus
- [`offsite-backup.md`](offsite-backup.md) — LUKS rotation (obligatoire si Mode C)
- [`server-hardening.md`](server-hardening.md) — UFW + SSH key-only + fail2ban
- [`cert-management.md`](cert-management.md) — TLS rotation
- [`backup-key-rotation.md`](backup-key-rotation.md) — rotation clé chiffrement backup
- [`secrets-rotation.sh`](secrets-rotation.sh) — script rotation secrets phases A/B/C
- [`rgpd-multi-mode.md`](rgpd-multi-mode.md) — conformité RGPD par mode

---

## Section 4 — Drill mensuel restore

**Cadence** : **trimestrielle** pour pilote (Mode C — D4.4 Track E parent) ; mensuelle si convention client renforcée.

### 4.1 Procédure drill
- [ ] Lire `dr-drill.md` §10 (Pass 5 PR2 — v2.4.0 candidate)
- [ ] Exécuter drill restore complet via `scripts/restore-full.sh`
- [ ] Mesurer RTO réel (backup + restore + smoke)
- [ ] Vérifier migration `delegationId` rejouée intact post-restore
- [ ] Vérifier notification `BACKUP_COMPLETED` reçue (Slack / email selon `alerting.md`)
- [ ] Si Mode C : test restore depuis USB offsite LUKS (rotation hebdo)

### 4.2 RTO/RPO cibles
- **RTO** (Recovery Time Objective) : ≤ 1 h pour Mode C pilote (mesuré Pass 5 PR2)
- **RPO** (Recovery Point Objective) : ≤ 7 jours pour Mode C avec rotation hebdo (cf `dr-drill.md` §6.4)

### 4.3 Documentation
- [ ] Compte rendu drill stocké dans `docs/operator/drill-reports/YYYY-MM-DD-drill.md` (à créer post-drill)
- [ ] Notifier DPO si RTO/RPO dégrade → revue procédure

---

## Section 5 — On-call rotation et escalade

### 5.1 Rotation
- [ ] Convention rotation définie entre 1er et 2e admin (ex : semaine impaire 1er, semaine paire 2e)
- [ ] Calendrier publié (partage Outlook / Google Calendar / etc.)
- [ ] Astreinte téléphonique documentée (qui décroche, à quels horaires)

### 5.2 Contacts escalade
> **Placeholders à compléter par client** :

| Niveau | Rôle | Contact | Délai d'engagement |
|---|---|---|---|
| N1 | Admin XCH on-call | `<ADMIN_ONCALL_EMAIL>` / `<ADMIN_ONCALL_PHONE>` | < 30 min ouvré |
| N2 | Lead RSI XCH | `<RSI_LEAD_EMAIL>` | < 2 h |
| N3 | DPO client | `<CLIENT_DPO_EMAIL>` | Si incident RGPD < 24 h |
| N4 | Direction client | `<CLIENT_ESCALATION_EMAIL>` | Si downtime > 8 h |

### 5.3 Procédure incident
- [ ] Lire `incident-response.md` intégralement
- [ ] Connaître les 3 niveaux de gravité (P1 / P2 / P3) et délais de réponse
- [ ] Connaître la procédure communication interne (Slack / email) + externe (utilisateurs finaux)

### 5.4 Communication crisis
- [ ] Template email "downtime planned" pré-rédigé
- [ ] Template email "incident en cours" pré-rédigé (cf `incident-response.md`)
- [ ] Liste diffusion utilisateurs maintenue à jour

---

## Section 6 — Sign-off

Sign-off après complétion intégrale Sections 1-5 :

### 6.1 Validation par le 2e admin
- [ ] J'ai lu et compris l'intégralité de ce document
- [ ] J'ai exercé au moins une fois chacun des 5 runbooks must-read
- [ ] J'ai accès aux credentials Section 1
- [ ] J'ai accès aux monitoring tools Section 2
- [ ] J'ai participé à un drill restore (Section 4)
- [ ] Je connais la procédure escalade Section 5
- [ ] Je m'engage à respecter la politique de rétention RGPD (cf `rgpd-multi-mode.md`)

**Nom** : ______________________
**Date** : ______________________
**Signature** : ______________________

### 6.2 Validation par le 1er admin
- [ ] J'ai accompagné le 2e admin pendant l'onboarding
- [ ] J'ai validé son accès à tous les systèmes listés
- [ ] J'ai exécuté un drill conjoint avec le 2e admin

**Nom** : ______________________
**Date** : ______________________
**Signature** : ______________________

### 6.3 Validation DPO (si applicable)
- [ ] DPO informé de la désignation du 2e admin
- [ ] DPO a validé le profil d'accès RGPD

**Nom** : ______________________
**Date** : ______________________
**Signature** : ______________________

---

## Annexe — Calendrier de revue handoff

| Échéance | Action |
|---|---|
| **J+30** | Point post-onboarding 1er + 2e admin (retours, gaps) |
| **J+90** | Premier drill restore par le 2e admin en solo |
| **J+180** | Revue accès (rotation passwords, révocation accès obsolètes) |
| **Annuel** | Revue complète handoff + mise à jour ce document |

---

## Cross-références

- [deployment-modes.md](deployment-modes.md) — modes de déploiement (impact sur Section 1 et 2)
- [dr-drill.md](dr-drill.md) — drill restore §10 Pass 5 PR2
- [recovery-runbook.md](recovery-runbook.md) — scénarios récupération
- [rgpd-multi-mode.md](rgpd-multi-mode.md) — conformité RGPD (à inclure formation 2e admin)
- [incident-response.md](incident-response.md) — escalade Section 5
- [offsite-backup.md](offsite-backup.md) — LUKS rotation Section 4 (Mode C)
- [secrets-rotation.sh](secrets-rotation.sh) — rotation Section 1.4
