# XCH — Offsite backup rotation (LUKS-encrypted USB) — Track E.2 Pass 7

> **Scope** : décision RSI **D2.3** Track E.2 — rotation hebdomadaire offsite des backups sur médium chiffré LUKS (USB physique ou clé NAS extérieure). Procédure exercée en dry-run pendant Pass 7, exécutée en production par l'opérateur avec une vraie clé.
> **Placeholders Option C** : `<USB_DEVICE>`, `<LUKS_PASSPHRASE>`, `<OPS_ONCALL>`, `<DEPLOY_HOST>`, `<DEPLOY_DIR>`, `<BACKUPS_SRC>`.

---

## 1. Pourquoi un offsite LUKS ?

- **3-2-1 rule simplifié** : 3 copies (live MinIO + on-host backups + offsite USB), 2 supports (MinIO disque + USB chiffré), 1 hors-site (USB transportée).
- **Air-gap pilote employeur** : pas de cloud backup (pas de canal sortant), donc le USB est le seul lien physique hors-site.
- **Chiffrement obligatoire** : un USB perdu en transit doit rester illisible. LUKS-1/2 avec AES-256-XTS (cryptsetup défaut) répond aux exigences RGPD pour PII.
- **D2.3 = rotation hebdomadaire** : 1 backup/semaine sur l'USB suffit pour la cible pilote (RPO opérateur ≤ 7 jours cf. [dr-drill.md §6.4](dr-drill.md#64-rpo-opérateur-réel)).

---

## 2. Pré-requis (à provisionner UNE FOIS)

### 2.1 Matériel

- Clé USB 16 GB minimum (recommandation : 32 GB pour 5 ans de rotation hebdo avec tenant ≤ 1 GB).
- 2 clés en rotation (paire « impair / pair ») pour éviter la perte si une clé physique meurt.
- Conservation : 1 sur site, 1 en coffre / domicile / lieu géographiquement séparé.

### 2.2 Formatage initial (root requis, à exécuter UNE FOIS par clé)

```bash
# Identifier le device après insertion
sudo lsblk
# → /dev/sdb1 (ou similaire)

# CRITICAL : formatage LUKS détruit toutes les données existantes
sudo cryptsetup luksFormat --type luks2 --cipher aes-xts-plain64 --key-size 512 --hash sha512 /dev/sdb1

# Saisir une passphrase forte (24+ caractères, mélange alphanum + special)
# La PASSPHRASE doit être stockée dans le vault opérateur (cf. §5)

# Initialiser le filesystem (ext4 recommandé pour Linux)
sudo cryptsetup luksOpen /dev/sdb1 xch_offsite_init
sudo mkfs.ext4 -L xch-offsite-01 /dev/mapper/xch_offsite_init
sudo cryptsetup luksClose xch_offsite_init

# Le device est prêt — il sera reconnu par scripts/offsite-backup-luks.sh
```

### 2.3 Software (déjà sur xch-deploy)

```bash
dpkg -l | grep -E 'cryptsetup|rsync'
# → cryptsetup 2.4.3 (vérifié Pass 7)
# → rsync (installé par défaut Ubuntu Server)
```

---

## 3. Procédure hebdomadaire — opérateur

### 3.1 Pré-flight

```bash
# 1. Insérer la clé USB sur le serveur xch-deploy
# 2. Identifier le device
ssh <DEPLOY_HOST> "lsblk | grep -v loop"
# → Confirmer /dev/sdb1 (ou autre selon le matériel)

# 3. Vérifier qu'un backup récent existe (RPO drift detection automatique dans le script)
ssh <DEPLOY_HOST> "ls -lt <BACKUPS_SRC>/*.zip 2>/dev/null | head -3"
```

### 3.2 Exécution du script

```bash
# Mode interactif (recommandé — prompt cryptsetup pour la passphrase)
ssh <DEPLOY_HOST> "sudo /opt/<DEPLOY_DIR>/scripts/offsite-backup-luks.sh /dev/sdb1"

# OU mode batch (CI / automation) — passphrase dans un fichier protégé
ssh <DEPLOY_HOST> "sudo LUKS_PASSPHRASE_FILE=/root/.xch-luks-passphrase \
  /opt/<DEPLOY_DIR>/scripts/offsite-backup-luks.sh /dev/sdb1"

# Dry-run pour vérifier sans toucher le device
ssh <DEPLOY_HOST> "/opt/<DEPLOY_DIR>/scripts/offsite-backup-luks.sh /dev/sdb1 --dry-run"
```

### 3.3 Sortie attendue (cas nominal)

