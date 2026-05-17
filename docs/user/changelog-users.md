# XCH — Journal des évolutions (version opérateur)

> **Public** : opérateurs RSI, administrateurs client, utilisateurs finaux non-techniques.
> **Objet** : journal des évolutions XCH formulé sans jargon technique, focalisé sur ce que les utilisateurs voient ou doivent savoir.
> **Pour la version technique détaillée** : voir `CHANGELOG.md` à la racine du dépôt.

---

## 🚀 Version 2.4.0 — 17 mai 2026 (Pré-production)

Cette version finalise la préparation au pilote production en environnement isolé (air-gap).

### Ce qui s'améliore
- **Documentation complète pour les opérateurs** : guide de conformité RGPD adapté à 4 modes d'hébergement, procédure de passation à un second administrateur, journal des évolutions utilisateur.
- **Tests de performance et d'accessibilité** : XCH a été soumis à un test de charge réaliste (100 utilisateurs en simultané) et un audit d'accessibilité (Lighthouse + axe).
- **Procédure de récupération après sinistre** : un exercice de restauration complet a été exécuté et chronométré pour valider le bon fonctionnement des sauvegardes.

### À savoir
- Cette version est destinée aux opérateurs avant la mise en production réelle. Les utilisateurs finaux ne verront pas de changement visuel direct.
- Quelques améliorations d'accessibilité visuelle (contrastes de couleurs) sont planifiées pour une version ultérieure.

---

## 🛡️ Version 2.3.4 — 16 mai 2026 (Sécurité air-gap)

Cette version finalise les outils de mise en service en environnement totalement isolé d'Internet.

### Ce qui change pour vous
- **Mise en service air-gap simplifiée** : un script et un guide pas-à-pas permettent d'installer XCH sur un serveur sans accès Internet, en 5 minutes pour le démarrage initial.
- **Procédure de retour arrière (rollback)** : si une mise à jour pose problème, une procédure documentée permet de revenir à la version précédente.
- **Quatre modes d'hébergement supportés** : cloud public, cloud privé client, serveur isolé air-gap (mode pilote référence), VPS basique.

### À savoir
- Le mode air-gap a été validé empiriquement par 2 cycles complets de wipe + bootstrap.
- Les 3 autres modes (cloud public/privé/VPS) sont des modèles documentés mais leur validation en conditions réelles est planifiée pour les déploiements suivants.

---

## 🔁 Version 2.3.3 — 16 mai 2026 (Récupération + monitoring)

Cette version livre les outils de récupération après sinistre et de monitoring.

### Ce qui change pour vous
- **Notifications par email** : XCH peut maintenant envoyer des notifications par email via le serveur SMTP de votre organisation.
- **Sauvegarde hors-site sur USB chiffré** : pour les déploiements isolés, une procédure permet de transférer hebdomadairement les sauvegardes sur une clé USB chiffrée.
- **Tableau de bord santé** : un endpoint `/api/health` permet à votre outil de monitoring (Grafana, Gatus, etc.) de vérifier que XCH fonctionne correctement.

### Ce qui s'améliore
- **Restauration plus fiable** : le script de restauration des sauvegardes a été récrit pour supporter le nouveau format chiffré v2.
- **Documentation opérateur enrichie** : 5 nouveaux guides — exercice DR, alerting, récupération après panne, réponse aux incidents, sauvegarde hors-site.

### Mesures concrètes
- Sauvegarde d'un client de test (724 KB chiffré) : 0,5 seconde
- Restauration complète : 1,1 seconde (incluant idempotence intelligente)

---

## 🔒 Version 2.3.0 → 2.3.2 — 15 mai 2026 (Sauvegarde polish + sécurité)

Trois versions livrées le même jour pour finaliser la sauvegarde v2 et corriger un point de sécurité.

### Ce qui change pour vous
- **Sauvegardes chiffrées** : toutes les sauvegardes sont désormais chiffrées en AES-256 (norme militaire).
- **Restauration entre clients** : possibilité de restaurer une sauvegarde d'un client dans un autre client (utile pour le support, démonstrations, ou migration).
- **Sauvegardes volumineuses supportées** : les sauvegardes de plusieurs gigaoctets sont maintenant gérées sans dépassement de mémoire.

### Correctif sécurité (v2.3.2)
- **Renforcement isolation entre clients** : un audit interne a identifié un endpoint qui ne vérifiait pas correctement à quel client appartenait une donnée modifiée. Corrigé.

---

## 💾 Version 2.2.0 et 2.2.1 — 14 mai 2026 (Sauvegarde v2 — streaming)

### Ce qui change pour vous
- **Sauvegarde en arrière-plan** : lancer une sauvegarde ne bloque plus l'interface. Une barre de progression permet de suivre l'avancement.
- **Restauration sans doublons** : si une donnée existe déjà à la restauration, elle est conservée plutôt qu'écrasée (idempotence).
- **Mode prévisualisation** : avant de restaurer, possibilité de voir ce qui sera créé / conservé / écrasé.

