# Contexte : Abstraction Monitoring + Webhook + Dashboard TV

**Date :** 2026-03-07
**Statut :** Implemente et deploye
**Architecture :** MonitoringProvider abstraction + Webhook generique + Polling safety net

---

## 1. Architecture implementee

```
Moteur Monitoring (Kuma OU Gatus, autonome)
  │
  │ POST /api/integrations/monitoring/webhook?provider=kuma|gatus
  │ (sur changement de statut)
  ▼
XCH Backend
  ├─ MonitoringWebhookController (securise, generique)
  ├─ MonitoringWebhookService (normalise payloads, met a jour sante)
  ├─ MonitoringProviderFactory (selectionne le bon provider)
  │   ├─ UptimeKumaProviderService (polling /metrics)
  │   └─ GatusProviderService (polling /v1/endpoints/statuses)
  ├─ HealthAggregationService (calcul sante, inchange)
  └─ HealthSyncScheduler (polling 5min, safety net)
```

## 2. Fichiers cles

### Nouveaux fichiers
| Fichier | Role |
|---------|------|
| `providers/gatus.provider.ts` | Provider Gatus (REST API) |
| `providers/monitoring-provider.factory.ts` | Factory generique |
| `controllers/monitoring-webhook.controller.ts` | Endpoint webhook |
| `services/monitoring-webhook.service.ts` | Traitement webhook |
| `utils/monitor-name-parser.ts` | Parser convention [CODE] TYPE LABEL |
| `frontend/dashboard/tv/page.tsx` | Dashboard TV plein ecran |
| `docs/guides/MONITORING_CONVENTION.md` | Guide utilisateur |

### Fichiers modifies
| Fichier | Changement |
|---------|------------|
| `interfaces/integration-provider.interface.ts` | MonitoringProvider, NormalizedMonitor, etc. |
| `providers/uptime-kuma.provider.ts` | implements MonitoringProvider |
| `integrations.module.ts` | +4 providers/controllers |
| `integrations.service.ts` | MonitoringProviderFactory |
| `integrations.controller.ts` | Routes /monitoring/* |
| `health-sync.scheduler.ts` | Utilise factory |
| `frontend/lib/api/integrations.ts` | Chemins /monitoring/ |
| `frontend/settings/page.tsx` | Dropdown provider |
| `frontend/sites/[id]/page.tsx` | Bug fix carte sante |

## 3. Convention de nommage moniteurs

```
Format : [SITE_CODE] TYPE LABEL
```

Types : LINK (critique), SDWAN (warning), ASSET (warning)

Exemple : `[ALTO] LINK Fibre Orange` → site=ALTO, composant=Fibre Orange

## 4. Config tenant cible

```json
{
  "integrations": {
    "monitoring": {
      "type": "gatus",
      "url": "https://gatus.example.com",
      "apiKey": "bearer-token",
      "webhookSecret": "shared-secret",
      "webhookEnabled": true
    }
  }
}
```

Retro-compatible : l'ancien format `integrations.uptimeKuma.url` est reconnu par le factory.

## 5. Endpoints API

| Route | Methode | Description |
|-------|---------|-------------|
| `/integrations/monitoring/monitors` | GET | Liste des moniteurs (provider actif) |
| `/integrations/monitoring/map-monitor` | PATCH | Associer moniteur a un site |
| `/integrations/monitoring/monitor-mappings` | GET | Toutes les associations |
| `/integrations/monitoring/sync/health-all` | POST | Sync sante tous les sites |
| `/integrations/monitoring/webhook?provider=kuma\|gatus` | POST | Webhook entrant |
| `/integrations/monitoring/map-monitor-to-asset` | PATCH | Associer moniteur a un equipement |

## 6. Variables d'environnement

```bash
UPTIME_KUMA_URL=           # URL Kuma (legacy)
GATUS_URL=                 # URL Gatus
GATUS_API_KEY=             # Bearer token Gatus
MONITORING_WEBHOOK_SECRET= # Secret partage webhook
```
