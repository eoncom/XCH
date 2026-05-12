# Convention de nommage des moniteurs (OBSOLÈTE)

> **Statut :** Obsolète depuis ADR-016 (v1.10.0, 2026-05-03).
>
> Ce guide décrivait la convention `[SITE_CODE] TYPE LABEL` utilisée par
> les anciens webhooks Uptime Kuma / Gatus pour permettre à XCH de retrouver
> le site/composant associé. Cette convention n'a plus d'usage : depuis le
> monitoring natif (ADR-014/016), les moniteurs sont créés via l'UI XCH
> avec un lien typé direct sur `MonitorTarget` (site, asset, link, custom).
>
> **Configuration actuelle des moniteurs :**
> - UI : `/dashboard/monitoring` → bouton "Nouveau moniteur"
> - Cible typée : Site, Asset, Link, SD-WAN firewall, ou cible custom
> - Sonde : ICMP / HTTP / TCP, port configurable
> - Severity : flag explicite (CRITICAL / WARNING / INFO) — cf [ADR-022](../decisions/adr-022-health-aggregation-semantics.md)
> - Notifications : routage via `NotificationChannel` + `NotificationRule` (ADR-020)
>
> **Source de vérité actuelle :**
> - [ADR-014 — Monitoring natif](../decisions/adr-014-native-monitoring.md)
> - [ADR-016 — Monitoring unification](../decisions/adr-016-monitoring-unification.md)
> - [ADR-022 — Severity flag agrégation](../decisions/adr-022-health-aggregation-semantics.md)
