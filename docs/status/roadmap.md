# XCH — Roadmap (timeline réelle livrée)

> **Source de vérité** : `git tag --sort=-creatordate` et les entités MCP `XCH_TRACK_*_*`.
> **Date** : 2026-05-17 — Track E.4 PR3 (rewrite complet : ancien modèle Phase 1-7 agents archivé dans `docs/archive/roadmap-v1.0-2025-12-31.md`).
> **Version courante** : v2.4.0 (en cours de release).
> **Modèle** : sessions S0–S11 (plan v2) + Tracks A/B/C/D/E (post-pilote) + Tracks F/G/D.3 (backlog).

---

## Timeline livrée (v1.0 → v2.4.0)

### Phase amorce — v1.0 → v1.4 (mars-avril 2026)
- **v1.0.0-rc1** (2026-03-15) — MVP complet : 10 modules backend, 7 modules frontend, 100+ endpoints
- **v1.0.3** (2026-01-18) — corrections post-livraison initiale
- **v1.1.x → v1.4.0** (avril 2026) — audit phases 1-4 + RBAC + Apparence + delegation-first

### Phase plan v2 (audit phase 5 + finalisation) — v1.5 → v2.0 (avril-mai 2026)

| Session | Livrable | Tag | Date |
|---|---|---|---|
| S0 + bump version | 1.5.0 + script parité | — | — |
| S1 | Sécurité hardening (rotation secrets, Redis auth, Multer, magic-bytes) — ADR-015 | — | — |
| S4 | Tests Jest critical paths (80 tests) | — | — |
| S2 | Monitoring natif (ADR-014/016) | — | — |
| S5 | Migrations Prisma versionnées (ADR-017) | — | 2026-04-27 |
| S6/S7 | Refacto JSON résiduel (ADR-018) | **v1.6.0** | 2026-04-28 |
| S1 finalization | Quick wins post-v1.6 | v1.6.1 | 2026-04-29 |
| S2 finalization | Chiffrement secrets at-rest (ADR-019) | v1.6.2 | 2026-04-29 |
| S3 finalization | NotificationConfig + Worker BullMQ (ADR-020) | v1.7.0 | 2026-04-29 |
| S4 finalization | RBAC universel + tests intrusion (ADR-021) | v1.8.0 | 2026-04-30 |
| S5 finalization | Performance & intégrité DB | v1.8.1 | 2026-05-01 |
| S6 finalization | UX dark canvas + erreurs réseau | v1.8.2 | 2026-05-01 |
| S7 finalization | E2E Playwright scaffolding (~210 tests) | (intermédiaire) | 2026-05-02 |
| S7.5 | Validation E2E réelle + smoke @full-user-journey 10/10 | **v1.9.0** | 2026-05-03 |
| S9 hardening | CSP nonce dynamique + 100% DTO coverage (30+ endpoints) + cascade vague A+B | v1.10.0 / v1.11.0 / **v2.0.0** | 2026-05-04 / 2026-05-06 |
| S8 GlitchTip | Sentry → GlitchTip self-hosted air-gap (ADR-024) | **v2.1.0** | 2026-05-08 |
| S5b | Heavy SQL refactors (GENERATE_SERIES + group-by) | v2.1.1 | 2026-05-09 |

**Plan v2 CLOSED** à v2.0.0 — toutes sessions S0-S11 livrées. v2.1.x = patches post-pilote.

### Phase Tracks post-pilote (test global 2026-05-09 → preprod readiness) — v2.1.2 → v2.4.0

| Track | Description | PR / Tag | Date |
|---|---|---|---|
| **A** | Bugs prod-bloquants (B1+B2+B4+B6+B7+B9 — pagination, theme persist, fetch loop, budgets banner) | PRs #62 #63 #64 + #66 release | 2026-05-10 |
| **B** | UI/UX professionnalisation (U1+U2+U3+U4+U5+U7+B8 — Import CSV, Contacts, Monitoring, avatars, Settings, Budgets) | PR #65 | 2026-05-10 |
| **A+B release** | Bundle CHANGELOG | **v2.1.2** | 2026-05-10 |
| **C** | Bugs secondaires (B3 floor-plans DTO root cause + B10 backup completeness 9 tables + ts-nocheck cleanup) | PRs #67 #68 | **v2.1.3** 2026-05-10 |
| **chore v2.1.4** | Nettoyage Gatus vestigial + retrait `docker-compose.prod.yml` legacy | PR #69 | **v2.1.4** 2026-05-12 |
| **D.1** | Backup v2 (streaming + idempotent restore + dry-run + async Bull v3) — ADR-025 | PR #70 + #71 hotfix listBackups | **v2.2.0 + v2.2.1** 2026-05-14 |
| **D.2** | Backup v2 Polish (chiffrement AES-256-GCM + cross-tenant + multipart + observabilité GlitchTip + concurrency Bull) | PR #72 + #73 hotfix (multipart shared volume + BOLA restore tenant scope) | **v2.3.0 + v2.3.1** 2026-05-15 |
| **E.1** | Security audit + BOLA scan global + egress audit air-gap | PR #74 hotfix C-E1-1 (sites.update BOLA tenant scoping) | **v2.3.2** 2026-05-15 |
| **E.2** | DR drill + monitoring self-hosted (Grafana réutilisé) + alerting SMTP + offsite LUKS rotation hebdo + readiness probe `/api/health` | — | **v2.3.3** 2026-05-16 |
| **E.3** | Air-gap bootstrap (`teardown-xch-stack.sh` + `bootstrap-runbook.md`) + cutover templates 4-mode + Track E.3 catastrophe forensic + ADR-029 Proposed | — | **v2.3.4** 2026-05-16 |
| **E.4 PR1** | ADR-028 audit log enrichment + 4 CI workflows + BACKUP_COMPLETED notification + cron purge audit log + ADR-025b Proposed | PR #80 | déployé 2026-05-16 |
| **E.4 PR2** | Testing harness k6 load + Lighthouse/axe a11y + DR drill runbook §10 + recovery-runbook §9 migration timing | PRs #81 #82 #83 #84 #85 (suivi follow-ups) | mergé 2026-05-16 |
| **E.4 PR3** | Docs closure : RGPD multi-mode + handoff 2e admin + changelog-users + PROJECT_STATUS refresh + DEVELOPMENT_LOG Sessions 13-17 + placeholder audit Tier A/B/C + plan v3 MCP + auto-update-docs append | (cette release) | **v2.4.0 cible** 2026-05-17 |