```text
===================================================
  XCH Offsite Backup (LUKS encrypted)
  2026-05-23T03:00:01+02:00
===================================================

  Device         : /dev/sdb1
  Backups source : /opt/<DEPLOY_DIR>/backups
  Retention      : 7 days
  Mount point    : /mnt/xch-offsite

  Newest backup   : full-backup-v2-2026-05-23T02-59-12.zip  (0h old)

[1/5] Unlocking /dev/sdb1 → /dev/mapper/xch_offsite ...
Enter passphrase for /dev/sdb1:
[2/5] Mounting /dev/mapper/xch_offsite → /mnt/xch-offsite ...
[3/5] Syncing <BACKUPS_SRC> → /mnt/xch-offsite (ZIP + sidecars only) ...
  sent 1 234 567 bytes  received 35 bytes  ...
[4/5] Pruning files older than 7 days on offsite ...
[5/5] Unmounting + closing LUKS ...

Offsite rotation completed at 2026-05-23T03:00:15+02:00
Device /dev/sdb1 may now be physically removed.
```

### 3.4 Post-rotation

1. **Retirer physiquement la clé** (umount + luksClose déjà effectués par le script).
2. **Stocker la clé** dans le lieu offsite désigné (échange avec la clé précédente).
3. **Loguer la rotation** dans le journal opérateur (date, ID clé, nom du backup le plus récent capturé).

---

## 4. Restore depuis offsite (DR critique)

Procédure quand le serveur primaire est perdu (VM corrompue, disk failure, etc.).

### 4.1 Bootstrap nouvelle VM

```bash
# Suivre install-airgap.sh sur nouvelle VM Ubuntu fraîche
sudo bash <USB_OR_NETWORK>/scripts/install-airgap.sh
# (cf. docs/installation/INSTALL_PROD.md pour le détail)
```

### 4.2 Restore le backup le plus récent depuis l'USB

```bash
# Brancher l'USB offsite sur la nouvelle VM
sudo lsblk
# Identifier le device (ex /dev/sdc1)

# Décrypter et monter
sudo cryptsetup luksOpen /dev/sdc1 xch_offsite_restore
sudo mkdir -p /mnt/xch-offsite-ro
sudo mount -o ro /dev/mapper/xch_offsite_restore /mnt/xch-offsite-ro

# Identifier le backup le plus récent (ZIP + sidecar éventuel)
ls -lt /mnt/xch-offsite-ro/*.zip
LATEST_ZIP=$(ls -t /mnt/xch-offsite-ro/*.zip | head -1)
LATEST_SIDECAR="${LATEST_ZIP}.enc.json"
[[ ! -f "$LATEST_SIDECAR" ]] && LATEST_SIDECAR=""  # backup non chiffré

# Copier en local (rsync préserve la taille pour multipart upload)
sudo cp "$LATEST_ZIP" /tmp/
[[ -n "$LATEST_SIDECAR" ]] && sudo cp "$LATEST_SIDECAR" /tmp/

# Démonter
sudo umount /mnt/xch-offsite-ro
sudo cryptsetup luksClose xch_offsite_restore

# Restore via scripts/restore-full.sh (mode api recommandé après bootstrap)
bash /opt/<DEPLOY_DIR>/scripts/restore-full.sh /tmp/$(basename "$LATEST_ZIP") \
  ${LATEST_SIDECAR:+/tmp/$(basename "$LATEST_SIDECAR")}
```

### 4.3 Validation

```bash
# Suivre la checklist post-recovery
curl -s https://<DEPLOY_DOMAIN>/api/health | jq .
bash /opt/<DEPLOY_DIR>/scripts/smoke-prod.sh https://<DEPLOY_DOMAIN>
```

---

## 5. Key escrow (passphrase management)

### 5.1 Anti-patterns à éviter

- ❌ Passphrase dans un fichier en clair sur le serveur (sauf si chiffré par un autre moyen)
- ❌ Passphrase dans un dépôt git, même privé
- ❌ Passphrase envoyée par email/messagerie non chiffrée
- ❌ Passphrase mémorisée par une seule personne (single point of failure humain)

### 5.2 Patterns recommandés

| Pattern | Description | Pilote employeur ? |
|---|---|---|
| **Sealed envelope** | Passphrase écrite, enveloppe scellée stockée dans coffre physique | ✅ J1 |
| **Split knowledge (Shamir)** | 3-of-5 secret sharing via `ssss-split` — chaque opérateur a 1 part | ✅ recommandé pour pilote multi-admin (Track E.4 handoff) |
| **HSM / hardware token** | Yubikey, smart card — déchiffre LUKS sans frapper la passphrase | ❌ scope hors pilote J1 |
| **Vault opérateur** | Bitwarden self-hosted, KeePass partagé via Nextcloud, etc. | ✅ si déjà déployé côté employeur |
| **Fichier passphrase + chiffrement GPG** | `LUKS_PASSPHRASE_FILE` lu par le script, fichier chiffré GPG décodé à la volée | ✅ mode batch / cron |

