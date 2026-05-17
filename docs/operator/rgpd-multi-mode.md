# XCH — Conformité RGPD multi-mode

> **⚠️ TEMPLATE — à compléter par DPO client. Ce document N'EST PAS un conseil juridique (NOT legal advice).**
> Il fournit la structure opérationnelle d'analyse de conformité par mode de déploiement et un canevas de DPA. La validation finale relève du DPO du client / responsable de traitement.

**Date** : 2026-05-17 — Track E.4 PR3
**Versionnage** : v2.4.0
**Référentiel** : RGPD (UE 2016/679) + recommandations CNIL 2022
**Périmètre** : XCH gestion IT chantiers temporaires, données de personnel intérimaire + identifiants RSI
**Cross-références internes** :
- [Matrice des 4 modes de déploiement](deployment-modes.md)
- [Rotation offsite LUKS](offsite-backup.md)
- [Bootstrap runbook](bootstrap-runbook.md)
- [Cutover air-gap](cutover-prod-airgap.md)

---

## 0. Vue d'ensemble — données traitées par XCH

| Catégorie | Données | Sensibilité RGPD | Base légale typique |
|---|---|---|---|
| Identité utilisateurs RSI | nom, prénom, email, rôle | Art. 6.1.b (contrat) ou 6.1.f (intérêt légitime) | Contrat de travail / mission |
| Audit trail | userId, IP, userAgent, delegationId, action, timestamp | Art. 6.1.c (obligation légale) | Sécurité du SI |
| Assets / chantiers | NetBox refs, sites, équipements | Hors RGPD (données non personnelles) | n/a |
| Photos terrain | photos prises sur site | Art. 6.1.f si pas de visage / 6.1.a sinon | Documentation chantier |
| Tâches + commentaires | texte libre, peut contenir données pers. | Art. 6.1.b ou 6.1.f | Coordination chantier |
| Backups | snapshot complet DB + MinIO | Hérite catégories ci-dessus | Continuité activité |

**Durée de rétention figée code** :
- Audit log : **1 an glissant** + purge cron mensuelle (cf D4.3 Track E parent, wired Pass 9 PR1)
- Backups : selon politique RGPD client (recommandation **30 jours** sauf justification légale)
- Photos : selon contrat client

**Sous-traitance** : RSI = responsable de traitement vis-à-vis du personnel intérimaire ; client final = co-responsable ou responsable de traitement secondaire selon contrat.

---

## §1 — Mode A : Cloud public (SaaS)

**Statut sous-traitance** : Hébergeur (OVH / AWS / Scaleway EU) = sous-traitant niveau 1 ; DPA fournisseur à signer.

### Localisation des données

- **Obligation** : hébergement strict **UE** (recommandé France, Pays-Bas, Allemagne, Irlande). Pas de Cloud Act / FISA exposition.
- **Vérifier** : data center exact (région cloud), pas de réplication implicite hors UE.

### Mesures techniques requises

- Chiffrement disque hébergeur natif (LUKS, AWS EBS encryption, etc.)
- TLS Let's Encrypt obligatoire (pas de HTTP)
- Backups chiffrés (AES-256-GCM XCH v2.3.0+) + cross-region UE-only
- Audit log activé + purge 1 an
- SSO Entra ID / Okta / Google Workspace (pas de comptes locaux long-terme)

### Mesures organisationnelles requises

- DPA signé avec hébergeur (modèles standards AWS / Azure / GCP / OVH disponibles)
- Registre des traitements RGPD à jour (Art. 30)
- Désignation DPO formelle (Art. 37)
- Politique de gestion des droits (accès, rectification, effacement, portabilité)

### Risques résiduels

