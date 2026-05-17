# XCH — Audit placeholders runbooks operator (Track E.4 PR3 Pass 8)

**Date** : 2026-05-17
**Scope** : `docs/operator/` + `docs/operator/cutover-templates/` (19 fichiers)
**Référence** : Track E.4 PR3 Pass 8 placeholder audit
**Méthodologie** : classification Tier A/B/C (décision user 2026-05-17)

---

## Méthodologie

### Tier A — vraie fuite (verdict cible : 0)
Patterns indiquant une fuite réelle d'information sensible :
- `@eoncom\.io` — emails RSI internes (hors banner explicatif)
- IPs prod réelles internes (RFC1918 dans contexte production réelle)
- Hostnames prod clients spécifiques (hors banner)

### Tier B — placeholder à nettoyer (verdict cible : 0)
Patterns indiquant un placeholder oublié :
- `\bXXX\b`, `TODO_PILOT`, `\bFIXME\b`, `\[REDACTED\]`, `\bTBD\b`
- `<nom_client_potentiel>`, `<CLIENT_NAME>` (génériques vides de substance)

### Tier C — faux positif acceptable (documenté, non-bloquant)
Patterns acceptables avec banner ou rationale documentée :
- `example\.com`
- IPs RFC1918 dans blocs de code génériques (`10.0.0.1`, `192.168.1.1`)
- `xch\.eoncom\.io` quand banner "EXEMPLE — remplacer par `<DEPLOY_DOMAIN>`" est présent
- `xch-deploy` (banc de test RSI, documenté Track E.3 stratégie v2.2)
- `github\.com/eoncom/XCH` (repo public légitime)

---

## Inventaire scan

### Étape 0 — IPs RFC1918 dans le scope

```bash
grep -rhoE "\b(10|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\.[0-9]+\.[0-9]+\b" \
  docs/operator/ docs/operator/cutover-templates/ | sort -u
```

**Résultat** : **0 occurrence**. Aucune IP RFC1918 dans `docs/operator/`. Étape de classification user non requise (liste vide).

> Note : des IPs internes (`192.168.0.13`, `192.168.0.39`) existent dans `docs/audit/`, `docs/decisions/`, `docs/guides/`, `docs/sessions/`, `docs/agents/`, `docs/archive/`. Ces sous-dossiers sont **explicitement hors scope** de Pass 8 (décision user : "focus runbooks opérateur pilote uniquement"). Le traitement de ces leaks sera arbitré en Track F (cf §"Hors scope" ci-dessous).

### Étape 1 — Scan Tier A (avant fix)

| Pattern | Commande | Résultat brut |
|---|---|---|
| `@eoncom\.io` (emails) | `grep -rnE "@eoncom\.io" docs/operator/ docs/operator/cutover-templates/` | 0 |
| Email pilote `noreply@xch.eoncom.io` | `grep -rnE "noreply@xch\.eoncom\.io"` | 1 (alerting.md L231) |
| Email test `alerts-test@demo.fr` | `grep -rnE "alerts-test@demo\.fr"` | 1 (alerting.md L232) |
| Hostname `xch-deploy` | `grep -rnE "xch-deploy"` | 32 occurrences (multiples runbooks) |
| Hostname `xch-monitor` | `grep -rnE "xch-monitor"` | 0 |
| Domaine `xch\.eoncom\.io` | `grep -rnE "xch\.eoncom\.io"` | 2 (alerting.md L231 + cutover-prod-airgap.md L45) |

### Étape 2 — Scan Tier B (avant fix)

| Pattern | Résultat brut |
|---|---|
| `\bTBD\b` | 3 (rgpd-multi-mode.md L198, L200, L271) |
| `\bXXX\b`, `TODO_PILOT`, `\bFIXME\b`, `\[REDACTED\]` | 0 |
| `<nom_client_potentiel>`, `<CLIENT_NAME>` | 0 |

### Étape 3 — Faux positifs anticipés (Tier C)