**Tracks A-E CLOSED** à v2.4.0 — preprod-readiness atteinte.

---

## Backlog post-v2.4.0 (Track F / G / D.3)

> **Détails complets** : MCP entité `XCH_PLAN_V3_POST_V2_2026_05_17` (consolidation Pass 10 Track E.4 PR3).

### Track F — Compliance + a11y suite + sécurité externe

- **F.1** — a11y suite V2 fallback : 13 violations color-contrast déférées (`docs/perf/a11y-followup-track-f.md`)
- **F.2** — RBAC GET investigation (TODO bookmark Track E.3)
- **F.3** — POST `/api/assets` unique race condition (test scénario)
- **F.4** — `npm audit` triage vulnerabilities en attente
- **F.5** — DPA formel signé client (template fournis dans `docs/operator/rgpd-multi-mode.md` Annex)
- **F.6** — Pen test externe (post-cutover prod stabilisé)
- **F.7** — Automatisation droits RGPD utilisateur final (export self-service, anonymisation audit)
- **ADR-029** — SSO/LDAP arbitrage M0 cutover (stakeholder ouvert, défer M+1-3 selon besoin)

### Track G — Performance consolidée

- **G.1** — Tuning index Prisma post-load réel (réeval baseline run #4)
- **G.2** — N+1 fix éventuel (sites avec > 100 assets si remonté production)
- **G.3** — BullMQ tuning si jobs backup > 10s soutenu
- **G.4** — Cache Redis tier ajouté si p95 > 300ms (seuil ADR à formaliser)
- **G.5** — Audit NK strict expenses (drift mineur observé en DR drill — déféré ADR-025b)

### Track D.3 — Validation cutover réel non-air-gap

- **D.3.1** — Validation cutover Mode A (cloud public) sur 2e client réel
- **D.3.2** — Validation cutover Mode B (cloud privé) sur 2e client réel
- **D.3.3** — Validation cutover Mode D (VPS basique) sur 2e client réel
- **D.3.4** — Drill restore prod réel (vs drill dev Pass 5 actuel)
- **D.3.5** — Bootstrap fresh server < 10 min KPI tenu en conditions réelles

---

## Décisions architecturales notables

| ADR | Sujet | Statut |
|---|---|---|
| ADR-014/016 | Monitoring natif | Accepté |
| ADR-015 | S1 Security hardening | Accepté |
| ADR-017 | Prisma versioned migrations | Accepté |
| ADR-018 | JSON debt cleanup (Asset/Tenant/Site) | Accepté |
| ADR-019 | Chiffrement secrets at-rest | Accepté |
| ADR-020 | NotificationConfig + Worker BullMQ | Accepté |
| ADR-021 | RBAC universel | Accepté |
| ADR-024 | GlitchTip self-hosted air-gap | Accepté |
| **ADR-025** | Backup v2 streaming + idempotent restore | Accepté |
| ADR-025b | NK expenses arbitrage (intentional `delegationId` exclusion) | Proposed |
| **ADR-028** | Audit log enrichment + taxonomy `@SkipDelegation` | Accepté |
| ADR-029 | SSO LDAP migration path (Options A/B/C) | Proposed |

---

## Cross-références

- [PROJECT_STATUS.md](PROJECT_STATUS.md) — état projet courant détaillé
- [`docs/decisions/`](../decisions/) — tous les ADRs
- [`docs/operator/`](../operator/) — runbooks opérateur (handoff, DR, RGPD, cutover, etc.)
- [`docs/business/CAHIER_DES_CHARGES.md`](../business/CAHIER_DES_CHARGES.md) — spécifications fonctionnelles
- [`CHANGELOG.md`](../../CHANGELOG.md) — détail technique par version
- [`docs/user/changelog-users.md`](../user/changelog-users.md) — journal utilisateur non-jargon
- MCP knowledge graph — entités `XCH_TRACK_*_*`, `XCH_RELEASE_*`, `XCH_PLAN_*`

---

**Roadmap maintenue par le lead technique (architecte XCH). Updates à chaque tag stable.**
