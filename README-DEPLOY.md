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

# 2. Creer le fichier root .env (variables Docker Compose)
cp .env.production.example .env
nano .env  # Personnaliser POSTGRES_PASSWORD, MINIO_ACCESS_KEY, MINIO_SECRET_KEY

# 3. Creer le fichier backend/.env (variables application NestJS)
cp backend/.env.production backend/.env
nano backend/.env  # Personnaliser DATABASE_URL, JWT secrets, MinIO keys
# IMPORTANT: Les credentials (POSTGRES_PASSWORD, MINIO keys) doivent
# etre identiques entre .env (root) et backend/.env

# 4. Lancer la stack
docker compose up -d --build
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
| API | `http://<IP>/api/auth/session` | 401 (non auth) |
| Monitoring | UI XCH `/dashboard/monitoring` | Sondes natives (ADR-014/016) |

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

### HTTPS avec certificat auto-signe (IP sans domaine)

```bash
# 1. Generer le certificat (detecte l'IP automatiquement)
bash scripts/generate-ssl.sh
# Ou specifier l'IP : bash scripts/generate-ssl.sh 192.168.1.100

# 2. Activer les cookies securises
sed -i 's/COOKIE_SECURE=false/COOKIE_SECURE=true/' backend/.env

# 3. Redemarrer
docker compose restart nginx backend
```

### HTTPS avec vrai certificat

1. Placer les fichiers dans `docker/nginx/ssl/` :
   - `cert.pem` — Certificat (chaine complete)
   - `key.pem` — Cle privee

2. Generer la config SSL :
   ```bash
   bash scripts/generate-ssl.sh votre-domaine.com
   sed -i 's/COOKIE_SECURE=false/COOKIE_SECURE=true/' backend/.env
   docker compose restart nginx backend
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
| `COOKIE_SECURE` | `true` pour HTTPS, `false` pour HTTP | `false` |
| `HTTP_PORT` | Port HTTP expose | `80` |
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

  [Backend Worker] --> sondes natives ICMP/HTTP/TCP (ADR-014/016)
```

---

## Depannage

| Probleme | Solution |
|----------|----------|
| Container "unhealthy" | `docker compose logs <service> --tail 100` |
| Erreur connexion DB | Verifier `DATABASE_URL` dans `backend/.env` |
| 502 Bad Gateway | Backend pas encore pret — attendre 30s |
| Permissions MinIO | Relancer `docker compose restart minio-init` |
| Port deja utilise | Changer `HTTP_PORT` / `HTTPS_PORT` dans `.env` |
| Login silencieux | Verifier `COOKIE_SECURE` : `false` en HTTP, `true` en HTTPS |
| 502 apres rebuild | Nginx Proxy Manager cache les IPs Docker — `docker restart <npm-container>` |
