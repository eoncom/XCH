# Contexte : Abstraction Monitoring + Webhook + Dashboard TV (OBSOLÈTE)

> **Statut :** Obsolète depuis ADR-016 (v1.10.0, 2026-05-03).
>
> Ce document décrivait l'architecture monitoring pré-native, basée sur des
> webhooks bidirectionnels Uptime Kuma / Gatus + polling safety net. Cette
> approche a été entièrement remplacée par le monitoring natif XCH (sondes
> ICMP/HTTP/TCP exécutées par le worker BullMQ).
>
> **Source de vérité actuelle :**
> - [ADR-014 — Monitoring natif](decisions/adr-014-native-monitoring.md)
> - [ADR-016 — Monitoring unification](decisions/adr-016-monitoring-unification.md)
> - [ADR-022 — Severity flag agrégation](decisions/adr-022-health-aggregation-semantics.md)

Le contenu historique précédent (architecture MonitoringProvider abstraction,
endpoints `/api/integrations/monitoring/webhook?provider=*`, polling
HealthSyncScheduler) a été retiré en v2.1.4. Pour le contexte décisionnel
complet, consulter les ADRs référencés ci-dessus + le tag `v1.10.0` qui acte
la suppression runtime.