| # | Pattern | Localisation | Classification | Action |
|---|---|---|---|---|
| 1 | `xch.eoncom.io` | `cutover-prod-airgap.md` (table comparative + cas réel) | Tier C documenté | Ajout banner "EXEMPLE — remplacer par `<DEPLOY_DOMAIN>`" en tête de doc |
| 2 | `noreply@xch.eoncom.io` + `alerts-test@demo.fr` | `alerting.md` (JSON empirique Mailpit) | Tier A initial → Tier C après fix | Remplacement par placeholders `<NOREPLY_ADDRESS>` / `<ALERT_TEST_RECIPIENT>` + explication empirique préservée dans le narratif au-dessus du JSON |
| 3 | `github.com/eoncom/XCH` | `cutover-vps-basique.md` (clone repo) | Tier C documenté | Aucune action — repo public légitime |

---

## Décisions traçées et fixes appliqués

### Fix 1 — `cutover-prod-airgap.md` : banner EXEMPLE
**Avant** : aucun avertissement sur la nature exemple du domaine.
**Après** : banner ⚠️ ajouté en tête : *"toute mention de `xch.eoncom.io` est un exemple historique RSI banc de test. Pour un cutover client, substituer par le placeholder `<DEPLOY_DOMAIN>` (typiquement `xch.<client>.lan` ou `xch.<client>.local`). Idem `xch-deploy` = hostname banc de test RSI, à remplacer par `<DEPLOY_HOST>` dans le contexte client."*

### Fix 2 — `alerting.md` : JSON empirique reformulé
**Avant** : JSON brut contenant `noreply@xch.eoncom.io` + `alerts-test@demo.fr`.
**Après** : narratif explicatif au-dessus du JSON précisant que ces adresses étaient les valeurs configurées pour le drill et qu'en prod client, substituer respectivement `<NOREPLY_ADDRESS>` et `<ALERT_TEST_RECIPIENT>`. Les valeurs dans le JSON ont été remplacées par les placeholders.

### Fix 3 — `rgpd-multi-mode.md` : 3 occurrences "TBD" réécrites
**Avant** :
- L198 : "anonymiser audit_log via mécanisme **TBD** Track F"
- L200 : "export ciblé via mécanisme **TBD** Track F"
- L271 : "backups **TBD** selon client"

**Après** :
- L198 : "anonymiser audit_log via mécanisme **à implémenter** Track F (cf backlog `XCH_PLAN_V3_POST_V2_2026_05_17`)"
- L200 : "export ciblé via mécanisme **à implémenter** Track F"
- L271 : "durée backups **à définir contractuellement** avec le client"

---

## Verdict post-fix (re-scan final)

```bash
# Tier A residual scan
grep -rnE "@eoncom\.io" docs/operator/ docs/operator/cutover-templates/  # 0
grep -rnE "noreply@xch\.eoncom\.io|alerts-test@demo\.fr" docs/operator/ docs/operator/cutover-templates/
# → 1 hit alerting.md L225 — banner explicatif, Tier C documenté

# Tier B residual scan
grep -rnE "\bXXX\b|TODO_PILOT|\bFIXME\b|\[REDACTED\]|\bTBD\b|<nom_client_potentiel>|<CLIENT_NAME>" \
  docs/operator/ docs/operator/cutover-templates/  # 0

# Tier C inventory
grep -rnE "xch-deploy" docs/operator/ docs/operator/cutover-templates/ | wc -l  # 32 (banc de test, documenté)
grep -rnE "xch\.eoncom\.io" docs/operator/ docs/operator/cutover-templates/  # 2 (banner explicatif)
```

| Tier | Avant | Après fix | Verdict |
|---|---|---|---|
| **A — vraie fuite** | 4 (mailpit JSON + table cutover) | **0** | ✅ PASS |
| **B — placeholder leftover** | 3 (TBD) | **0** | ✅ PASS |
| **C — documenté intentionnel** | ~30+ banc de test + 3 banners + 1 repo URL | conservé, documenté | ✅ ACCEPTABLE |

