# Guide de Configuration des Intégrations XCH

**Date :** 2026-01-25
**Version :** 1.0

---

## Vue d'Ensemble

XCH supporte deux intégrations externes :
1. **NetBox** - Synchronisation d'inventaire (sites, équipements)
2. **Uptime Kuma** - Monitoring de santé des chantiers

Ces intégrations sont **READ-ONLY** : XCH ne modifie jamais les données sources.

---

## 1. Configuration NetBox

### Prérequis
- Instance NetBox accessible (v3.x recommandé)
- Token API avec permissions de lecture

### Création du Token API

1. Connectez-vous à NetBox en tant qu'admin
2. Allez dans **Admin > API Tokens**
3. Créez un nouveau token :
   - **User :** xch-integration (créez un utilisateur dédié)
   - **Key :** (auto-généré)
   - **Write Enabled :** Non (lecture seule)
   - **Expiration :** Facultatif

### Variables d'Environnement

```bash
# Ajouter dans /opt/xch-dev/XCH/.env
NETBOX_URL=https://netbox.votre-domaine.com
NETBOX_TOKEN=votre_token_api_ici
```

### Endpoints API XCH

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/integrations/test/netbox` | Tester la connexion |
| `POST` | `/api/integrations/netbox/sync/sites` | Synchroniser les sites |
| `POST` | `/api/integrations/netbox/sync/devices` | Synchroniser les équipements d'un site |
| `POST` | `/api/integrations/netbox/map-asset` | Mapper un asset à un device NetBox |

### Exemple d'Utilisation

```bash
# Tester la connexion
curl -X POST https://xchapi.eoncom.io/api/integrations/test/netbox \
  -H "Authorization: Bearer $TOKEN"

# Synchroniser les sites (création automatique)
curl -X POST https://xchapi.eoncom.io/api/integrations/netbox/sync/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoCreate": true, "updateExisting": false}'

# Synchroniser les équipements d'un site
curl -X POST https://xchapi.eoncom.io/api/integrations/netbox/sync/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"siteId": "uuid-du-site", "netboxSiteId": "123", "autoCreate": true}'
```

### Mapping des Données

| NetBox | XCH |
|--------|-----|
| Site name | Site name |
| Site slug | Site code |
| Site status | Site status (ACTIVE/INACTIVE) |
| Site physical_address | Site address |
| Site latitude/longitude | Site GPS coordinates |
| Device name | Asset model |
| Device serial | Asset serialNumber |
| Device device_type.manufacturer | Asset brand |
| Device device_role | Asset type (SWITCH, ROUTER, etc.) |

---

## 2. Configuration Uptime Kuma

### Prérequis
- Instance Uptime Kuma accessible (v1.x)
- Compte avec accès API

### Variables d'Environnement

```bash
# Ajouter dans /opt/xch-dev/XCH/.env
UPTIME_KUMA_URL=https://uptime.votre-domaine.com
UPTIME_KUMA_USERNAME=admin
UPTIME_KUMA_PASSWORD=votre_mot_de_passe
```

### Endpoints API XCH

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/integrations/test/uptime_kuma` | Tester la connexion |
| `POST` | `/api/integrations/uptime-kuma/sync/health/{siteId}` | Mettre à jour la santé d'un site |
| `POST` | `/api/integrations/uptime-kuma/sync/health-all` | Synchroniser la santé de tous les sites |

### Configuration des Monitors

Pour lier un monitor Uptime Kuma à un site XCH :

1. Créez un monitor dans Uptime Kuma pour le service/chantier
2. Ajoutez un **tag** avec le nom ou ID identifiable
3. Dans XCH, associez ce tag au champ `connectivity.monitoring.monitor` du site

### Mapping des Statuts

| Uptime Kuma | XCH HealthStatus |
|-------------|------------------|
| `up` | `HEALTHY` |
| `down` | `CRITICAL` |
| `unknown` | `UNKNOWN` |

