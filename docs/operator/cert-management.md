# XCH — TLS certificate management

> **Scope** : génération, rotation, troubleshooting des certificats TLS XCH selon le mode de déploiement.
> Placeholders : `<DEPLOY_DOMAIN>`, `<DEPLOY_HOST>`, `<CA_BUNDLE>`, `<CA_INTERNE_NAME>`, `<ADMIN_EMAIL>`.

---

## 1. Mode-by-mode cert strategy

| Mode | Stratégie cert | Renewal |
|---|---|---|
| A. Cloud public | Let's Encrypt (certbot) ou Cloudflare proxy | Auto (90j) |
| B. Cloud privé | CA interne client `<CA_INTERNE_NAME>` OR Let's Encrypt | Manuel selon CA (1-5 ans) ou auto |
| **C. Air-gap** | **Self-signed local OU CA interne employeur** | **Manuel via rotation script** |
| D. VPS basique | Let's Encrypt (certbot) | Auto (90j) |

---

## 2. Self-signed local (Mode C air-gap fallback)

Quand l'employeur n'a pas de CA interne disponible.

### 2.1 Génération via `scripts/generate-ssl.sh`

```bash
# Sur la VM pilote (depuis <COMPOSE_DIR>)
bash scripts/generate-ssl.sh \
  --domain <DEPLOY_DOMAIN> \
  --san "DNS:<DEPLOY_DOMAIN>,DNS:glitch.<DEPLOY_DOMAIN>,IP:<VM_IP>" \
  --validity 365 \
  --output docker/nginx/ssl/
```

Produit : `docker/nginx/ssl/{fullchain.pem, privkey.pem}` (chmod 600).

### 2.2 Distribution navigateurs admin

Le certificat self-signed n'est pas trusted par défaut. Distribuer manuellement aux admins :
- Export `fullchain.pem` (≠ privkey !)
- Import dans le keychain navigateur / OS de chaque admin
- Documenter dans le ticket onboarding admin

### 2.3 Renewal manuel ≤ 1 an

```bash
# Re-générer + reload NPM
bash scripts/generate-ssl.sh --domain <DEPLOY_DOMAIN> --validity 365
docker exec <NPM_CONTAINER> sh -c 'nginx -s reload'
```

---

## 3. CA interne employeur (Mode C, B optionnel)

Quand l'employeur fournit une CA interne (`<CA_INTERNE_NAME>`).

### 3.1 Procédure

1. **Générer CSR sur la VM** :
   ```bash
   openssl req -new -newkey rsa:4096 -nodes \
     -keyout /tmp/xch.key \
     -out /tmp/xch.csr \
     -subj "/CN=<DEPLOY_DOMAIN>/O=<ORG_NAME>" \
     -addext "subjectAltName=DNS:<DEPLOY_DOMAIN>,DNS:glitch.<DEPLOY_DOMAIN>"
   ```
2. **Envoyer CSR à l'IT employeur** pour signature par `<CA_INTERNE_NAME>`.
3. **Recevoir cert signé** (`xch.crt`) + chain `<CA_BUNDLE>`.
4. **Installer** :
   ```bash
   cat xch.crt <CA_BUNDLE> > docker/nginx/ssl/fullchain.pem
   cp /tmp/xch.key docker/nginx/ssl/privkey.pem
   chmod 600 docker/nginx/ssl/privkey.pem
   docker exec <NPM_CONTAINER> sh -c 'nginx -s reload'
   ```

### 3.2 Renewal selon politique CA employeur (typiquement 1-5 ans)

Calendar reminder T-30j avant expiration.

---

## 4. Let's Encrypt (Mode A, D, B optionnel)

Si DNS public résolvable :

```bash
# Auto via certbot HTTP-01 (NPM en proxy)
sudo certbot --nginx -d <DEPLOY_DOMAIN> --email <ADMIN_EMAIL> --agree-tos -n

# OR DNS-01 si CloudFlare proxy ON
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d <DEPLOY_DOMAIN> -d '*.<DEPLOY_DOMAIN>'
```

Renewal auto via certbot timer systemd. Monitorer `journalctl -u snap.certbot.renew.timer`.

---

## 5. Troubleshooting

### 5.1 NPM upstream invalid (502 Bad Gateway)

Cf. [bootstrap-runbook.md §5](bootstrap-runbook.md#5--npm-proxy-dns-cache-gotcha-critique) — DNS cache, pas un problème cert. Reload nginx.

### 5.2 Browser warning "cert untrusted"

- Self-signed : import manuel dans keychain admin (cf. §2.2)
- CA interne : import `<CA_BUNDLE>` dans store OS de chaque poste

### 5.3 Cert expired

```bash
openssl x509 -in docker/nginx/ssl/fullchain.pem -noout -dates
# notAfter doit être > now()
```

Régénérer / renouveler selon mode (§2/3/4).

### 5.4 Cert chain incomplet

```bash
openssl s_client -connect <DEPLOY_DOMAIN>:443 -showcerts < /dev/null
# Doit montrer la chaîne complète jusqu'à la root CA
```

Si chain incomplet : concaténer `xch.crt + intermediate.crt + root.crt > fullchain.pem`.

---

## 6. Cross-références

- Bootstrap : [bootstrap-runbook.md](bootstrap-runbook.md)
- Cutover air-gap : [cutover-prod-airgap.md](cutover-prod-airgap.md)
- Script gen-ssl : [scripts/generate-ssl.sh](../../scripts/generate-ssl.sh)
- Server hardening : [server-hardening.md](server-hardening.md)
