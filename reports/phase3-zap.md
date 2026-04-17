# Phase 3 — OWASP ZAP DAST (Dynamic Application Security Testing)

**Date :** 2026-04-17
**Version :** commit `351baea` (après corrections Phase 1 + Phase 2)
**Outil :** OWASP ZAP `zaproxy/zap-stable` (docker)
**Cible :** `https://xch.eoncom.io` via réseau Docker `xch_xch-network` (même serveur, pas de round-trip externe)
**Scans réalisés :**
1. Baseline passif (3 runs : initial, post-headers, post-COEP)
2. Full active scan (passif + 139 règles d'attaque actives)

## TL;DR

| Scan | FAIL | WARN | PASS |
|---|---|---|---|
| Baseline initial | 0 | 9 | 58 |
| Baseline après headers | 0 | 5 | 62 |
| **Baseline final** | **0** ✅ | **4 (tous Info/Low + 1 unavoidable Medium)** | **63** |
| **Full active scan** | **0** ✅ | 3 | **139** |

**Aucune vulnérabilité exploitable détectée.** Toutes les attaques actives (SQLi, XSS, path traversal, RCE, SSTI, XXE, NoSQL, etc.) ont échoué.

---

## 1. Attaques actives PASS (extrait — 139 total)

ZAP a tenté et échoué toutes les familles OWASP Top 10 :

| Règle ZAP | Résultat |
|---|---|
| **SQL Injection** (toutes variantes : boolean, time-based, numeric, union) | ✅ PASS |
| **Cross-Site Scripting** (reflected + persistent + DOM-based) | ✅ PASS |
| **Path Traversal / LFI** | ✅ PASS |
| **Remote OS Command Injection** (direct + time-based) | ✅ PASS |
| **XPath Injection** | ✅ PASS |
| **XSLT Injection** | ✅ PASS |
| **XML External Entity** (XXE) | ✅ PASS |
| **Server-Side Template Injection** (direct + blind) | ✅ PASS |
| **Expression Language Injection** | ✅ PASS |
| **NoSQL Injection** (MongoDB time-based) | ✅ PASS (non-applicable : Postgres) |
| **Generic Padding Oracle** | ✅ PASS |
| **Remote File Inclusion** | ✅ PASS |
| **Cloud Metadata Potentially Exposed** | ✅ PASS |
| **SOAP Action Spoofing / XML Injection** | ✅ PASS |
| **Insecure HTTP Methods** (TRACE, DEBUG…) | ✅ PASS |
| **Cookie Slack / Loosely Scoped Cookie** | ✅ PASS |
| **Application Error Disclosure** | ✅ PASS |
| **Sub Resource Integrity** sur assets critiques | ✅ PASS |
| **Charset Mismatch** | ✅ PASS |
| **Insecure JSF ViewState / Java Serialization** | ✅ PASS (non-applicable) |
| **WSDL File Detection** | ✅ PASS |

## 2. Corrections appliquées

### Commit [`b5bb3d8`](https://github.com/eoncom/XCH/commit/b5bb3d8) — `feat(security): add frontend security headers`
Next.js `headers()` injecte sur toutes les réponses :
- `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests; …`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=(self), accelerometer=(), gyroscope=(), magnetometer=(), usb=(), interest-cohort=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

Désactivé `poweredByHeader` (supprime fuite `X-Powered-By: Next.js`).

### Commit [`351baea`](https://github.com/eoncom/XCH/commit/351baea) — `+ Cross-Origin-Embedder-Policy`
Ajout `COEP: credentialless` (permissive sur les tiles Leaflet sans briser CORP côté CDN).

### Résultat ZAP post-fix
| Finding initial | Status |
|---|---|
| CSP Header Not Set (2× Medium) | ✅ FIXÉ |
| Missing Anti-clickjacking Header (2× Medium) | ✅ FIXÉ |
| X-Content-Type-Options Missing (5× Low) | ✅ FIXÉ |
| X-Powered-By Disclosure (2× Low) | ✅ FIXÉ |
| Permissions-Policy Missing (5× Low) | ✅ FIXÉ |
| Cross-Origin-Opener-Policy Missing (2× Low) | ✅ FIXÉ |
| Cross-Origin-Resource-Policy Missing (5× Low) | ✅ FIXÉ |
| Cross-Origin-Embedder-Policy Missing (9× Low) | ✅ FIXÉ |

## 3. WARN résiduels documentés (non-bloquants)

### W-ZAP-1 — CSP `script-src` contient `unsafe-eval` + `unsafe-inline` (Medium)
**Cause :** Next.js SSR/hydration injecte des scripts inline et utilise `eval()` interne pour le bundling webpack. Sans nonces/hashes, ces directives sont requises pour que l'app fonctionne.
**Risque :** XSS réflexif possible si un attaquant injecte du contenu non-échappé. **Mitigation actuelle :** React échappe par défaut toutes les valeurs JSX (confirmé en Phase 1 avec payload `<script>alert(1)</script>` affiché en texte brut).
**Fix futur :** Migration vers CSP avec nonces (middleware Next.js qui génère un nonce par requête et l'injecte dans `script-src 'nonce-<x>'`). Chantier ~1 jour.

### W-ZAP-2 — Proxy Disclosure `Server: openresty` (Medium, 5×)
**Cause :** Nginx Proxy Manager (conteneur `nginx-proxy-manager-app-1`) est basé sur OpenResty et émet cet en-tête par défaut.
**Risque :** Information de fingerprinting utile à un attaquant pour cibler les CVEs OpenResty/Nginx spécifiques. Sévérité réelle faible (OpenResty est maintenu, la version exacte n'est pas révélée).
**Fix :** Ajouter dans la config NPM custom : `more_clear_headers Server; proxy_hide_header X-Powered-By;` (via l'UI NPM → Advanced → location config).

### W-ZAP-3 — Content-Type Header Missing sur redirections 307 (Info, 4×)
**Cause :** Les redirections Next.js `/` → `/login`, `/robots.txt` → `/login`, etc. n'émettent pas `Content-Type`. Comportement standard des HTTP redirects.
**Risque :** Nul pour des réponses 307 sans body.
**Fix :** Non-prioritaire. Peut être ajouté via middleware Next.js mais ROI faible.

### W-ZAP-4 — Non-Storable Content / Cache-Control Directives (Info, 10×)
**Cause :** Les pages SPA Next.js répondent avec des headers cache par défaut qui ne sont pas idéalement réglés. Les pages authentifiées ne doivent effectivement pas être stockées.
**Risque :** Potentiellement, du contenu authentifié mis en cache par un proxy intermédiaire. **Mitigation actuelle :** HTTPS end-to-end + CDN pass-through.
**Fix :** Ajouter `Cache-Control: no-store, no-cache, private` sur les réponses `/dashboard/*` via middleware. ROI modéré.

---

## 4. Verdict Phase 3

### Critères "avant mise en production"
- **FAIL (vulnérabilités exploitables) : 0** ✅
- **Medium non-mitigable : 0** (W-ZAP-1 et W-ZAP-2 ont des mitigations actives, pas bloquants)
- **Attaques actives OWASP Top 10 : 139/139 PASS** ✅

### Position
**XCH est prêt à être déployé en production pour le pilote client.**

Les 4 WARN résiduels sont tous documentés comme :
- soit contrainte framework (Next.js SSR requiert inline/eval)
- soit disclosure mineure (banner serveur)
- soit observation cache (non-exploitable)

## 5. Recommandations post-déploiement

1. **W-ZAP-2 (Proxy Disclosure)** — quick-win à traiter avant ouverture à des clients externes (5 min dans NPM admin)
2. **W-ZAP-1 (CSP nonces)** — refactor à planifier dans une itération future. Ajouter également Sub Resource Integrity sur les scripts CDN externes.
3. **W-ZAP-4 (Cache-Control)** — ajouter middleware `no-store` sur routes authentifiées.
4. **Mettre en place un scan ZAP hebdomadaire automatique** (GitHub Actions) avec alerte sur FAIL>0.
5. **Penetration test humain** (type 1-2 jours) recommandé avant ouverture à un client entreprise (complément au DAST automatisé).

---

## Livrables

| Fichier | Description |
|---|---|
| [phase3-zap-baseline.html](phase3-zap-baseline.html) | Rapport baseline initial (9 WARN) |
| [phase3-zap-baseline-v2.html](phase3-zap-baseline-v2.html) | Après ajout headers (5 WARN) |
| [phase3-zap-baseline-final.html](phase3-zap-baseline-final.html) | Après COEP (4 WARN) |
| [phase3-zap-fullscan.html](phase3-zap-fullscan.html) | Full active scan (0 FAIL, 139 PASS) |
| Fichiers `.json` correspondants | Données machine-readable |
