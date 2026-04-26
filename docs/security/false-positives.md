# Sécurité — registre des faux positifs

**Dernière mise à jour :** 2026-04-26 (ADR-016 lot M)

Inventaire des findings remontés par les outils d'audit sécurité (npm audit,
dependency scanners, semgrep, Snyk, OWASP ZAP, code review tools…) qui ont
été investigués et classés **faux positifs**. Cite la cause racine + la date
+ qui a tranché, pour que l'équipe ne refasse pas le triage à chaque audit.

Toute nouvelle alerte qui finit en faux positif **doit être documentée ici**
avec preuve (lien vers le commit, l'issue GitHub, la doc upstream, etc.).

---

## Format

Chaque entrée :

```
### [SEVERITY] <Outil> — <id ou titre>
- **Date** : YYYY-MM-DD
- **Trancheur** : nom@email
- **Findings** : <chemin du rapport ou lien>
- **Pourquoi faux positif** : <explication concise>
- **Preuve** : <commit, doc upstream, code…>
- **Re-évaluer** : <date OU "jamais (cause racine permanente)">
```

---

## Entrées actives

> _(Aucune entrée pour l'instant. Cette section reçoit les findings au fil
> des audits. Voir l'exemple ci-dessous pour le format.)_

---

## Exemple (gabarit, à supprimer quand la première entrée réelle arrive)

### [LOW] npm audit — GHSA-xxxx-xxxx-xxxx — `prototype-pollution` dans `lodash` v4.17.21

- **Date** : 2026-XX-XX
- **Trancheur** : guen.youcef@eoncom.io
- **Findings** : `npm audit --json | jq '.advisories' > /tmp/audit.json` — voir advisory cité.
- **Pourquoi faux positif** : la fonction vulnérable (`lodash.merge` non-typed key) n'est pas
  utilisée dans XCH. Recherche `lodash.merge` dans `backend/src/` et `frontend/src/` →
  uniquement présent en transitive de `<package>` qui passe des objets typés via TypeScript
  (jamais de `JSON.parse` user input directement).
- **Preuve** : `grep -rn 'lodash.merge\|_.merge' backend/src/ frontend/src/` → 0 hit user-input.
- **Re-évaluer** : à la prochaine bump majeure de lodash, ou si un nouvel usage de `_.merge`
  apparaît avec input non-typé.

---

## Entrées historiques (résolues / corrigées)

> _Quand un faux positif devient un vrai positif (changement d'usage, mise à
> jour de l'outil avec contexte différent), on déplace l'entrée ici en
> précisant la date et le commit du fix._
