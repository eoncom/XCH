# XCH — Server hardening checklist (Mode C air-gap)

> **Scope** : durcissement OS + Docker hôte XCH selon la décision RSI Track E.3 (UFW + SSH key only + fail2ban + journald).
> Placeholders : `<DEPLOY_HOST>`, `<ADMIN_PUBKEY>`, `<SMTP_RELAY>`, `<NTP_SOURCE>`.

---

## 1. UFW (firewall)

```bash
# Cf. scripts/ufw-enforce.sh (Track E.2 Pass 8)
sudo SMTP_RELAY=<SMTP_RELAY> NTP_SOURCE=<NTP_SOURCE> bash <COMPOSE_DIR>/scripts/ufw-enforce.sh

# Validation
sudo ufw status verbose
```

---

## 2. SSH (key only, no password)

```bash
# /etc/ssh/sshd_config — clés autorisées uniquement
sudo sed -i 's|^#?PasswordAuthentication.*|PasswordAuthentication no|' /etc/ssh/sshd_config
sudo sed -i 's|^#?PermitRootLogin.*|PermitRootLogin no|' /etc/ssh/sshd_config
sudo sed -i 's|^#?ChallengeResponseAuthentication.*|ChallengeResponseAuthentication no|' /etc/ssh/sshd_config
sudo sed -i 's|^#?UsePAM.*|UsePAM yes|' /etc/ssh/sshd_config

# Restart
sudo systemctl restart sshd

# Authorize admin key
sudo mkdir -p /home/<ADMIN_USER>/.ssh
echo "<ADMIN_PUBKEY>" | sudo tee -a /home/<ADMIN_USER>/.ssh/authorized_keys
sudo chown -R <ADMIN_USER>:<ADMIN_USER> /home/<ADMIN_USER>/.ssh
sudo chmod 700 /home/<ADMIN_USER>/.ssh
sudo chmod 600 /home/<ADMIN_USER>/.ssh/authorized_keys
```

---

## 3. fail2ban

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
banaction = ufw

[sshd]
enabled = true
port = ssh
filter = sshd

# Note : XCH /api/auth/login a déjà ThrottlerGuard (100 req/min) côté NestJS.
# fail2ban niveau OS pour SSH suffit en air-gap.
EOF
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

---

## 4. journald retention

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/xch.conf > /dev/null <<EOF
[Journal]
Storage=persistent
SystemMaxUse=2G
SystemMaxFileSize=200M
MaxRetentionSec=2month
ForwardToSyslog=no
EOF
sudo systemctl restart systemd-journald
```

---

## 5. AppArmor / SELinux

Ubuntu 22.04 par défaut : AppArmor actif. Validation :
```bash
sudo aa-status | head -5
```

Pas de tuning XCH spécifique — les containers Docker utilisent le profile `docker-default` AppArmor.

---

## 6. Disk quotas + logging

```bash
# Limites Docker logs
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" }
}
EOF
sudo systemctl restart docker
```

---

## 7. Sécurité utilisateurs

```bash
# Désactiver les comptes inutiles
sudo passwd -l root        # lock root
sudo passwd -l games       # lock comptes système inutiles
sudo passwd -l news

# Sudo NOPASSWD uniquement pour scripts XCH (si nécessaire)
sudo tee /etc/sudoers.d/xch > /dev/null <<EOF
# Pour les scripts XCH automation
<ADMIN_USER> ALL=(root) NOPASSWD: <COMPOSE_DIR>/scripts/teardown-xch-stack.sh
<ADMIN_USER> ALL=(root) NOPASSWD: <COMPOSE_DIR>/scripts/offsite-backup-luks.sh
<ADMIN_USER> ALL=(root) NOPASSWD: <COMPOSE_DIR>/scripts/ufw-enforce.sh
EOF
sudo chmod 0440 /etc/sudoers.d/xch
sudo visudo -c   # syntax check
```

---

## 8. Audit + monitoring

- `journalctl --since 'today'` régulièrement vérifié par admin
- `lastlog` + `last` pour audit accès SSH
- fail2ban logs `/var/log/fail2ban.log`
- Grafana panel custom si volume justifie (Track E.4)

---

## 9. Checklist hardening final

- [ ] UFW actif + règles correctes (`ufw status verbose`)
- [ ] SSH password disabled (`grep PasswordAuthentication /etc/ssh/sshd_config`)
- [ ] SSH root disabled
- [ ] fail2ban running (`systemctl status fail2ban`)
- [ ] journald persistent + retention 2 mois
- [ ] Docker log rotation 50m × 5 files
- [ ] `<ADMIN_USER>` sudo limité aux scripts XCH
- [ ] root locked + comptes système inutiles locked
- [ ] AppArmor actif (`aa-status`)
- [ ] `audit-egress.sh --strict` : PASS 4/4
- [ ] Test ban : `ssh -i bad-key <DEPLOY_HOST>` 6× → ban IP 1h

---

## 10. Cross-références

- UFW script : [scripts/ufw-enforce.sh](../../scripts/ufw-enforce.sh)
- Audit egress : [scripts/audit-egress.sh](../../scripts/audit-egress.sh)
- Cutover air-gap : [cutover-prod-airgap.md](cutover-prod-airgap.md)
- Secrets rotation : [secrets-rotation.md](secrets-rotation.md)