**Verdict PR3 Pass 8 = PASS (Tier A = 0, Tier B = 0)**.

---

## Hors scope (à traiter Track F)

### Leaks observés hors `docs/operator/`

Les sous-dossiers suivants contiennent des références à des hostnames / IPs internes (`192.168.0.13`, `192.168.0.39`, `xch.eoncom.io`, `xsrv`, etc.) mais sont **explicitement hors scope** de Pass 8 (décision user) :

- `docs/agents/AGENT_CICD.md` — 192.168.0.13 (3 hits)
- `docs/agents/ORCHESTRATOR.md` — 192.168.0.13 (1 hit)
- `docs/archive/old-guides/E2E_TESTS_*.md` — 192.168.0.13 (multiples)
- `docs/archive/old-guides/DEPLOYMENT_REPORT.md` — `xsrv (192.168.0.13)`
- `docs/audit/track-e2-glitchtip-state.md` — 192.168.0.13 (3 hits)
- `docs/decisions/adr-006-docker-network-inter-container.md` — 192.168.0.13 (2 hits)
- `docs/decisions/adr-014-native-monitoring.md` — RFC1918 ranges dans contexte security policy (légitime)
- `docs/guides/NGINX_PROXY_PRODUCTION.md` — 192.168.0.39 (multiple)
- `docs/guides/SESSION_STARTUP_GUIDE.md` — 192.168.0.13 (multiple)
- `docs/installation/INSTALL_DEV.md` — 192.168.1.10, 192.168.1.100 (exemples DEV)
- `docs/sessions/DEPLOY_SESSION_10.md` — 192.168.0.13 (multiple)

**Recommandation Track F (XCH_PLAN_V3_POST_V2_2026_05_17)** :
- Audit élargi à toutes les sous-arbres `docs/` (sauf `docs/archive/`)
- Décision client par client : laisser tel quel (repo public + documentation historique) OU placeholderiser
- ADR à formaliser si décision globale prise

### Étape 0 RFC1918 dans scope Pass 8

Initialement prévu : ping user pour classifier la liste résultante. **Liste résultante vide → étape non requise**. Documenté pour traçabilité méthodologique.

---

## Annexe — Reproduction du scan

```bash
# Tier A — emails internes
grep -rnE "@eoncom\.io" docs/operator/ docs/operator/cutover-templates/

# Tier A — hostnames internes
grep -rnE "xch-deploy|xch-monitor" docs/operator/ docs/operator/cutover-templates/

# Tier A — IPs RFC1918
grep -rhoE "\b(10|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\.[0-9]+\.[0-9]+\b" \
  docs/operator/ docs/operator/cutover-templates/ | sort -u

# Tier B — placeholder leftovers
grep -rnE "\bXXX\b|TODO_PILOT|\bFIXME\b|\[REDACTED\]|\bTBD\b|<nom_client_potentiel>|<CLIENT_NAME>" \
  docs/operator/ docs/operator/cutover-templates/

# Verdict attendu : 0 Tier A active, 0 Tier B
```

---

## Cross-références

- [`docs/operator/cutover-prod-airgap.md`](../operator/cutover-prod-airgap.md) — banner exemple ajouté Pass 8
- [`docs/operator/alerting.md`](../operator/alerting.md) — JSON Mailpit réécrit Pass 8
- [`docs/operator/rgpd-multi-mode.md`](../operator/rgpd-multi-mode.md) — 3 TBD réécrits Pass 8
- [`docs/operator/deployment-modes.md`](../operator/deployment-modes.md) — matrice 4-mode (placeholders Option C documentés)
- [`docs/security/false-positives.md`](false-positives.md) — autre catalogue faux positifs existant
- MCP `XCH_PLAN_V3_POST_V2_2026_05_17` — backlog Track F (audit élargi)
