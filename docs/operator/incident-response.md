# XCH — Incident Response Playbook — Track E.2 Pass 8

> **Scope** : flux opérateur unifié quand quelque chose tombe en prod XCH. Référence centrale qui pointe vers les autres runbooks selon la nature de l'incident.
> **Placeholders Option C** : `<OPS_ONCALL>`, `<SECURITY_LEAD>`, `<DEPLOY_DOMAIN>`, `<DEPLOY_HOST>`.

---

## 0. TL;DR — flux 5 phases

```
DETECT  →  ASSESS  →  CONTAIN  →  RECOVER  →  POST-MORTEM
   ↓          ↓          ↓           ↓            ↓
Grafana    smoke +   docker        restore     template §6
 alerts   audit-     compose       runbooks    (apprentissages)
/api/health egress    stop                       MCP closure
            curl
```

Chaque section ci-dessous détaille les commandes + qui prévenir.

---

## 1. DETECT — comment savoir qu'il y a un incident

### 1.1 Signaux automatiques

| Source | Trigger | Action immédiate |
|---|---|---|
| **Grafana panel `/api/health`** ([alerting.md §3.2 panel 4](alerting.md#34-4-panel-4--apihealth-probe-http-infinity-plugin-polling-60s)) | `status != ok` pendant > 2 cycles (120s) | Notifier `<OPS_ONCALL>` via Teams/SMS |
| **Grafana panel uptime 24h** ([alerting.md §3.2 panel 1](alerting.md#31-panel-1--uptime--24h-par-check-stat-panel-agrégat-global)) | < 95% sur fenêtre 1h | Vérifier panel 2 (failed checks) |
| **NotificationEmitter MONITOR_DOWN** | Site/asset critique DOWN | Email automatique vers admin tenant (D2.1) |
| **GlitchTip new issue** (auto) | Exception backend / worker / frontend | Notification GlitchTip UI ou email digest |
| **/api/health 503** | Probe externe (uptime monitor, etc.) | Alerte selon outil monitoring |

### 1.2 Signaux manuels

- Utilisateur signale un problème UI (login impossible, upload échoue, etc.)
- Audit log inhabituel (échecs d'authentification en série, accès cross-tenant)
- Performance dégradée non liée à un incident infrastructure

### 1.3 Premier réflexe (≤ 1 min)

```bash
# 1. Sonde santé immédiate
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .

# 2. Smoke endpoints
bash scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>

# 3. Container status
ssh <DEPLOY_HOST> "cd /opt/<DEPLOY_DIR> && docker compose ps"
```

Si tout est vert → c'est probablement une fausse alerte (vérifier le panel Grafana qui a alerté, peut-être un blip transient). Logger en `incident-log.md` et continuer.

Si rouge → passer à **ASSESS** §2.

---

## 2. ASSESS — diagnostiquer la cause racine

### 2.1 Diagnostic systématique (~5 min)

```bash
# A. Health probe détaillé
curl -s https://<DEPLOY_DOMAIN>/api/health | jq '.details'
# → identifie quel composant est down (db / redis / minio) et l'erreur précise

# B. Audit egress (vérifier que rien ne fuit en cas de compromission suspectée)
ssh <DEPLOY_HOST> "cd /opt/<DEPLOY_DIR> && bash scripts/audit-egress.sh"
# → 4 assertions, attendu PASS 4/4 sur air-gap pilote

# C. Logs récents
ssh <DEPLOY_HOST> "docker logs xch-backend --since 15m --tail 100" 2>&1 | tail -50
ssh <DEPLOY_HOST> "docker logs xch-backend-worker --since 15m --tail 50"
ssh <DEPLOY_HOST> "docker logs xch-frontend --since 15m --tail 30"

# D. Disk space (cause fréquente de failure cascadé)
ssh <DEPLOY_HOST> "df -h /var /opt /tmp"
ssh <DEPLOY_HOST> "docker system df"

# E. RAM
ssh <DEPLOY_HOST> "free -h; docker stats --no-stream | head -10"

# F. Recent commits
ssh <DEPLOY_HOST> "cd /opt/<DEPLOY_DIR> && git log --oneline -5"
# → identifier un déploiement récent qui aurait pu casser
```

### 2.2 Classification

| Symptôme | Catégorie | Runbook |
|---|---|---|
| `details.db.status = down` | Infrastructure | [recovery-runbook.md §1 Postgres](recovery-runbook.md#1-scénario-a--postgres-down) |
| `details.redis.status = down` | Infrastructure | [recovery-runbook.md §2 Redis](recovery-runbook.md#2-scénario-b--redis-down) |
| `details.minio.status = down` | Infrastructure | [recovery-runbook.md §3 MinIO](recovery-runbook.md#3-scénario-c--minio-down) |
| Connection refused sur API entière | Backend crashed | [recovery-runbook.md §4 Backend](recovery-runbook.md#4-scénario-d--backend-container-crashedloop) |
| Smoke 5/6 mais aucun job traité | Worker crashed | [recovery-runbook.md §5 Worker](recovery-runbook.md#5-scénario-e--worker-container-down-backend-ok-mais-aucun-job-traité) |
| Data corruption / loss confirmée | DR | [dr-drill.md §3](dr-drill.md#3-procédure-exacte-reproductible) (restore depuis backup) |
| Disk full | Capacité | `docker system prune -af` + investigation logs MinIO (Track E.4) |
| Compromission suspectée (BOLA, brute force, secrets fuités) | Sécurité | **STOP et appeler `<SECURITY_LEAD>` AVANT toute action** |
| Performance dégradée sans crash | Tuning | Hors scope incident response — backlog Track E.4 (load test k6) |

### 2.3 Escalation

- **`<OPS_ONCALL>`** : par défaut tout incident (notifications channel Teams ou email D2.1)
- **`<SECURITY_LEAD>`** : si compromission suspectée — **ne PAS toucher au système** avant son arrivée (préservation des preuves forensiques)
- **Équipe développement** : si crash applicatif post-déploiement → rollback git + ticket
- **IT employeur** : si infrastructure VM / réseau / certificats hors XCH

---

## 3. CONTAIN — isoler le problème

### 3.1 Containment standard

```bash
# Mettre le backend en read-only (si possible) ou complètement down si compromission
ssh <DEPLOY_HOST> "cd /opt/<DEPLOY_DIR> && docker compose stop backend backend-worker"

# Notifier les utilisateurs (page maintenance) — Track E.4 (nginx maintenance.html)

# Snapshot état actuel pour forensique (si compromission suspectée)
ssh <DEPLOY_HOST> "cd /opt/<DEPLOY_DIR> && docker compose logs --no-color --since 24h > /tmp/incident-$(date +%s).log"

# Backup immédiat AVANT toute manip — preuve de l'état au moment de l'incident
# (cf. dr-drill.md §3.2 pour la commande de backup)
```

### 3.2 Si compromission suspectée (BOLA, vol de session, etc.)

- **Révoquer toutes les sessions JWT actives** : redémarrer le backend avec un `JWT_SECRET` rotated (cf. `scripts/rotate-secrets.sh`).
- **Bloquer l'IP source** (si identifiable via audit log `ipAddress` post-Track E.4 ADR-028) au niveau UFW ou NPM.
- **Préserver les logs** : copier `docker compose logs` + `journalctl` complets vers stockage forensique.
- **NE PAS** redéployer / nettoyer / restaurer avant analyse — perte des preuves.

---

## 4. RECOVER — remettre en service

### 4.1 Selon le scénario

→ Voir [recovery-runbook.md](recovery-runbook.md) pour les 5 scénarios infrastructure standards.
→ Voir [dr-drill.md](dr-drill.md) pour la procédure de restore depuis backup (data loss).
→ Voir [offsite-backup.md §4](offsite-backup.md#4-restore-depuis-offsite-dr-critique) pour restore depuis USB offsite (perte VM complète).

### 4.2 Validation post-recovery (checklist obligatoire)

- [ ] `/api/health` → 200 `status:ok`
- [ ] `bash scripts/smoke-prod.sh` → PASS 6/6
- [ ] `bash scripts/audit-egress.sh` → no new leak detected
- [ ] Grafana panel `/api/health` revient à vert (latence 60s polling)
- [ ] Login fonctionnel (test manuel : `https://<DEPLOY_DOMAIN>/login` → connexion admin)
- [ ] 1 MONITOR_DOWN/UP event arrive sur le canal email (preuve pipeline alerting OK)
- [ ] Backup post-recovery déclenché (preuve catalog accessible + MinIO write OK)
- [ ] CHANGELOG.md ou `incident-log.md` mis à jour

---

## 5. POST-MORTEM — apprendre

### 5.1 Quand faire un post-mortem ?

- **Tout incident bloquant > 30 min**
- Tout incident impliquant data loss ou compromission de sécurité
- Tout incident répété (3e occurrence dans le mois pour la même cause)

### 5.2 Template post-mortem

À copier dans `docs/operator/post-mortems/<YYYY-MM-DD>-<titre-court>.md` (créer le dossier au premier post-mortem).

```markdown
# Post-mortem : <titre court de l'incident>

**Date incident** : YYYY-MM-DD HH:MM (timezone)
**Détection** : YYYY-MM-DD HH:MM (timezone)
**Recovery complet** : YYYY-MM-DD HH:MM (timezone)
**Auteur post-mortem** : <OPS_ONCALL>
**Sévérité** : SEV-1 (data loss / breach) | SEV-2 (downtime) | SEV-3 (dégradation)
**Durée downtime** : XXmin
**Utilisateurs impactés** : XX (ou ALL / nuance)

## 1. Résumé en 3 lignes

(En 30 sec, qu'est-ce qui s'est passé et qu'est-ce qu'on a fait ?)

## 2. Timeline

| Time | Event |
|---|---|
| HH:MM | Premier signal (Grafana alert / utilisateur / etc.) |
| HH:MM | Diagnostic initiated par <PERSON> |
| HH:MM | Cause racine identifiée |
| HH:MM | Containment appliqué |
| HH:MM | Recovery démarrée |
| HH:MM | Smoke 6/6 PASS — service rétabli |
| HH:MM | Notification utilisateurs envoyée |

## 3. Cause racine

(Description technique précise — pas juste « le serveur a planté ». Quel composant ? Quelle cascade ?)

## 4. Ce qui a bien fonctionné

- (Détection automatique via Grafana panel X)
- (Runbook §Y suivi sans hésitation)
- (Restore en N min vs RTO target de M min)

## 5. Ce qui n'a pas bien fonctionné

- (Pas de procédure documentée pour le scénario rencontré)
- (Alerte arrivée trop tard / aucune alerte automatique)
- (Backup le plus récent était de N jours → data loss de N jours)

## 6. Actions correctives

| Action | Owner | Deadline | Statut |
|---|---|---|---|
| 1. … | <PERSON> | YYYY-MM-DD | open / done |
| 2. … | <PERSON> | YYYY-MM-DD | open / done |
| 3. Update CHANGELOG.md / runbook | <OPS_ONCALL> | +7j | open |

## 7. Notes diverses

(Apprentissages, surprises, etc.)
```

### 5.3 Diffusion

- Post-mortem partagé avec **toute l'équipe interne** (transparence)
- Si SEV-1 : communiqué client/employeur résumant (en français, sans jargon technique)
- Actions correctives ajoutées au backlog Track E.4 ou Track F selon urgence

---

## 6. Drill (exercice trimestriel — D4.4 décision RSI)

D'après [MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15`](#) §20 décisions opérationnelles — **D4.4 = drill trimestriel (4 sessions/an)** :

| Trimestre | Scénario à exercer | Objectif RTO mesuré |
|---|---|---|
| Q1 | Restore depuis backup MinIO (`dr-drill.md` §3) | < 5 min (tenant < 1 GB) |
| Q2 | Restore depuis USB LUKS offsite (`offsite-backup.md` §4) | < 15 min (bootstrap inclus) |
| Q3 | Scénario service down (Redis ou MinIO restart, `recovery-runbook.md`) | < 2 min (procédure documentée) |
| Q4 | Drill « zéro confidence » : opérateur ne connaît pas le scénario à l'avance, runbook utilisé en aveugle | < 30 min |

Chaque drill se conclut par un post-mortem dans `docs/operator/post-mortems/`.

---

## 7. Contacts (à compléter par opérateur)

| Rôle | Personne | Canal | Backup |
|---|---|---|---|
| OPS on-call J1 | `<OPS_ONCALL>` | Teams / SMS | (à nommer Track E.4 handoff) |
| Security lead | `<SECURITY_LEAD>` | Teams / email | (à nommer Track E.4) |
| Dev XCH | RSI | GitHub issues | (n/a — solo) |
| IT employeur | `<IT_CONTACT>` | Teams / téléphone | (à nommer J1 cutover) |

---

## 8. Cross-références

- Sonde primaire : [backend/src/modules/health/health.controller.ts](../../backend/src/modules/health/health.controller.ts)
- Smoke : [scripts/smoke-prod.sh](../../scripts/smoke-prod.sh)
- Audit-egress : [scripts/audit-egress.sh](../../scripts/audit-egress.sh)
- Recovery scénarios : [recovery-runbook.md](recovery-runbook.md)
- DR drill : [dr-drill.md](dr-drill.md)
- Offsite LUKS : [offsite-backup.md](offsite-backup.md)
- Alerting (D2.1 SMTP + D2.2 Grafana) : [alerting.md](alerting.md)
- Audit V1 GlitchTip : [../audit/track-e2-glitchtip-state.md](../audit/track-e2-glitchtip-state.md)
- UFW enforce : [scripts/ufw-enforce.sh](../../scripts/ufw-enforce.sh)
- ADR audit log enrichment (forensique) : [../decisions/adr-028-audit-log-enrichment-skipdelegation-taxonomy.md](../decisions/adr-028-audit-log-enrichment-skipdelegation-taxonomy.md)
