# Convention de nommage des moniteurs

## Format

```
[SITE_CODE] TYPE LABEL
```

Chaque moniteur dans Uptime Kuma ou Gatus doit suivre cette convention pour que XCH puisse automatiquement associer le statut au bon site et composant.

## Types reconnus

| Type | Impact si DOWN | Description |
|------|:---:|---|
| `LINK` | **Critique** (si tous les liens DOWN) | Lien Internet (fibre, ADSL, 4G, etc.) |
| `SDWAN` | Warning | Firewall / overlay SD-WAN |
| `ASSET` | Warning | Equipement reseau (switch, AP, etc.) |

## Exemples

| Nom du moniteur | Resolution XCH |
|---|---|
| `[ALTO] LINK Fibre Orange` | Site ALTO, lien "Fibre Orange" |
| `[ALTO] LINK 4G SFR` | Site ALTO, lien backup "4G SFR" |
| `[ALTO] SDWAN Firewall-1` | Site ALTO, SD-WAN "Firewall-1" |
| `[LYON] ASSET Switch-Core` | Site LYON, equipement "Switch-Core" |
| `[MARS] LINK MPLS Bouygues` | Site MARS, lien "MPLS Bouygues" |

## Regles

1. Le `SITE_CODE` doit correspondre exactement au champ `code` du site dans XCH
2. Le `TYPE` est insensible a la casse (LINK = link = Link)
3. Le `LABEL` est le texte libre apres le type
4. Les moniteurs qui ne suivent pas cette convention sont ignores par le webhook (log warning)

## Configuration webhook

### Uptime Kuma

1. Aller dans **Settings > Notifications** dans Uptime Kuma
2. Ajouter une notification de type **Webhook**
3. URL : `https://xch.votre-domaine.com/api/integrations/monitoring/webhook?provider=kuma`
4. Headers : ajouter `x-webhook-secret: VOTRE_SECRET`
5. Envoyer sur : **Down** et **Up** (pour recevoir les retablissements)

### Gatus

Dans le fichier de configuration YAML de Gatus :

```yaml
alerting:
  custom:
    url: "https://xch.votre-domaine.com/api/integrations/monitoring/webhook?provider=gatus"
    method: "POST"
    headers:
      x-webhook-secret: "VOTRE_SECRET"
    body: |
      {
        "endpoint_name": "[ENDPOINT_NAME]",
        "resolved": [RESOLVED],
        "triggered": [TRIGGERED],
        "description": "[ALERT_DESCRIPTION]"
      }
```

## Variables d'environnement

```bash
# Type de provider (uptime_kuma ou gatus)
MONITORING_PROVIDER_TYPE=uptime_kuma

# URL du serveur de monitoring
MONITORING_PROVIDER_URL=https://uptime.example.com

# Cle API / Bearer token
MONITORING_API_KEY=

# Secret partage pour les webhooks
MONITORING_WEBHOOK_SECRET=votre-secret-ici
```

## Verification

Pour verifier que la convention est correctement appliquee :

1. Creer un moniteur nomme `[TESTSITE] LINK Test Monitor` dans votre outil
2. Envoyer un webhook test :
   ```bash
   curl -X POST "https://xch.example.com/api/integrations/monitoring/webhook?provider=kuma" \
     -H "Content-Type: application/json" \
     -H "x-webhook-secret: VOTRE_SECRET" \
     -d '{"monitor":{"name":"[TESTSITE] LINK Test Monitor"},"heartbeat":{"status":1}}'
   ```
3. Verifier dans les logs backend : `Site TESTSITE: health updated to HEALTHY via webhook`
4. Si le monitor name ne suit pas la convention, le log indiquera : `Monitor name does not follow convention`