- Cloud Act US (uniquement si l'hébergeur est sous juridiction US — non recommandé)
- Dépendance fournisseur SaaS (lock-in)
- Coût mensuel récurrent

### Action DPO

- Audit hébergeur (certifications ISO 27001, HDS si santé, SecNumCloud si secteur sensible)
- Validation contractuelle clause RGPD

---

## §2 — Mode B : Cloud privé client (datacenter client)

**Statut sous-traitance** : Datacenter physique = client lui-même (pas de sous-traitance hébergeur). RSI = sous-traitant niveau 1 du client. Si infogérance externe (mainteneur tiers) : sous-traitance niveau 2.

### Localisation des données

- **Sous le contrôle physique direct du client** : pas d'exposition cloud, RGPD plus facile à documenter
- Vérifier : pas de réplication implicite vers autre site sans contrôle d'accès équivalent

### Mesures techniques requises

- Contrôle d'accès physique au datacenter (badge / biométrie / videosurveillance loggée 30 jours)
- Chiffrement disque (LUKS / BitLocker / opal SED)
- TLS CA interne client OR Let's Encrypt si DNS public
- Backups vers NFS share interne client (pas vers cloud externe sauf accord explicite)
- Audit log + 1 an purge

### Mesures organisationnelles requises

- Convention de service entre RSI et client (rôles responsable / sous-traitant Art. 28)
- Si infogérance externe : DPA tripartite client / infogérant / RSI
- Plan de continuité documenté (PCA / PRA)

### Risques résiduels

- Risque physique du datacenter client (sinistre, vol, vétusté)
- Dépendance des équipes IT du client (disponibilité, montée en compétence)

### Action DPO

- Audit datacenter physique (contrôle d'accès, climatisation, redondance)
- Validation infogérant si présent

---

## §3 — Mode D : VPS basique (single-node petit client)

**Statut sous-traitance** : Hébergeur VPS (OVH / Hetzner / Scaleway) = sous-traitant niveau 1. Modèle proche Mode A mais simplifié (pas de SaaS multi-tenant).

### Localisation des données

- **Obligation** : VPS hébergé UE strict (vérifier datacenter exact, pas l'adresse facturation)
- Hetzner FR/DE, OVH FR/DE, Scaleway FR/PL/NL = OK
- Hetzner FI ou hors-UE = à éviter pour données françaises sans clause spécifique

### Mesures techniques requises

- Responsabilité technique exclusive client (root VPS = client)
- Chiffrement disque VPS (option provider, LUKS au boot recommandé)
- TLS Let's Encrypt + renouvellement auto certbot
- UFW + fail2ban + SSH key-only (cf `server-hardening.md`)
- Backups rsync vers VPS secondaire UE OU stockage objet S3-compatible UE
- Audit log + 1 an purge

### Mesures organisationnelles requises

- DPA hébergeur VPS (clauses standards OVH / Hetzner / Scaleway)
- Politique mot de passe administrateur (force, rotation, vault)
- Documenter qui est root et comment les accès sont révoqués au départ d'un admin

### Risques résiduels

- Single point of failure (un seul serveur)
- Compétences techniques requises côté client (SSH, Docker, backup restore)
- Pas de redondance géographique implicite

### Action DPO

- Audit VPS provider (certifications)
- Validation procédure rotation admins

---

## §4 — Mode C : Air-gap strict (on-premise full — pilote employeur référence)

**Statut sous-traitance** : Aucune sous-traitance hébergeur (VM interne employeur). RSI = sous-traitant niveau 1 du client (employeur) si déploiement sur sa propre infra.

### Localisation des données

- **100 % on-premise** : zéro transfert hors site sauf USB chiffré LUKS rotation hebdomadaire (cf [offsite-backup.md](offsite-backup.md))
- Pas de DNS public, pas de cloud, pas de SaaS tiers
- Conformité RGPD la plus simple à documenter (pas de transfert international, pas de sous-traitant externe)

### Mesures techniques requises

- Réseau air-gap strict OU proxy/whitelist UDP/TCP minimum (cf [cutover-prod-airgap.md](cutover-prod-airgap.md))
- VM interne employeur avec chiffrement disque (LUKS au boot ou opal SED)
- TLS self-signed local OR CA interne employeur
- **Offsite backup obligatoire LUKS-2 AES-256-XTS** sur USB physique rotation hebdo (cf `offsite-backup.md`)
- Rotation 2 clés USB (paire impair / pair) avec stockage géographiquement séparé
- Audit log + 1 an purge cron mensuelle (CI workflow + handoff opérateur)
- Pas de télémétrie outbound (vérifié `audit-egress.yml` CI)
- GlitchTip + Grafana self-hosted (zéro forward externe)

### Mesures organisationnelles requises

- Convention RSI / employeur sur rôles responsable / sous-traitant
- Politique passphrase LUKS (24+ chars, stockée vault opérateur cf `offsite-backup.md` §5)
- Procédure de transit physique USB documentée (qui transporte, comment, vers où)
- Désignation 2e admin RGPD (cf `handoff.md`)

### Risques résiduels

- Perte physique d'un USB en transit (mitigé par chiffrement LUKS)
- Pas de DR géographique implicite (mitigé par USB rotation 2 clés)
- Disponibilité opérateur unique (mitigé par `handoff.md` 2e admin)

### Action DPO

- Audit physique de la VM hôte (datacenter employeur)
- Validation procédure USB rotation + lieu de stockage offsite
- Test trimestriel restauration depuis USB offsite

---

## 5. Droits des personnes — implémentation XCH

Pour tout mode (A/B/C/D), XCH expose les capacités suivantes pour traiter les demandes RGPD :

| Droit RGPD | Endpoint XCH | Procédure opérateur |
|---|---|---|
| **Accès** (Art. 15) | `GET /api/users/me` + `GET /api/audit-log/me` (à valider implémentation) | Login utilisateur, export depuis profil |
| **Rectification** (Art. 16) | `PATCH /api/users/me` | Login utilisateur, édition profil |
| **Effacement** (Art. 17) | `DELETE /api/users/:id` (super-admin) | Procédure opérateur : 1) anonymiser audit_log via mécanisme TBD Track F, 2) supprimer profil, 3) conserver audit_log anonymisé pour traçabilité légale |
| **Limitation** (Art. 18) | Désactiver compte (`PATCH /api/users/:id`) | Login bloqué mais données conservées |
| **Portabilité** (Art. 20) | Export backup tenant scoped (super-admin) | Demande utilisateur → export ciblé via mécanisme TBD Track F |
| **Opposition** (Art. 21) | Désactivation + flag opt-out | À implémenter Track F si demande client formelle |