### À savoir
- L'ancien format de sauvegarde (v1) reste pris en charge pour les restaurations rétroactives.

---

## 🧹 Version 2.1.4 — 12 mai 2026 (Ménage technique)

Pas de changement visible pour l'utilisateur. Nettoyage du code interne (suppression de fichiers obsolètes Gatus + ancien fichier de configuration).

---

## 🐛 Version 2.1.3 — 10 mai 2026 (Corrections plans + sauvegardes)

### Ce qui s'améliore
- **Plans de chantier** : correction d'un problème où certains plans n'affichaient pas correctement leur titre et leur site.
- **Sauvegardes plus complètes** : 9 types de données supplémentaires sont maintenant inclus dans les sauvegardes (photos, mouvements d'assets, commentaires de tâches, etc.). Taille de la sauvegarde : 101 KB → 164 KB.

---

## 🎨 Version 2.1.2 — 10 mai 2026 (Corrections bugs + refonte UI)

Cette version corrige 13 problèmes remontés lors du test global du 9 mai.

### Ce qui s'améliore (visible immédiatement)
- **Mode sombre / clair** : le thème choisi est désormais conservé entre les sessions.
- **Compteur de budgets** : la bannière "X budgets dépassent" affiche maintenant le bon nombre.
- **Pagination** : les compteurs de pagination affichent les bons totaux.
- **Avatars utilisateurs** : nouveau composant unifié, fonctionne avec les annotations préfixées.
- **Import CSV** : interface professionnalisée (textes plus clairs, écrans de chargement cohérents).
- **Page Monitoring** : refonte des textes, accents corrigés.
- **Layout Budgets** : hiérarchie parent/sous-budget plus lisible.
- **Page Paramètres** : 10 écrans de chargement cohérents.

### Correctif performance
- Suppression d'une boucle qui pouvait faire 29 requêtes successives au démarrage (impact CPU navigateur).

---

## 🗄️ Version 2.1.1 — 9 mai 2026 (Optimisations base de données)

Pas de changement visible. Optimisation de requêtes SQL lourdes pour améliorer les performances de l'application sur les grandes bases de données.

---

## 👁️ Version 2.1.0 — 9 mai 2026 (Monitoring d'erreurs auto-hébergé)

### Ce qui change pour vous
- **Détection automatique des erreurs** : XCH intègre désormais GlitchTip, un outil de monitoring d'erreurs **auto-hébergé** (zéro donnée envoyée à l'extérieur).
- **Alertes proactives** : en cas d'erreur applicative, l'opérateur est notifié avant que l'utilisateur ne signale.
- **Rétention 90 jours** : les erreurs sont conservées 90 jours puis automatiquement purgées.

### À savoir
- Aucune donnée n'est envoyée à un service tiers (compatible RGPD et air-gap).

---

## 🛡️ Version 2.0.0 — 6 mai 2026 (Sécurisation 100 %)

Étape majeure : finalisation de la sécurisation complète de l'application.

### Ce qui change pour vous
- **Validation systématique des données** : 100 % des entrées utilisateur sont désormais validées par le serveur.
- **Sécurité navigateur renforcée (CSP strict)** : protection contre l'injection de scripts malveillants.

### À savoir
- Aucune action requise côté utilisateur. Les améliorations sont transparentes.

---

## 📋 Versions 1.9.0 → 1.11.0 — début mai 2026 (Plan v2 finalisation)

Série de versions qui ont finalisé le plan v2 du projet :
- **1.11.0** : sécurisation cascade vague A+B (12 modules)
- **1.10.0** : sécurisation par rôle (RBAC) universelle
- **1.9.0** : refonte tests automatisés bout-en-bout + sessions 7 + 7.5 du plan v2

### Ce qui s'améliore
- **Tests automatisés** : la couverture de tests bout-en-bout passe à 100 % sur 10 chemins critiques.
- **Rôles utilisateurs** : permissions plus strictes et plus cohérentes entre les modules.

### À savoir
- Ces versions ont préparé le terrain pour le pilote en environnement isolé.

---

## Avant la 1.9.0

Pour l'historique complet, consultez le fichier `CHANGELOG.md` à la racine du dépôt. Les versions antérieures (1.0 → 1.8) ont concerné principalement la mise en place initiale du produit et ne sont pas reformulées ici par concision.

---

## Comment lire ce journal

- **Ce qui change pour vous** : nouveautés directement visibles dans l'interface.
- **Ce qui s'améliore** : améliorations existantes (performance, fiabilité, ergonomie).
- **À savoir** : informations importantes sur des changements de comportement, des limitations connues, ou des actions opérateur requises.
- **Mesures concrètes** : chiffres réels mesurés (RTO, temps de réponse, taille de sauvegarde, etc.).

---

**Mise à jour** : 2026-05-17 — Track E.4 PR3
**Référence technique** : `CHANGELOG.md`
