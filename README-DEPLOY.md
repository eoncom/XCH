# XCH — Guide de Deploiement v1.1.1

## Prerequis

| Composant | Version minimale |
|-----------|-----------------|
| Docker | 24+ |
| Docker Compose | v2 (plugin) |
| RAM | 4 GB |
| Disque | 20 GB |
| OS | Ubuntu 22.04+, Debian 12+, RHEL 9+ |

---

## Deploiement connecte (serveur avec Internet)

```bash
# 1. Cloner le depot
git clone https://github.com/votre-org/XCH.git /opt/xch
cd /opt/xch

# 2. Configurer l'environnement
cp .env.production.example backend/.env
nano backend/.env  # Personnaliser les secrets (JWT, PostgreSQL, MinIO)

# 3. Lancer la stack
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Deploiement air-gapped (serveur isole)

### Sur la machine de build (avec Internet)

```bash
# Builder et empaqueter toutes les images
bash scripts/package-release.sh v1.1.1

# Transferer l'archive sur le serveur cible
scp releases/xch-v1.1.1-full.tar.gz user@serveur:/tmp/
```

### Sur le serveur cible (sans Internet)

```bash
# Extraire
cd /tmp
tar xzf xch-v1.1.1-full.tar.gz
cd xch-release-v1.1.1

# Installer (charge les images + configure + demarre)
bash scripts/install-airgap.sh /opt/xch
```

---

## Premier acces

1. Ouvrir `http://<IP_SERVEUR>` dans un navigateur
2. Le **Setup Wizard** se lance automatiquement au premier demarrage
3. Creer le compte administrateur
4. (Optionnel) Charger les donnees de demo

---

## Verification sante

```bash
cd /opt/xch

# Statut des containers
docker compose ps

# Tous doivent etre "healthy" ou "running"
# Verifier les logs si un service est "unhealthy":
docker compose logs backend --tail 50
docker compose logs frontend --tail 50
docker compose logs postgres --tail 50
```

### Endpoints de verification

| Service | URL | Attendu |
|---------|-----|---------|
| Frontend | `http://<IP>/` | Page login |
| API Health | `http://<IP>/api/health` | `{"status":"ok"}` |
| Gatus | `http://<IP>:8080` | Dashboard monitoring |

---

## Backup / Restore

### Backup complet

```bash
bash scripts/backup-full.sh /opt/xch/backups
# Cree: xch-backup-full-YYYYMMDD_HHMMSS.tar.gz
# Contient: dump PostgreSQL + fichiers MinIO + metadata
```

### Restauration

```bash
bash scripts/restore-full.sh /opt/xch/backups/xch-backup-full-20260315_020000.tar.gz
# ATTENTION: ecrase les donnees existantes
```

### Backup planifie (cron)

```bash
# Backup quotidien a 2h du matin, conservation 30 jours
echo "0 2 * * * /opt/xch/scripts/backup-full.sh /opt/xch/backups && find /opt/xch/backups -name '*.tar.gz' -mtime +30 -delete" | crontab -
```

---

## Configuration avancee

### HTTPS avec certificat

1. Placer les fichiers dans `docker/nginx/ssl/` :
   - `cert.pem` — Certificat
   - `key.pem` — Cle privee

2. Decommenter le bloc SSL dans `docker/nginx/nginx.conf`

3. Relancer nginx :
   ```bash
   docker compose restart nginx
   ```

### Proxy externe (Nginx Proxy Manager, Traefik, etc.)

Si vous utilisez un reverse proxy externe, retirez le service `nginx` du compose et exposez les ports backend/frontend :

```yaml
backend:
  ports:
    - "3000:3000"
frontend:
  ports:
    - "3001:3001"
```

### Variables d'environnement cles

| Variable | Description | Defaut |
|----------|-------------|--------|
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | (requis) |
| `JWT_SECRET` | Secret JWT access tokens | (requis) |
| `JWT_REFRESH_SECRET` | Secret JWT refresh tokens | (requis) |
| `MINIO_ACCESS_KEY` | Identifiant MinIO | (requis) |
| `MINIO_SECRET_KEY` | Secret MinIO (min 16 car.) | (requis) |
| `COOKIE_SECURE` | `true` pour HTTPS, `false` pour HTTP | `true` |
| `HTTP_PORT` | Port HTTP expose | `80` |
| `GATUS_PORT` | Port monitoring Gatus | `8080` |
| `SMTP_HOST` | Serveur SMTP (notifications email) | (optionnel) |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Utilisateur SMTP | (optionnel) |
| `SMTP_PASS` | Mot de passe SMTP | (optionnel) |
| `SMTP_FROM` | Adresse expediteur | (optionnel) |

---

## Architecture

```
Internet/LAN
     |
  [Nginx :80/:443]
     |
     +-- /api/*    --> [Backend :3000]  --> [PostgreSQL :5432]
     |                                  --> [Redis :6379]
     |                                  --> [MinIO :9000]
     +-- /storage/* --> [MinIO :9000]
     +-- /*         --> [Frontend :3001]

  [Gatus :8080] --> monitoring endpoints
```

---

## Depannage

| Probleme | Solution |
|----------|----------|
| Container "unhealthy" | `docker compose logs <service> --tail 100` |
| Erreur connexion DB | Verifier `DATABASE_URL` dans `backend/.env` |
| 502 Bad Gateway | Backend pas encore pret — attendre 30s |
| Permissions MinIO | Relancer `docker compose restart minio-init` |
| Port deja utilise | Changer `HTTP_PORT` / `GATUS_PORT` dans `.env` |
| 502 apres rebuild | Nginx Proxy Manager cache les IPs Docker — `docker restart <npm-container>` |
