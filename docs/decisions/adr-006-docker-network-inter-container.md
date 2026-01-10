# ADR-006 : Réseau Docker pour Communication Inter-Containers

**Date :** 2026-01-10
**Statut :** ✅ Accepté
**Décideur :** Lead Technique
**Contexte :** Déploiement production Ubuntu 24.04

---

## Contexte

Lors du déploiement en production, le backend NestJS ne pouvait pas se connecter aux services d'infrastructure (PostgreSQL, Redis, MinIO) malgré des configurations correctes.

### Problème Initial

**Symptôme :**
```
Backend se bloque après "AuthModule dependencies initialized"
Pas d'erreur visible dans les logs
Container tourne mais API ne répond jamais
```

**Cause Racine :**
Le backend essayait de se connecter via `host.docker.internal` ou IP hôte `192.168.0.13`, mais ces méthodes échouaient :
- `host.docker.internal` : timeout sur connexion Redis
- IP hôte `192.168.0.13` : accessibilité limitée selon configuration réseau hôte

### Contrainte Environnement

Port 3000 déjà occupé par Grafana → Backend déployé sur port 3002

---

## Décision

**Utilisation d'un réseau Docker dédié pour communication inter-containers.**

### Implémentation

1. **Création réseau Docker :**
   ```bash
   docker network create xch-network
   ```

2. **Connexion containers infrastructure :**
   ```bash
   docker network connect xch-network xch-postgres
   docker network connect xch-network xch-redis
   docker network connect xch-network xch-minio
   ```

3. **Configuration backend .env :**
   ```bash
   DATABASE_URL=postgresql://xch_user:password@xch-postgres:5432/xch_dev
   REDIS_HOST=xch-redis
   REDIS_PORT=6379
   MINIO_ENDPOINT=xch-minio
   MINIO_PORT=9000
   ```

4. **Lancement backend sur réseau :**
   ```bash
   docker run -d \
     --name xch-backend \
     --network xch-network \
     -p 3002:3000 \
     --env-file .env \
     -v /opt/xch-dev/XCH/backend/uploads:/app/uploads \
     xch-backend:latest
   ```

---

## Conséquences

### ✅ Positives

1. **Communication Fiable**
   - DNS interne Docker résout automatiquement noms containers
   - Pas de dépendance à l'IP hôte ou configuration réseau externe
   - Latence minimale (communication sur même hôte)

2. **Isolation Réseau**
   - Containers sur réseau privé isolé
   - Seuls ports exposés : 3001 (frontend), 3002 (backend)
   - Infrastructure (DB, Redis, MinIO) non accessible depuis extérieur

3. **Simplicité Configuration**
   - Hostnames = noms containers (xch-postgres, xch-redis, xch-minio)
   - Pas besoin de gérer IPs dynamiques
   - Ports internes standards (5432, 6379, 9000)

4. **Scalabilité**
   - Ajout facile de nouveaux services (workers, cache, etc.)
   - Prêt pour orchestration (Docker Swarm, Kubernetes)

5. **Portabilité**
   - Fonctionne identique dev/staging/prod
   - Pas de dépendance à configuration réseau hôte

### ⚠️ Négatives

1. **Complexité Initiale**
   - Étape supplémentaire : création réseau
   - Nécessite connexion explicite chaque container

2. **Debugging**
   - Plus difficile d'inspecter trafic réseau
   - Logs distribués entre containers

3. **Overhead Docker**
   - Légère surcharge réseau Docker (négligeable en pratique)

---

## Alternatives Considérées

### 1. host.docker.internal avec --add-host
```bash
docker run --add-host=host.docker.internal:host-gateway ...
```
**Rejeté car :**
- Ne fonctionnait pas sur Linux (spécifique macOS/Windows)
- Timeout Redis persistants
- Complexité configuration par container

### 2. Network mode host
```bash
docker run --network host ...
```
**Rejeté car :**
- Perte isolation réseau
- Conflits ports (Grafana sur 3000)
- Moins sécurisé

### 3. IPs statiques containers
**Rejeté car :**
- Fragile (IPs peuvent changer)
- Maintenance complexe
- Pas portable entre environnements

### 4. Docker Compose --link (legacy)
**Rejeté car :**
- Méthode dépréciée
- Remplacée par user-defined networks
- Moins flexible

---

## Expérience Acquise

### Ce qui a fonctionné

1. **Diagnostic Méthodique**
   - Logs backend : blocage après AuthModule
   - Test connectivité : `docker exec xch-backend nc -zv host 6379` (timeout)
   - Identification cause : isolation réseau

2. **Solution Progressive**
   - Testé d'abord avec host.docker.internal (échec)
   - Puis création réseau dédié (succès immédiat)

3. **Validation**
   - Backend démarre complètement
   - Logs : "Database connected" + "Nest application successfully started"
   - API répond sur port 3002

### Leçons

- **Toujours privilégier user-defined Docker networks** en production
- Éviter dépendances à `localhost`, `127.0.0.1`, IPs hôte
- DNS Docker = meilleure pratique pour inter-container communication
- Tests connectivité avec `nc -zv` précieux pour debugging

---

## Références

- [Docker networking overview](https://docs.docker.com/network/)
- [User-defined bridge networks](https://docs.docker.com/network/bridge/)
- [Container networking](https://docs.docker.com/config/containers/container-networking/)

---

## Mise à Jour Future

Si migration vers orchestration (Kubernetes, Docker Swarm) :
- Remplacer réseau Docker par Service Mesh (Istio, Linkerd)
- Utiliser DNS cluster Kubernetes
- Configuration identique (hostnames restent valides)

---

**Résultat :** ✅ Production déployée avec succès
**Backend :** Port 3002, network xch-network
**Connectivité :** PostgreSQL + Redis + MinIO opérationnels