### 5.3 Rotation passphrase

```bash
# Cryptsetup supporte plusieurs key slots (jusqu'à 8 en LUKS2)
# Pattern : ajouter la nouvelle puis retirer l'ancienne
sudo cryptsetup luksAddKey /dev/sdb1  # ajoute slot 1 (entrer ANCIENNE pour autoriser, puis NOUVELLE)
sudo cryptsetup luksRemoveKey /dev/sdb1  # retire l'ancienne (entrer l'ANCIENNE à supprimer)
sudo cryptsetup luksDump /dev/sdb1 | grep -A 2 'Keyslot'  # vérifier 1 seul slot actif
```

→ **Fréquence rotation** : à chaque changement d'opérateur OU annuellement (politique RSI).

---

## 6. Pass 7 dry-run validation (2026-05-16)

Exécuté localement sur le worktree pour valider la syntaxe + le parser arguments :

```text
$ BACKUPS_SRC=/tmp/xch-test-backups bash scripts/offsite-backup-luks.sh /tmp/xch-test-loop.img --dry-run
===================================================
  XCH Offsite Backup (LUKS encrypted)
  2026-05-16T12:20:37+02:00
===================================================

  Device         : /tmp/xch-test-loop.img
  Backups source : /tmp/xch-test-backups
  ...
  Newest backup   : full-backup-v2-2026-05-16T10-09-09.zip  (0h old)

[dry-run] Would execute :
  cryptsetup luksOpen /tmp/xch-test-loop.img xch_offsite
  mkdir -p /mnt/xch-offsite
  mount /dev/mapper/xch_offsite /mnt/xch-offsite
  rsync -av --include='*.zip' --include='*.enc.json' --exclude='*' /tmp/xch-test-backups/ /mnt/xch-offsite/
  find /mnt/xch-offsite -mtime +7 -delete (retention cleanup)
  umount /mnt/xch-offsite
  cryptsetup luksClose xch_offsite
```

Note : la **véritable** exécution loopback (formatage LUKS + open + mount + rsync) **n'a pas été exercée sur xch-deploy** car le user `claude-deploy` n'a pas de sudo passwordless configuré (limitation infra acceptée pour le drill Pass 7). La procédure est néanmoins validée par :
- Le script `cryptsetup` est présent et fonctionnel (version 2.4.3 confirmée sur xch-deploy).
- La syntaxe bash + parser arguments validés en dry-run.
- La procédure documentée §3-5 ci-dessus est testable par l'opérateur avec une vraie clé USB physique.

**À programmer pour Track E.3** : exercer la procédure complète sur la VM pilote employeur (avec sudo + clé USB physique) lors du cutover. Cf. checklist `cutover-prod-airgap.md`.

---

## 7. Cron hebdomadaire (opt-in, recommandé post-pilote)

```bash
# /etc/cron.d/xch-offsite-backup
# Tous les lundis à 03:00 — l'opérateur doit avoir branché la clé le dimanche soir.
# 0 3 * * 1 root  /opt/<DEPLOY_DIR>/scripts/offsite-backup-luks.sh /dev/sdb1 >> /var/log/xch-offsite.log 2>&1

# Note : laissé commenté par défaut. L'opérateur doit confirmer la présence physique de la clé.
# Pour automatisation totale (clé toujours branchée), décommenter — mais l'air-gap offsite
# perd alors son sens (clé visible 24/7 = attaque physique possible).
```

---

## 8. Cross-références

- Script : [scripts/offsite-backup-luks.sh](../../scripts/offsite-backup-luks.sh)
- DR drill mesurée : [dr-drill.md](dr-drill.md) (RTO/RPO chiffrés)
- Recovery scénarios : [recovery-runbook.md](recovery-runbook.md)
- Restore script (utilisé en §4.2) : [scripts/restore-full.sh](../../scripts/restore-full.sh)
- ADR backup encryption : [adr-019 secrets-at-rest-encryption](../decisions/adr-019-secrets-at-rest-encryption.md) + [adr-026 backup v2 polish](../decisions/adr-026-backup-v2-polish.md)
- Backup key rotation (XCH_MASTER_KEY interne, pas LUKS) : [backup-key-rotation.md](backup-key-rotation.md)
- D2.3 décision RSI : MCP `XCH_TRACK_E_PREPROD_READINESS_2026_05_15`
