# XCH Cutover — VPS basique single-node (template DRY-RUN)

> ⚠️ **TEMPLATE DRY-RUN** — validation réelle Track G future. Ne PAS exécuter sans audit complet.
> Mode D (cf. [deployment-modes.md §3.4](../deployment-modes.md#34-vps-basique-mode-d)).
> Placeholders : `<DEPLOY_DOMAIN>`, `<VPS_PROVIDER>`, `<ADMIN_EMAIL>`, `<BACKUP_VPS_SECONDARY>`.

---

## 1. Pré-cutover (J-3 à J-1)

- [ ] VPS provider compte (`<VPS_PROVIDER>` : OVH, Hetzner, Scaleway, DigitalOcean) — 4 vCPU / 8 GB / 80 GB SSD min
- [ ] DNS A record `<DEPLOY_DOMAIN>` → IP VPS
- [ ] Firewall provider : ouvrir 22 (SSH key only), 80, 443
- [ ] Cert TLS via Let's Encrypt (certbot OR Caddy auto)
- [ ] Postfix sur l'hôte OR relay externe simple
- [ ] VPS secondaire ou bucket S3 pour offsite backup `<BACKUP_VPS_SECONDARY>`
- [ ] Pre-bootstrap : `docker pull` standard Docker Hub

## 2. Cutover (J-day, ≤ 1h)

```bash
# 1. Bootstrap host (Ubuntu Server 22.04 LTS recommandé)
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git ufw fail2ban

# 2. UFW (cf. server-hardening.md)
sudo ufw default deny incoming
sudo ufw default deny outgoing
sudo ufw allow 22/tcp comment 'SSH key only'
sudo ufw allow 80/tcp comment 'HTTP redirect'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow out 53/udp comment 'DNS'
sudo ufw allow out 80/tcp comment 'apt + curl outbound'
sudo ufw allow out 443/tcp comment 'docker pull + Let s Encrypt'
sudo ufw allow out 123/udp comment 'NTP'
sudo ufw allow out 587/tcp comment 'SMTP submission'
sudo ufw enable

# 3. Cert Let's Encrypt via certbot
sudo apt install -y certbot
sudo certbot certonly --standalone -d <DEPLOY_DOMAIN> --email <ADMIN_EMAIL> --agree-tos -n
# OR Caddy auto-TLS si reverse-proxy

# 4. Clone XCH + suivre bootstrap-runbook.md §2-7
git clone https://github.com/eoncom/XCH /opt/xch
cd /opt/xch
# Suivre §2 secrets generation + §4 docker compose up

# 5. Reverse-proxy minimal — utiliser le service nginx du compose
# COMPOSE_PROFILES=proxy docker compose up -d
# Monter /etc/letsencrypt/live/<DEPLOY_DOMAIN>/{fullchain.pem,privkey.pem} dans nginx
```

## 3. Adaptations .env vs Mode C

```bash
# Optionnel : monitoring minimal
# Pas de GlitchTip self-hosted obligatoire — Sentry SaaS DSN si dispo, sinon désactivé
GLITCHTIP_DSN_BACKEND=
GLITCHTIP_DSN_WORKER=

# SSO local-only J1 (LDAP J+N si client demande)
# Pas de variables SSO_LDAP_* J1

# SMTP : Postfix sur l'hôte ou relay externe simple
SMTP_HOST=localhost   # OR <RELAY_EXTERNE>
SMTP_PORT=25
```

## 4. Post-cutover

- [ ] Smoke 6/6 PASS
- [ ] cert Let's Encrypt renewal auto (certbot timer activé)
- [ ] Backup rsync cron quotidien vers `<BACKUP_VPS_SECONDARY>` OR S3
- [ ] fail2ban actif (SSH brute force + 401 spam)
- [ ] unattended-upgrades activé (patches OS auto)
- [ ] Monitoring : `/api/health` ping externe (UptimeRobot, Healthchecks.io free tier)

## 5. Risques spécifiques Mode D (vs Mode C)

- ⚠️ Single-node : pas de HA. Downtime = service indisponible.
- ⚠️ VPS provider breach : data exfiltrable (mitigation : disque chiffré, mais perf impact)
- ⚠️ Pas de SSO entreprise : escalation auth en cas de turnover admin
- ⚠️ Cost spike VPS si CPU/bandwidth dépasse forfait

## 6. Cross-références

- Référence mode : [deployment-modes.md §3.4](../deployment-modes.md#34-vps-basique-mode-d)
- Bootstrap commun : [bootstrap-runbook.md](../bootstrap-runbook.md)
- Server hardening : [server-hardening.md](../server-hardening.md)
- UFW enforce script : [scripts/ufw-enforce.sh](../../scripts/ufw-enforce.sh)