### Exemple d'Utilisation

```bash
# Tester la connexion
curl -X POST https://xchapi.eoncom.io/api/integrations/test/uptime_kuma \
  -H "Authorization: Bearer $TOKEN"

# Mettre à jour la santé d'un site
curl -X POST "https://xchapi.eoncom.io/api/integrations/uptime-kuma/sync/health/uuid-du-site?monitor=mon-monitor" \
  -H "Authorization: Bearer $TOKEN"

# Synchroniser tous les sites
curl -X POST https://xchapi.eoncom.io/api/integrations/uptime-kuma/sync/health-all \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Déploiement

### Ajout des Variables sur le Serveur

```bash
# Connexion au serveur
ssh xch-deploy

# Éditer le fichier .env
nano /opt/xch-dev/XCH/.env

# Ajouter les variables
NETBOX_URL=https://netbox.example.com
NETBOX_TOKEN=xxx
UPTIME_KUMA_URL=https://uptime.example.com
UPTIME_KUMA_USERNAME=admin
UPTIME_KUMA_PASSWORD=xxx

# Redémarrer le backend
cd /opt/xch-dev/XCH
docker compose up -d --build backend
```

### Vérification

```bash
# Vérifier les logs
docker logs xch-backend --tail 50 | grep -i "provider"

# Tester via API
curl -X GET https://xchapi.eoncom.io/api/integrations/status \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Troubleshooting

### NetBox : "Connection failed"

1. Vérifiez l'URL (avec ou sans `/api`)
2. Testez le token : `curl -H "Authorization: Token $TOKEN" $NETBOX_URL/api/status/`
3. Vérifiez le réseau (firewall, proxy)

### Uptime Kuma : "Authentication failed"

1. Vérifiez username/password
2. L'API Uptime Kuma nécessite parfois une session active
3. Essayez de vous connecter manuellement à l'interface

### Logs Backend

```bash
# Voir les erreurs d'intégration
docker logs xch-backend 2>&1 | grep -E "(NetBox|Uptime|integration)" | tail -50
```

---

## 5. Sécurité

### Bonnes Pratiques

- Utilisez des tokens/comptes **dédiés** pour XCH
- Activez **uniquement les permissions de lecture**
- Stockez les secrets dans des variables d'environnement, jamais dans le code
- Utilisez HTTPS pour toutes les connexions
- Configurez des **IP whitelists** si possible

### Permissions RBAC

| Rôle | Permissions Intégrations |
|------|--------------------------|
| ADMIN | Test + Sync + Status |
| MANAGER | Test + Sync + Status |
| TECHNICIEN | (pas d'accès) |
| VIEWER | (pas d'accès) |

---

## 6. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         XCH Backend                          │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ NetBoxProvider   │  │ UptimeKumaProvider│                │
│  │ - fetchSites()   │  │ - getMonitors()   │                │
│  │ - fetchDevices() │  │ - getStatus()     │                │
│  │ - mapToXCH()     │  │ - mapToHealth()   │                │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌─────────────────────────────────────────────┐            │
│  │         IntegrationsService                  │            │
│  │ - syncNetBoxSites()                          │            │
│  │ - syncNetBoxDevices()                        │            │
│  │ - updateSiteHealthFromMonitor()              │            │
│  └──────────────────────┬──────────────────────┘            │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────┐            │
│  │              Prisma (PostgreSQL)             │            │
│  │  - Sites (healthStatus)                      │            │
│  │  - Assets                                    │            │
│  │  - ExternalRefs (metadata)                   │            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
          │                            │
          ▼                            ▼
    ┌───────────┐              ┌───────────────┐
    │  NetBox   │              │  Uptime Kuma  │
    │  (REST)   │              │   (REST/WS)   │
    └───────────┘              └───────────────┘
```

---

**Dernière mise à jour :** 2026-01-25
