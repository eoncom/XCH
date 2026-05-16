# XCH — Offline OS + Docker images updates (Mode C air-gap)

> **Scope** : patches OS + mises à jour images Docker XCH sur cible air-gap sans accès internet direct. Placeholders : `<DEPLOY_HOST>`, `<MIRROR_INTERNE>`, `<USB_DEVICE>`.

---

## 1. Stratégies disponibles

| Stratégie | Pré-requis | Cadence | Mode applicable |
|---|---|---|---|
| **A. Mirror APT interne employeur** | Mirror server IT employeur dispo | Auto via `unattended-upgrades` pointant vers mirror | C (recommandé si dispo) |
| **B. Snapshots VM IT employeur** | IT employeur fait snapshots pré-patch + applique manuellement | Cadence IT employeur (mensuelle, trimestrielle) | C (fallback) |
| **C. Import `.deb` manuel via USB** | USB transfer + dépôt local APT | Manuel selon vulns critiques | C (urgent only) |
| **D. unattended-upgrades direct internet** | Pas air-gap | Auto quotidien | A, B, D |

---

## 2. Stratégie A — Mirror APT interne employeur

### 2.1 Configuration

```bash
# Sur la VM XCH
sudo nano /etc/apt/sources.list
# Remplacer archive.ubuntu.com par <MIRROR_INTERNE>
# Exemple :
deb http://<MIRROR_INTERNE>/ubuntu jammy main restricted universe multiverse
deb http://<MIRROR_INTERNE>/ubuntu jammy-updates main restricted universe multiverse
deb http://<MIRROR_INTERNE>/ubuntu jammy-security main restricted universe multiverse
```

Tester :
```bash
sudo apt update
sudo apt list --upgradable
```

### 2.2 unattended-upgrades

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
sudo systemctl enable --now unattended-upgrades
```

Configurer pour ne PAS rebooter automatiquement (cutover impact) :
```ini
# /etc/apt/apt.conf.d/50unattended-upgrades
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Mail "<ADMIN_EMAIL>";
```

---

## 3. Stratégie B — Snapshots VM IT employeur

L'IT employeur fait :
1. Snapshot VM XCH
2. Applique patches OS via leur process standard
3. Rollback si XCH casse, sinon valide

Coordination obligatoire avec IT employeur :
- Calendar : snapshots mensuels OU trimestriels
- Pré-snapshot : `docker compose pause` (gel transactions)
- Post-snapshot : `docker compose unpause` + smoke 6/6

---

## 4. Stratégie C — Import `.deb` USB manuel

Pour vulnérabilités critiques (CVE > 9.0 + exploit public).

### 4.1 Workflow

```bash
# 1. Sur un host avec accès internet (laptop admin RSI)
mkdir -p /tmp/deb-cache
apt-get download <package-name> -o Dir::Cache::archives=/tmp/deb-cache

# 2. Copier vers USB
rsync -av /tmp/deb-cache/ /mnt/usb/

# 3. Sur la VM XCH air-gap
sudo dpkg -i /mnt/usb/*.deb
sudo apt install -f   # fix dependencies if needed
```

Risque élevé : `-f` peut casser le système si dépendances manquantes. Tester sur VM clone d'abord.

---

## 5. Docker images updates

### 5.1 Pull depuis mirror registry interne (si dispo)

```bash
# Pré-requis : registry interne <REGISTRY_INTERNE>:5000 configuré
cd <COMPOSE_DIR>
sed -i 's|image: postgis/postgis|image: <REGISTRY_INTERNE>:5000/postgis/postgis|g' docker-compose.yml
sed -i 's|image: redis|image: <REGISTRY_INTERNE>:5000/redis|g' docker-compose.yml
# ... pour chaque image

docker compose pull
docker compose up -d --force-recreate
```

### 5.2 Import `.tar` depuis USB

```bash
# Sur laptop admin avec internet
docker pull postgis/postgis:15-3.4-alpine
docker save -o /tmp/postgis.tar postgis/postgis:15-3.4-alpine

# Transfert USB → VM XCH

# Sur VM XCH
docker load -i /mnt/usb/postgis.tar
docker compose up -d --force-recreate postgres
```

### 5.3 Rebuild XCH backend/frontend depuis tarball

Cf. [scripts/package-release.sh](../../scripts/package-release.sh) qui produit un tarball complet avec images + compose + scripts.

---

## 6. Calendar patches

| Type | Cadence | Owner |
|---|---|---|
| OS critical CVE | Dans 7j post-publication | IT employeur + RSI |
| OS regular | Mensuel ou trimestriel | IT employeur |
| Docker base images | Trimestriel | RSI |
| Node deps (npm audit) | Trimestriel | RSI |
| Postgres major version | Annuel | RSI + IT employeur (snapshot mandatory) |

---

## 7. Cross-références

- Rollback : [rollback.md](rollback.md)
- Bootstrap : [bootstrap-runbook.md](bootstrap-runbook.md)
- DR drill : [dr-drill.md](dr-drill.md)
- Cutover air-gap : [cutover-prod-airgap.md](cutover-prod-airgap.md)
- Server hardening : [server-hardening.md](server-hardening.md)
