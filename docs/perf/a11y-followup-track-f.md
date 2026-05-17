# A11y follow-up — Track F (compliance suite)

**Date origine** : 2026-05-17
**Déclencheur** : Track E.4 PR2 Pass 4 baseline ([a11y-baseline-2026-05-16.md](a11y-baseline-2026-05-16.md))
**Statut** : 🟡 V2 fallback activé — **PAS blocking** Track E.4 closure pilote air-gap RSI

---

## 1. Verdict V2 fallback (plan PR2 §7)

Baseline run [`25986005006`](https://github.com/eoncom/XCH/actions/runs/25986005006) post-ThrottlerGuard fix `2df895a` :

- **7/8 pages standard** présentent 1-3 violations `serious` axe-core
- **0 violation `critical`** (R4.2 CRITICAL hotfix NON déclenché)
- **0 page < 0.50** Lighthouse estimé (color-contrast n'est pas un facteur Lighthouse killer)
- 100% des violations = `color-contrast` WCAG 2 AA — un seul rule fail

Per plan §7 vigilance V2 :
> Verdict ≥ 3 pages standard < 0.70 → V2 fallback Track F + défer, **PAS blocking E.4**

→ Cette baseline **est conforme E.4 closure** (vigilance V2 satisfaite : Track F file créé, défer formalisé). Le pilote RSI peut démarrer sur cette baseline.

---

## 2. Remediation plan (Track F)

### 2.1 Pattern racine — 13/13 violations résolvables par 1 hotfix Tailwind

#### Pattern A — `text-muted-foreground` sur `bg-muted` (12/13 nodes)

| Variable | Valeur actuelle | Ratio | Proposition |
|---|---|---|---|
| `--muted-foreground` (light mode) | slate-500 `#65758b` | 4.29 | slate-600 `#475569` → ratio ≈ 6.91 ✅ |
| `--muted` (light mode) | slate-100 `#f3f5f7` | — | inchangé |

Cible CSS : [frontend/src/app/globals.css](../../frontend/src/app/globals.css) (ou équivalent racine — chercher `--muted-foreground:` HSL).

Impact UI :
- Tous les hints clavier `<kbd>` (Ctrl+K global search, raccourcis aide)
- Tous les sous-titres / labels secondaires utilisant `text-muted-foreground`
- Lisibilité **améliorée**, pas de régression visuelle attendue (slate-600 est plus foncé donc plus contrasté)

#### Pattern B — `text-orange-600` sur `bg-card` white (1/13 nodes, page `/dashboard/costs`)

| Variable | Valeur actuelle | Ratio | Proposition |
|---|---|---|---|
| Tailwind `text-orange-600` | `#ea580c` | 3.55 | `text-orange-700` `#c2410c` → ratio ≈ 5.49 ✅ |

Cible : grep `text-orange-600` dans `frontend/src/components/**` — probablement utilisé pour les badges `WARNING` / status `OUT_OF_SERVICE`. Remplacer par `text-orange-700`.

### 2.2 Validation post-hotfix

Re-run `gh workflow run a11y.yml` après PR Track F → attendu **0 blocking violation** sur les 8 pages standard. Mise à jour [`a11y-baseline-2026-05-16.md`](a11y-baseline-2026-05-16.md) §5 avec nouveaux chiffres.

### 2.3 Effort estimé Track F

| Item | Effort |
|---|---|
| Hotfix CSS pattern A + B | ~30min |
| Re-run a11y workflow + validate | ~15min |
| Update baseline report + comparaison avant/après | ~15min |
| PR + commit + merge | ~15min |
| **Total** | **~1h15** |

Cheap fix — peut être pris en Track F PR0 (warm-up) ou intégré à n'importe quelle PR Track F.

---

## 3. Hors scope V2 fallback (backlog Track F étendu)

Items qui dépassent la simple correction `color-contrast` :

- **Audit a11y manuel** : NVDA / JAWS lecteur d'écran sur 8 pages standard (compliance Section 508 / RGAA partielle)
- **Konva → SVG migration** : `/dashboard/floor-plans` + `/dashboard/monitoring` si client a11y-strict ciblé (RGAA niveau AA strict)
- **Focus management** : tabindex order audit complet, focus trap modaux Radix UI
- **ARIA landmarks** : audit `<main>`, `<nav>`, `<header>` cohérence cross-pages
- **Accessibility statement** : mention légale RGAA pour clients publics France
- **DPA accessibility** : section dédiée dans DPA template (cf. Track F backlog général)

Items qui dépassent l'a11y stricto-sensu :

- **i18n** : actuel = FR-only, EN/ES si déploiement international
- **Lighthouse SEO + best-practices < 0.70** : à vérifier après hotfix `color-contrast` (les autres categories peuvent surfacer findings supplémentaires une fois axe propre)

---

## 4. Cross-références

- Baseline 2026-05-17 : [docs/perf/a11y-baseline-2026-05-16.md](a11y-baseline-2026-05-16.md)
- Workflow : [.github/workflows/a11y.yml](../../.github/workflows/a11y.yml) (axe step soft)
- Spec : [frontend/e2e/a11y/axe.spec.ts](../../frontend/e2e/a11y/axe.spec.ts)
- Config Lighthouse : [frontend/lighthouserc.cjs](../../frontend/lighthouserc.cjs)
- Plan E.4 PR2 §7 vigilance V2 : `C:\Users\me\.claude\plans\lance-track-e-4-pr2-virtual-metcalfe.md`
- Konva exclusion D7 : [a11y-baseline-2026-05-16.md §6](a11y-baseline-2026-05-16.md#6-konva-exclusions-décision-d7)