**Gap Track F** : automatisation des droits RGPD utilisateur final (export self-service, anonymisation audit). Trace dans `XCH_PLAN_V3_POST_V2_2026_05_17`.

---

## 6. Notification de violation (Art. 33-34)

**Délai légal** : 72 h après prise de connaissance auprès de la CNIL (Art. 33).

**Procédure XCH** :
1. Détection via GlitchTip alerts + audit log anomalies
2. Bascule incident response (cf `incident-response.md`)
3. Évaluation impact (nombre de personnes, catégorie de données)
4. Si violation confirmée à risque pour les droits : notification CNIL via portail dédié + notification personnes concernées (Art. 34)
5. Documentation interne dans registre violations (Art. 33.5)

---

## 7. Annex — Template DPA (Data Processing Agreement)

> **⚠️ Ce template est une structure de base. À compléter par juriste / DPO. NOT legal advice.**

### Clause 1 — Objet
Le présent Accord régit le traitement de données à caractère personnel effectué par [SOUS-TRAITANT] pour le compte de [RESPONSABLE] dans le cadre de l'utilisation de XCH.

### Clause 2 — Nature et finalité du traitement
- **Finalité** : gestion des chantiers IT temporaires, suivi du personnel intérimaire, traçabilité des opérations
- **Nature** : stockage, consultation, modification, suppression sur les catégories listées au §0

### Clause 3 — Catégories de données et personnes concernées
- Voir §0 — catégories de données traitées par XCH
- Personnes concernées : salariés, intérimaires, sous-traitants, clients finaux

### Clause 4 — Durée du traitement
- Durée du contrat-cadre + délai de purge automatique selon politique de rétention

### Clause 5 — Obligations du sous-traitant
- Confidentialité du personnel ayant accès aux données
- Mesures techniques et organisationnelles conformes Art. 32 (cf §1-4 ci-dessus selon mode)
- Notification toute violation à [RESPONSABLE] dans les 24 h
- Coopération aux demandes des personnes concernées
- Suppression / restitution en fin de contrat

### Clause 6 — Sous-traitance ultérieure
- Liste exhaustive des sous-traitants ultérieurs (cf mode A/B/C/D §statut sous-traitance)
- Information préalable de [RESPONSABLE] avant changement

### Clause 7 — Transferts internationaux
- Mode A / D : hébergement strict UE
- Mode B / C : pas de transfert international
- Si transfert hors UE : Clauses Contractuelles Types (CCT) ou autre garantie Art. 46

### Clause 8 — Droits des personnes
- Le sous-traitant assiste le responsable pour répondre aux demandes (cf §5 ci-dessus)

### Clause 9 — Audit et contrôle
- Droit d'audit annuel du responsable
- Documentation à disposition (registre, politiques, procédures)
- Coopération avec autorité de contrôle (CNIL)

---

## 8. Checklist pré-cutover RGPD

Avant cutover production (tout mode) :

- [ ] DPA signé entre RSI et client final
- [ ] Si Mode A/D : DPA hébergeur signé
- [ ] Si Mode B : convention infogérance signée si applicable
- [ ] Politique de rétention documentée (audit log 1 an, backups TBD selon client)
- [ ] Procédure droits personnes documentée + testée
- [ ] Procédure violation documentée + testée
- [ ] Registre des traitements à jour
- [ ] DPO désigné formellement (si requis Art. 37)
- [ ] Formation 2e admin sur RGPD (cf `handoff.md`)
- [ ] Test trimestriel restore + purge audit (cf `dr-drill.md`)

---

## 9. Cross-références

- [deployment-modes.md](deployment-modes.md) — matrice 4-mode (RGPD ligne D4.3 = rétention audit)
- [offsite-backup.md](offsite-backup.md) — LUKS rotation Mode C
- [cutover-prod-airgap.md](cutover-prod-airgap.md) — procédure Mode C référence
- [handoff.md](handoff.md) — checklist 2e admin (inclut sensibilisation RGPD)
- [incident-response.md](incident-response.md) — procédure violation §33-34
- [recovery-runbook.md](recovery-runbook.md) — restore intégrité données

---

**Note de fin** : Ce document est un livrable PR3 Track E.4 (2026-05-17). Il sera mis à jour à la signature formelle DPA client + après pen test externe (Track F backlog `XCH_PLAN_V3_POST_V2_2026_05_17`).
