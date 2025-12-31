**Application de gestion IT pour chantiers - Instance mono-délégation**

---

## 📋 VISION PRODUIT

### Problème résolu

Les DSI de délégations gèrent des dizaines de chantiers temporaires avec une infrastructure IT critique (réseau, connectivité, équipements). Aujourd'hui, les informations sont dispersées dans des fichiers Excel, emails, et outils spécialisés multiples. Les interventions terrain sont ralenties par le manque d'accès rapide à l'information contextuelle.

### Solution

XCH est le hub centralisé pour toutes les informations IT des chantiers d'une délégation. Il ne remplace pas les outils spécialisés (NetBox, monitoring, ticketing) mais centralise le contexte et référence ces outils.

### Valeur ajoutée

- **Accès instantané** : Toute info chantier disponible en 3 clics ou 1 scan QR
- **Mobile-first** : Interventions terrain fluides sans chercher dans des docs
- **Vue d'ensemble** : Carte temps réel de tous les chantiers et leur santé
- **Traçabilité** : Historique complet des actions et modifications
- **Intégrations** : Connecte aux outils existants sans les remplacer

---

## 👥 UTILISATEURS

### Personas

**1. RSI (Responsable SI Délégation)**
- Besoin : Vue consolidée de tous les chantiers, rapports, supervision
- Utilisation : Desktop principalement, dashboards
- Fréquence : Quotidienne

**2. Administrateur IT**
- Besoin : Gestion complète chantiers/assets, configuration intégrations
- Utilisation : Desktop + mobile occasionnel
- Fréquence : Quotidienne intensive

**3. Manager IT**
- Besoin : Vue d'ensemble, validation, reporting
- Utilisation : Desktop, exports
- Fréquence : Hebdomadaire

**4. Technicien Support**
- Besoin : Interventions terrain rapides, mise à jour statuts, photos
- Utilisation : Mobile principalement (smartphone/tablette)
- Fréquence : Quotidienne sur le terrain

**5. Viewer (lecture seule)**
- Besoin : Consultation informations
- Utilisation : Desktop/mobile
- Fréquence : Occasionnelle

---

## 🎯 FONCTIONNALITÉS DÉTAILLÉES

### 1. GESTION DES CHANTIERS (Sites)

#### 1.1 Référentiel chantiers

**Création/édition chantier** avec :
- **Code chantier** (obligatoire, unique, stable dans le temps)
- **Nom** (obligatoire)
- **Statut** : Préparation / Actif / Clos
- **Adresse complète** (obligatoire)
- **Coordonnées GPS** (obligatoire, pour affichage carte)
- **Contacts terrain** :
  - Contact principal obligatoire (nom + téléphone minimum)
  - Contacts secondaires illimités
  - Rôles personnalisables (chef de chantier, conducteur travaux, etc.)
- **Notes d'accès** :
  - Horaires d'accès
  - Contraintes spécifiques (badges, local technique, consignes sécurité)
  - Procédures particulières

**Connectivité & Fournisseurs** :
- **Internet principal** :
  - Type (fibre, 5G, SDSL, satellite...)
  - Fournisseur
  - Référence contrat/ligne
- **Backup** (même structure)
- **Procédure coupure** :
  - Script d'escalade (qui appeler dans quel ordre)
  - Informations à communiquer
  - Numéros d'urgence
  - Délais intervention garantis

**Santé chantier** (calculée) :
- État global : OK / Warning / Critical / Inconnu
- Basé sur monitoring externe si activé
- Ou complétude manuelle des données
- Affichée sur carte et listes

#### 1.2 Liste multi-chantiers

**Affichage** :
- Vue liste ou carte
- Vignette par chantier : code, nom, statut, santé, ville

**Recherche** :
- Texte libre : cherche dans nom, code, ville, adresse
- Résultats instantanés (recherche as-you-type)

**Filtres** :
- Par statut (prépa/actif/clos)
- Par santé (OK/warning/critical/inconnu)
- Chantiers incomplets (données manquantes)
- Localisation géographique (si carte)

**Tri** :
- Dernier modifié
- Par statut
- Par santé
- Alphabétique

#### 1.3 Fiche chantier (Hub)

**Structure en onglets** :

**Onglet 1 - Résumé**
- Identité complète
- Statut et santé
- Indicateurs clés (nb équipements, tâches ouvertes, dernière intervention)
- Timeline récente des événements

**Onglet 2 - Contacts & Accès**
- Liste contacts avec coordonnées
- Notes d'accès détaillées
- Horaires
- Carte localisation

**Onglet 3 - Connectivité**
- Internet principal et backup
- Fournisseurs associés
- Procédure coupure
- Historique incidents connectivité

**Onglet 4 - Inventaire**
- Liste équipements du chantier
- Filtres par type, statut
- Actions rapides (ajouter, QR, localiser sur plan)

**Onglet 5 - Plans**
- Liste des plans d'étage
- Visionneuse avec pins
- Upload nouveaux plans

**Onglet 6 - Tâches**
- Tâches liées au chantier
- Filtres par statut, assigné
- Création rapide

**Onglet 7 - Intégrations**
- Statut connexions NetBox, monitoring
- Liens vers outils externes
- Configuration override par chantier

#### 1.4 Carte multi-chantiers

**Affichage** :
- Tous les chantiers affichés sur carte interactive
- Clustering automatique (regroupement markers proches)
- Zoom/déplacement fluide

**Marqueurs couleur** :
- 🟢 Vert : OK (tout fonctionne)
- 🔴 Rouge : Critique (incident déclaré ou service DOWN)
- 🟠 Orange : Attention (données manquantes ou état inconnu)
- ⚪ Gris : Chantier clos

**Popup marker** :
- Code + nom chantier
- Statut et santé
- Bouton "Ouvrir fiche"
- Lien rapide vers carte Google Maps

**Filtres identiques à la liste** :
- Synchronisation liste ↔ carte
- Appliquer filtre met à jour les deux vues

**Fonctionnalités avancées** :
- Recherche adresse/ville
- Dessiner zone pour filtrer
- Export liste chantiers filtrés (CSV/Excel)

---

### 2. INVENTAIRE ASSETS (Équipements)

#### 2.1 Types d'équipements gérés

**Catégories principales** :
- **Imprimantes** (multifonctions, laser, jet d'encre)
- **iPads/Tablettes** (gestion flotte mobile)
- **Réseau core** :
  - Switches
  - Firewalls
  - Points d'accès WiFi (AP)
- **Visio** :
  - Microsoft Teams Room
  - Webcams
  - Écrans interactifs
- **Autres** :
  - Caméras
  - Écrans d'affichage
  - Équipements spécifiques

#### 2.2 Fiche équipement (Asset)

**Informations essentielles** :
- **Type** (obligatoire)
- **Modèle** et fabricant
- **Numéro de série** (obligatoire pour imprimantes, iPads, réseau core)
- **Tag inventaire** (numéro interne optionnel)
- **Statut** :
  - En service
  - HS (hors service)
  - En transit
  - Stock
  - Retiré
- **Emplacement texte libre** (ex: "Local technique - Rack A - U12")
- **Rattachement chantier**

**Informations complémentaires** :
- Date achat
- Fin garantie
- Informations réseau :
  - Adresse IP
  - Adresse MAC
  - Hostname
- Notes libres
- Historique modifications

**Actions rapides** :
- Générer QR code
- Créer tâche liée
- Ajouter photo
- Localiser sur plan (si pin existe)
- Liens vers outils externes (NetBox, FortiManager si configurés)

#### 2.3 Liste assets

**Vue** :
- Tableau avec colonnes personnalisables
- Vignettes avec photo (si disponible)

**Recherche** :
- Texte libre : modèle, numéro de série, fabricant
- Instantanée

**Filtres** :
- Par type
- Par statut
- Par chantier
- Sans numéro de série (inventaire incomplet)
- Sans localisation sur plan

**Actions groupées** :
- Exporter sélection (CSV/Excel)
- Générer QR codes multiples
- Changer statut en masse

#### 2.4 Gestion mobile des assets

**Vue mobile optimisée** :
- Cards scrollables
- Recherche rapide
- Scan QR pour accès direct

**Actions terrain** :
- Mise à jour statut
- Ajout photos (appareil photo natif)
- Mise à jour emplacement
- Création tâche rapide

---

### 3. PLANS D'ÉTAGE & LOCALISATION

#### 3.1 Gestion des plans

**Import** :
- Formats supportés : PDF, PNG, JPG
- Upload drag & drop
- Taille max : 10 MB par fichier
- Versioning simple (v1, v2, v3...)
- Possibilité plusieurs plans par chantier (RDC, Étage 1, Étage 2...)

**Métadonnées** :
- Titre plan (ex: "RDC", "Étage 1")
- Version
- Date upload
- Uploadé par
- Notes optionnelles

#### 3.2 Visualisation

**Visionneuse** :
- Zoom/pan fluides (molette souris, pinch mobile)
- Rotation si nécessaire
- Plein écran
- Affichage pins existants

**Pins affichés** :
- Icônes typées selon équipement (switch, AP, imprimante...)
- Couleurs distinctes par type
- Label au survol
- Click → fiche équipement

#### 3.3 Éditeur de pins

**Mode édition** :
- Activation mode édition (réservé admin/tech)
- Palette outils :
  - Ajouter pin
  - Déplacer pin
  - Supprimer pin
  - Éditer pin

**Types de pins** :
- Switch
- Firewall
- Access Point (AP)
- Imprimante
- Rack/Baie
- Caméra
- Patch panel
- Autre (personnalisable)

**Placement pin** :
- Click sur plan pour placer
- Drag & drop pour déplacer
- Coordonnées normalisées (indépendantes de la résolution)

**Association obligatoire** :
- Un pin DOIT pointer vers un asset existant
- Ou création rapide asset depuis le plan
- Dialogue : sélectionner asset OU créer nouveau

**Label** :
- Texte court affiché sur le plan
- Auto-généré depuis asset (ex: modèle switch)
- Éditable manuellement

#### 3.4 Export plan annoté

**Formats** :
- PNG (image statique avec pins)
- PDF (avec métadonnées)

**Contenu export** :
- Plan original
- Tous les pins avec labels
- Légende (types + couleurs)
- Entête avec nom chantier, date export

**Usage** :
- Documentation interventions
- Transmission prestataires
- Archivage

---

### 4. QR CODES & ÉTIQUETTES

#### 4.1 Génération QR codes

**Par équipement** :
- Bouton "Générer QR" sur fiche asset
- QR unique par asset
- Contenu QR : URL courte non-devinable
- Token sécurisé (pas de données sensibles dans le QR)

**Génération groupée** :
- Sélectionner plusieurs assets
- Générer tous les QR d'un coup
- Export PDF étiquettes prêtes à imprimer

#### 4.2 Étiquettes imprimables

**Format** :
- PDF avec grille étiquettes
- Formats standards : Avery, etc.
- Personnalisable (nb colonnes/lignes)

**Contenu étiquette** :
- QR code
- Informations texte :
  - Code chantier
  - Type équipement
  - Modèle
  - Numéro de série
- Logo délégation (si configuré)

**Options impression** :
- Choix format étiquettes
- Nb exemplaires par asset
- Ordre tri (par chantier, par type...)

#### 4.3 Scan QR mobile

**Fonctionnement** :
- Scan via smartphone/tablette
- Caméra native du device
- Reconnaissance instantanée

**Workflow** :
1. User scan QR code
2. Authentification requise si pas déjà connecté
3. Redirection automatique vers fiche asset
4. Affichage optimisé mobile

**Actions post-scan** :
- Consulter fiche complète
- Mettre à jour statut
- Créer tâche
- Ajouter photo
- Voir localisation sur plan

**Sécurité** :
- Auth obligatoire (pas d'accès anonyme)
- Rate limiting (anti-spam)
- Logging des scans (traçabilité)

---

### 5. TÂCHES (WORK ORDERS)

#### 5.1 Création de tâches

**Informations** :
- **Titre** (obligatoire)
- **Description** (texte riche optionnel)
- **Priorité** : Basse / Moyenne / Haute / Urgente
- **Statut** : À faire / En cours / Bloqué / Terminé / Annulé
- **Assignation** : utilisateur ou non assigné
- **Date échéance** (optionnelle)

**Rattachements** :
- Lié à un chantier (obligatoire)
- Lié à un asset (optionnel)
- Si asset → chantier hérité automatiquement

**Checklist** :
- Liste points à vérifier/actions
- Cases cochables
- Ajout/suppression items dynamique
- Pourcentage complétion calculé

#### 5.2 TicketLink (Référence ticket externe)

**Principe** :
- L'outil de ticketing (ITSM) change régulièrement
- XCH ne crée pas de ticket via API
- XCH stocke juste la référence

**Informations** :
- **Référence ticket** (ex: "INC-12345")
- **URL ticket** (lien direct)
- **Statut ticket** (optionnel, manuel) : Nouveau / En cours / Résolu / Fermé

**Affichage** :
- Badge cliquable sur tâche
- Ouverture URL dans nouvel onglet
- Indication visuelle si ticket lié

#### 5.3 Gestion des tâches

**Vues** :
- **Liste** : Tableau avec tri/filtres
- **Kanban** : Colonnes par statut (à faire → en cours → terminé)
- **Calendrier** : Par date échéance

**Filtres** :
- Par statut
- Par priorité
- Par assigné
- Par chantier
- En retard (échéance dépassée)
- Non assignées

**Actions** :
- Changer statut (drag & drop en kanban)
- Réassigner
- Modifier échéance
- Ajouter commentaire
- Ajouter pièce jointe (photo, fichier)

#### 5.4 Workflow terrain

**Scénario type** :
1. Tech reçoit tâche assignée (notification)
2. Ouvre tâche sur mobile
3. Se rend sur chantier
4. Scan QR équipement (si applicable)
5. Coche items checklist
6. Ajoute photos preuves intervention
7. Ajoute commentaire résumé
8. Marque terminé

**Notifications** :
- Nouvelle tâche assignée
- Tâche mise à jour
- Échéance proche (J-1, J-3)
- Tâche en retard

---

### 6. PHOTOS & PIÈCES JOINTES

#### 6.1 Upload photos

**Sources** :
- Desktop : upload fichier classique
- Mobile : appareil photo natif
- Drag & drop

**Formats** :
- Images : JPG, PNG, HEIC
- Documents : PDF, Word, Excel
- Taille max : 5 MB par fichier

**Compression automatique** :
- Redimensionnement images si trop grandes
- Optimisation poids sans perte qualité visible
- Conservation métadonnées EXIF utiles (date, lieu si GPS)

#### 6.2 Attachement contextuels

**Attachable à** :
- Tâches (photos interventions, comptes rendus)
- Assets (photos équipement, factures, certificats)
- Sites (photos générales chantier, plans accès)

**Métadonnées** :
- Date upload
- Uploadé par
- Légende optionnelle
- Taille fichier
- Type MIME

#### 6.3 Galerie & visualisation

**Affichage** :
- Vignettes cliquables
- Lightbox plein écran
- Navigation précédent/suivant
- Zoom image

**Actions** :
- Télécharger
- Supprimer (permissions)
- Éditer légende
- Partager (copier lien)

---

### 7. CONTACTS & PRESTATAIRES

#### 7.1 Contacts chantier

**Types** :
- Contact principal (obligatoire)
- Contacts secondaires (illimités)
- Rôles personnalisables

**Informations** :
- Nom complet
- Téléphone(s)
- Email
- Rôle/fonction
- Notes

**Affichage** :
- Liste sur fiche chantier
- Click-to-call (si mobile)
- Click-to-email

#### 7.2 Référentiel prestataires

**Principe** :
- Les prestataires externes n'ont PAS de compte XCH
- Ils sont gérés comme contacts/suivi uniquement
- Exemples : câbleurs, opérateurs télécom, intégrateurs

**Fiche prestataire** :
- Nom société
- Type : Câbleur / Opérateur / Intégrateur / Maintenance / Autre
- Contacts associés (plusieurs personnes)
- Horaires disponibilité
- SLA / délais intervention
- Notes

**Association chantier ↔ prestataire** :
- Un chantier peut avoir plusieurs prestataires
- Rôle du prestataire sur le chantier (ex: "Opérateur fibre principal")
- Affichage sur fiche chantier

#### 7.3 Suivi interventions prestataires

**Tâches spécifiques** :
- Type "Intervention prestataire"
- Champs supplémentaires :
  - Prestataire concerné
  - Contact prestataire
  - Date/heure RDV
  - Résultat intervention
  - Compte rendu
- Lien ticket éventuel

**Workflow** :
1. Création tâche intervention prestataire
2. Planification RDV
3. Prestataire intervient (pas dans XCH)
4. Tech interne met à jour compte rendu
5. Photos si nécessaire
6. Clôture tâche

---

### 8. BAIES (Racks/Armoires réseau)

#### 8.1 Référentiel Baies

**Caractéristiques d'une baie** :
- **Nom/Identifiant** (ex: "Baie A", "Rack Local Technique 1")
- **Rattachement chantier** (obligatoire)
- **Hauteur totale** : 4U, 6U, 12U, 18U, 24U, 42U (valeurs standards)
- **Emplacement physique** : Description textuelle
- **Numéro de série** (optionnel)
- **Modèle/Fabricant** (optionnel)

**Informations complémentaires** :
- Type : Murale / Sur pied / Armoire fermée
- Dimensions (L × P × H en mm)
- Profondeur utile
- Charge maximale (kg)
- Alimentation :
  - Nombre PDU (multiprises)
  - Puissance disponible (W)
  - Type prises
- Refroidissement :
  - Ventilation passive / active
  - Température
- Sécurité :
  - Verrouillage (type serrure)
  - Qui détient clés
- Notes libres

**Statut** :
- En service
- Hors service
- En préparation

#### 8.2 Visualisation baie

**Vue schématique** :
- Représentation verticale des U (de bas en haut ou haut en bas selon convention)
- Graduation claire : 1U, 2U, 3U... jusqu'à hauteur totale
- Espaces occupés vs libres visuellement distincts
- Couleurs selon type équipement

**Vue liste équipements** :
- Tableau équipements montés en rack
- Colonnes : Position U, Hauteur U, Équipement, Modèle, Statut
- Tri par position
- Calcul automatique espace libre

**Indicateurs** :
- **Taux occupation** : X U utilisés / Y U total (pourcentage + jauge visuelle)
- **Espace libre continu max** : "Plus grande plage : 6U disponibles de U15 à U20"
- **Charge totale** (si poids équipements renseignés)
- **Consommation électrique** (si puissance équipements renseignée)

#### 8.3 Gestion des équipements en baie

**Montage équipement** :
- Sélectionner baie
- Sélectionner équipement asset existant (ou créer nouveau)
- Spécifier position U de départ (ex: U12)
- Spécifier hauteur équipement en U (1U, 2U, 3U, 4U...)
- Système vérifie espace disponible et empêchement chevauchements

**Types équipements montables** :
- Switches (généralement 1U)
- Firewalls (1U à 2U)
- Serveurs (1U à 4U+)
- Patch panels (1U)
- PDU / multiprises (1U à 2U)
- Équipements actifs divers
- Panneaux de brassage
- Tiroirs / étagères

**Informations spécifiques rack-mount** :
- Position U départ (obligatoire)
- Hauteur U (obligatoire)
- Face avant / arrière (optionnel)
- Profondeur équipement (optionnel)
- Poids (optionnel)
- Consommation électrique (optionnel)
- Connectivité :
  - Ports utilisés
  - Câblage (vers autres équipements, patch panels)

**Actions sur équipement monté** :
- Déplacer (changer position U)
- Retirer de la baie (démontage)
- Remplacer (swap équipement)
- Voir connectivité / câblage

#### 8.4 Planification et gestion d'espace

**Recherche espace libre** :
- "Trouver espace pour équipement 2U"
- Application surligne emplacements disponibles
- Suggestions optimales (grouper équipements similaires, gérer thermique)

**Réservation espace** :
- Marquer des U comme "réservés" pour équipement à venir
- Nom équipement prévu
- Date prévue installation
- Notes

**Mouvements / réorganisation** :
- Fonction "Réorganiser baie"
- Drag & drop équipements
- Vérification contraintes en temps réel
- Validation avant application

**Historique** :
- Journal modifications baie
- Équipements ajoutés/retirés avec dates
- Changements position

#### 8.5 Export et documentation

**Schéma baie** :
- Export PDF vue schématique
- Inclut : tous équipements positionnés, labels, position U
- Format imprimable A4 portrait
- Branded (logo délégation)

**Inventaire baie** :
- Export CSV/Excel liste équipements
- Colonnes : Position, Nom, Modèle, S/N, Statut, Notes

**Rapport complet** :
- PDF combinant schéma + inventaire + infos baie
- Usage : documentation, transmission prestataires, audit

#### 8.6 Intégration avec autres fonctionnalités

**Assets** :
- Un asset peut être "monté en baie" ou "hors baie"
- Si monté : lien vers baie + position U affichée sur fiche asset
- Bouton "Localiser dans baie" → ouvre vue baie avec équipement surligné

**Plans d'étage** :
- Pin type "Baie/Rack" sur plans
- Click pin baie → ouvre vue détaillée baie
- Permet localiser physiquement puis voir contenu

**Tâches** :
- Créer tâche liée à baie (ex: "Réorganisation Baie A")
- Créer tâche liée à équipement en baie (ex: "Remplacer switch U12")

**QR codes** :
- QR code sur baie elle-même (étiquette sur porte/façade)
- Scan → vue baie complète
- QR codes sur équipements individuels (standard)

#### 8.7 Vues multiples baies

**Vue chantier** :
- Onglet dédié "Baies" sur fiche chantier
- Liste toutes baies du chantier
- Indicateurs agrégés : total U, U utilisés, U libres
- Accès rapide chaque baie

**Vue globale** :
- Page "Toutes les baies" (niveau délégation)
- Filtres par chantier, statut, taux occupation
- Vue grille avec miniatures schémas
- Recherche baies par nom, chantier, équipement contenu

#### 8.8 Alertes et monitoring

**Alertes capacité** :
- Baie pleine (>90% occupation)
- Baie critique (>95%)
- Notification admin/manager

**Monitoring température** (si capteurs) :
- Affichage température actuelle
- Historique
- Alerte surchauffe

**Alimentation** :
- Si consommation équipements renseignée
- Calcul charge totale vs capacité PDU
- Alerte surcharge potentielle

#### 8.9 Règles de gestion baies

**Contraintes techniques** :
- Un équipement ne peut être monté que dans une seule baie à la fois
- Pas de chevauchement positions U
- Position U départ + Hauteur U ≤ Hauteur totale baie
- Numérotation U : conventionnellement de bas en haut (U1 = bas)

**Permissions** :
- Admin : Toutes actions baies
- Technicien : Consulter, monter/démonter équipements, réserver espace
- Manager : Consulter, exports
- Viewer : Consulter uniquement

---

### 9. INTÉGRATIONS EXTERNES

#### 9.1 Principe général : Hub anti-doublon

**Philosophie** :
- XCH ne remplace PAS NetBox, monitoring, ITSM
- XCH centralise le contexte et RÉFÉRENCE ces outils
- Intégrations optionnelles et activables à la demande
- Résilience : XCH fonctionne même si outil externe DOWN

#### 9.2 Mécanisme ExternalRef

**Concept** :
- Table générique de références externes
- Permet de lier objets XCH ↔ objets outils externes
- Extensible pour futurs connecteurs

**Structure** :
- Objet XCH (site, asset)
- Provider (netbox, uptime_kuma, fortimanager...)
- ID externe
- URL externe
- Métadonnées optionnelles
- Date dernière synchro

**Affichage** :
- Badges "Lié à NetBox", "Monitored" sur fiches
- Liens cliquables vers outil externe
- Indicateur sync récent/ancien

#### 9.3 NetBox (optionnel)

**Configuration** :
- OFF par défaut au niveau délégation
- Activable par chantier (override)

**Modes** :
- **Désactivé** : Aucune intégration
- **Manuel** : Liens seulement (pas d'API)
- **READ-ONLY** : Lecture API + enrichissement

**Fonctionnalités READ-ONLY** :
- Mapping chantier XCH ↔ site NetBox
- Affichage liste devices NetBox du site
- Mapping assisté asset XCH ↔ device NetBox (comparaison S/N)
- Enrichissement données (IP, rack, interfaces...)
- Bouton "Ouvrir dans NetBox"

**Pas de WRITE** (phase MVP) :
- XCH ne modifie pas NetBox
- Lecture seule pour éviter conflits
- Option WRITE chiffrable séparément ultérieurement

#### 9.4 Uptime Kuma ou équivalent (monitoring)

**Objectif** :
- Fournir "santé chantier" alimentant carte et dashboards
- Détecter services DOWN automatiquement

**Configuration** :
- URL Uptime Kuma
- API token
- Mapping monitors ↔ chantiers

**Fonctionnalités** :
- Récupération statut monitors via API
- Mise à jour automatique health_status chantiers
- Affichage état services sur fiche chantier
- Alertes si service DOWN

**Optionnel création automatique monitors** :
- Non exigé dans MVP
- Peut être ajouté si jugé pertinent

#### 9.5 Configuration intégrations

**Interface admin** :
- Page dédiée "Intégrations"
- Liste providers disponibles
- Toggle ON/OFF par provider
- Formulaire configuration (URL, token, options)
- Test connexion
- Logs dernières synchros

**Override par chantier** :
- Sur fiche chantier, section "Intégrations"
- Possibilité activer/désactiver pour CE chantier spécifiquement
- Override config si nécessaire (autre instance NetBox par ex)

---

### 10. UTILISATEURS & PERMISSIONS (RBAC)

#### 10.1 Rôles

**Admin** :
- Accès complet application
- CRUD chantiers, assets, plans, pins, tâches, baies
- Gestion utilisateurs
- Configuration intégrations
- Accès logs audit

**Manager** :
- Lecture complète
- Création/édition tâches
- Exports, rapports
- Validation (workflows futurs)
- Pas de suppression
- Pas de config système

**Technicien** :
- CRUD chantiers, assets (limité)
- CRUD tâches
- Upload plans, édition pins
- Gestion baies (montage/démontage équipements)
- Scan QR, ajout photos
- Pas de gestion users
- Pas de config intégrations

**Viewer** :
- Lecture seule complète
- Exports limités
- Pas de modification

#### 10.2 Permissions granulaires

**Par objet** :
- Sites : create, read, update, delete
- Assets : create, read, update, delete
- Plans : upload, view, edit_pins, delete
- Baies : create, read, update, delete, manage_equipment
- Tasks : create, read, update, delete, assign
- Users : create, read, update, delete, change_role

**Masquage conditionnel** :
- Sections sensibles cachées selon rôle
- Ex: config intégrations visible admin uniquement
- Ex: logs audit visible admin/manager

#### 10.3 Gestion utilisateurs

**Profil user** :
- Email (identifiant unique)
- Nom complet
- Téléphone
- Avatar (optionnel)
- Rôle
- Statut actif/inactif

**Actions admin** :
- Créer utilisateur (invitation email)
- Modifier rôle
- Réinitialiser mot de passe
- Désactiver compte (sans supprimer)
- Supprimer compte

**Self-service** :
- Éditer son profil
- Changer mot de passe
- Upload avatar

---

### 11. DASHBOARD & RAPPORTS

#### 11.1 Dashboard principal

**Vue d'ensemble** (page d'accueil) :
- **Indicateurs clés** :
  - Nombre chantiers actifs / prépa / clos
  - Nombre assets total
  - Nombre baies total et taux occupation moyen
  - Tâches ouvertes / en retard
  - Alertes actives
  
- **Carte résumé** :
  - Tous chantiers avec santé
  - Clustering
  - Filtres rapides

- **Timeline activité récente** :
  - Dernières modifications chantiers
  - Tâches créées/terminées
  - Alertes déclenchées
  - Interventions

- **Tâches assignées à moi** :
  - Mes tâches à faire
  - Mes tâches en cours
  - Échéances proches

#### 11.2 Rapports & exports

**Exports disponibles** :
- Liste chantiers (CSV, Excel)
- Inventaire assets complet (CSV, Excel)
- État des tâches (CSV)
- Rapport synthèse chantier (PDF)
- Schémas baies (PDF)

**Rapport synthèse chantier** :
- Identité chantier
- Contacts
- Inventaire équipements
- Plans (images)
- Baies (schémas)
- Tâches en cours
- Historique interventions
- Branded avec logo délégation

**Planification exports** :
- Exports manuels à la demande
- Pas de scheduling automatique (MVP)

---

### 12. RECHERCHE GLOBALE

#### 12.1 Fonctionnement

**Barre recherche omniprésente** :
- Accessible depuis toutes les pages (header)
- Raccourci clavier (Ctrl+K ou Cmd+K)
- Recherche as-you-type

**Résultats multicritères** :
- Chantiers (nom, code, ville, adresse)
- Assets (modèle, S/N, tag inventaire)
- Baies (nom, chantier)
- Tâches (titre, description)
- Contacts (nom, société)

**Affichage résultats** :
- Groupés par type
- Max 5 résultats par type
- Bouton "Voir tous les résultats [type]"
- Navigation clavier (flèches + Enter)

#### 12.2 Recherche avancée

**Filtres combinables** :
- Type objet
- Statut
- Date création/modification
- Assigné à
- Chantier spécifique

**Sauvegarde recherches** :
- Enregistrer filtres fréquents
- Accès rapide recherches sauvegardées

---

### 13. CONFIGURATION INSTANCE

#### 13.1 Informations générales

**Page "Paramètres"** (accès admin) :
- Nom de la délégation
- Logo (upload image)
- Couleur principale (color picker)
- Informations contact support interne

#### 13.2 Préférences utilisateur

**Personnalisation individuelle** :
- Langue interface (si multilingue ultérieurement)
- Format dates (EU / US)
- Notifications activées/désactivées
- Vue par défaut chantiers (liste/carte)

#### 13.3 Configuration système

**Paramètres techniques** (admin) :
- URL base application
- Stockage fichiers (local / S3)
- Rétention logs audit (durée)
- Quotas uploads (taille max, total storage)

---

### 14. LOGS & AUDIT TRAIL

#### 14.1 Journalisation

**Actions tracées** :
- Création/modification/suppression chantiers
- Création/modification/suppression assets
- Création/modification/suppression baies
- Montage/démontage équipements en baies
- Changements statuts
- Upload plans
- Édition pins
- Création/modification tâches
- Changements permissions utilisateurs

**Informations enregistrées** :
- Qui (utilisateur)
- Quoi (action + ressource)
- Quand (timestamp précis)
- Changements (avant/après si modification)
- Contexte (IP, user agent)

#### 14.2 Consultation logs

**Interface admin** :
- Page dédiée "Audit"
- Tableau événements récents
- Filtres :
  - Par utilisateur
  - Par type action
  - Par ressource
  - Par période
- Export logs (CSV)

**Recherche** :
- Recherche dans logs
- Ex: "Toutes modifications chantier X"
- Ex: "Toutes actions user Y"

---

### 15. MOBILE & PWA

#### 15.1 Progressive Web App

**Fonctionnalités PWA** :
- Installation sur écran d'accueil (smartphone/tablette)
- Mode offline (consultation cache)
- Notifications push
- Accès caméra (scan QR, photos)
- Géolocalisation

**Avantages** :
- Pas d'app store (iOS/Android)
- Mise à jour automatique
- Une seule codebase

#### 15.2 Optimisations mobile

**Interface** :
- Navigation bottom bar (au pouce)
- Actions swipe (glisser pour actions)
- Inputs adaptés mobile (big buttons, sélecteurs natifs)
- Chargement progressif (pas de gros tableaux)

**Performance** :
- Chargement lazy images
- Cache agressif
- Mode offline basique (consultation dernières données)

**Fonctionnalités prioritaires mobile** :
1. Scan QR
2. Consulter fiche asset
3. Consulter schéma baie
4. Mettre à jour statut/localisation
5. Ajouter photos
6. Créer/mettre à jour tâche
7. Voir plan avec pins

---

### 16. SÉCURITÉ & CONFORMITÉ

#### 16.1 Authentification

**Login** :
- Email + mot de passe
- Validation email obligatoire
- Réinitialisation mot de passe (lien email)

**Sessions** :
- Durée vie : 7 jours (configurable)
- Révocation possible (admin)
- Logout sur tous devices

**Future** (pas MVP) :
- SSO Microsoft 365
- 2FA (TOTP)
- Magic links

#### 16.2 Sécurité données

**Stockage** :
- Mots de passe hashés (bcrypt)
- Tokens secrets chiffrés
- Fichiers uploads scannés (antivirus si on-premise)

**Transport** :
- HTTPS obligatoire
- Certificats SSL/TLS

**Backup** :
- Backup quotidien base de données
- Backup fichiers (plans, photos)
- Rétention 30 jours minimum

#### 16.3 RGPD

**Données personnelles** :
- Utilisateurs : email, nom, téléphone
- Contacts chantiers : nom, téléphone
- Logs : IP addresses

**Droits utilisateurs** :
- Accès données personnelles
- Export données (portabilité)
- Suppression compte (droit à l'oubli)
- Pseudonymisation après suppression

---

### 17. BRANDING & WHITE-LABEL

#### 17.1 Personnalisation délégation

**Éléments brandés** :
- Logo (header application)
- Couleur principale (buttons, liens, accents)
- Nom affiché (dans interface et emails)

**Exports PDF brandés** :
- Étiquettes QR (logo + couleurs)
- Rapports chantiers (entête avec logo)
- Schémas baies (logo)
- Plans annotés (logo en filigrane discret)

#### 17.2 Thème interface

**Modes** :
- Clair (par défaut)
- Sombre (choix utilisateur)
- Automatique (selon préférence système)

---

### 18. MARKETPLACE INTÉGRATIONS (Future - Hors MVP)

#### 18.1 Concept

**Vision** :
- Catalogue connecteurs disponibles
- Installation en 1 clic
- Configuration guidée
- Gestion versions

**Types connecteurs** :
- Outils monitoring (Uptime Kuma, Zabbix, PRTG...)
- IPAM (NetBox, phpIPAM, Infoblox...)
- ITSM (ServiceNow, Jira Service Desk, Freshservice...)
- Réseau (FortiManager, Meraki Dashboard, Cisco DNA...)
- Autres (stockage, backup, téléphonie...)

#### 18.2 Développement connecteurs

**SDK pour développeurs** :
- API standardisée
- Documentation complète
- Templates code
- Sandbox test

**Publication** :
- Soumission connecteur
- Validation sécurité
- Publication marketplace
- Gestion versions/updates

**Monétisation** (optionnelle) :
- Connecteurs gratuits communauté
- Connecteurs premium payants
- Revenue share développeurs

---

## 🎯 CRITÈRES DE SUCCÈS MVP

### Fonctionnels

✅ Un RSI peut gérer 30 chantiers avec toutes les infos centralisées
✅ Un admin IT peut inventorier 150 équipements en 2h
✅ Un admin IT peut gérer 10 baies avec 50 équipements montés
✅ Un tech peut scanner un QR et accéder à la fiche en <2 secondes
✅ Un manager peut exporter un rapport chantier complet en 1 clic
✅ Les plans avec pins permettent de localiser n'importe quel équipement en <30 secondes
✅ Les schémas de baies permettent de visualiser l'occupation instantanément
✅ Les tâches permettent de suivre 100 interventions sans confusion
✅ La carte donne une vue santé instantanée de tous les chantiers

### Techniques

✅ Application responsive desktop + mobile
✅ PWA installable sur smartphones
✅ Performances acceptables (temps chargement <3s, actions <1s)
✅ Stabilité (pas de crash sur usage normal)
✅ Sécurité de base (auth, HTTPS, permissions)

### Adoption

✅ Le RSI pilote utilise XCH quotidiennement après 1 mois
✅ Les techs préfèrent XCH aux fichiers Excel
✅ Réduction temps recherche info : -50% minimum
✅ Zéro régression dans workflows existants

---

## 🚫 HORS SCOPE MVP

Ces fonctionnalités sont explicitement EXCLUES du MVP :

❌ Multi-tenant / Multi-délégation (architecture prévue mais pas activée)
❌ Group Console (vue consolidée multi-délégations)
❌ Hiérarchie organisationnelle (units, sous-units)
❌ Intégration écriture NetBox (READ-ONLY uniquement)
❌ Création automatique tickets ITSM via API
❌ Provisioning automatique FortiManager
❌ CMDB complet (interfaces détaillées, IPAM complet, racks détaillés)
❌ Workflows avancés (validations multi-niveaux, automations)
❌ SSO / 2FA (auth simple email/password)
❌ API publique documentée (API existe mais pas exposée)
❌ Marketplace intégrations
❌ Mobile apps natives (iOS/Android)
❌ Mode offline complet (cache basique seulement)
❌ Planification automatique interventions
❌ Gestion stocks pièces détachées
❌ Suivi budgets/coûts chantiers
❌ Analytics avancées / BI
❌ Multilingue (français uniquement MVP)

---

## 📝 NOTES IMPORTANTES POUR DÉVELOPPEMENT

### Philosophie produit

1. **Mobile-first** : Toutes les fonctionnalités doivent être pensées pour usage mobile terrain
2. **Résilience** : L'app doit fonctionner même si intégrations externes sont DOWN
3. **Simplicité** : 3 clics max pour accéder à n'importe quelle info
4. **Performance** : Privilégier vitesse à exhaustivité (pagination, lazy loading)
5. **Évolutivité** : Architecture permettant multi-tenant ultérieurement sans refonte

### Contraintes techniques à respecter

- **QR codes sécurisés** : Token non-devinable, auth obligatoire
- **Isolation données** : Même si mono-tenant, architecture tenant_id partout pour future évolution
- **Plans** : Coordonnées normalisées (indépendantes résolution) pour pins
- **Baies** : Positions U normalisées, gestion chevauchements
- **Serial numbers** : Obligatoires pour catégories critiques (imprimantes, iPads, réseau core)
- **Audit** : Toute modification tracée (qui, quoi, quand)

### Points d'attention UX

- **Recherche instantanée** : Résultats en <500ms
- **Feedback visuel** : Loading states, confirmations actions destructives
- **Erreurs claires** : Messages d'erreur compréhensibles, actions de récupération
- **Shortcuts clavier** : Power users doivent pouvoir naviguer au clavier
- **Responsive images** : Compression automatique uploads, formats optimisés
- **Schémas interactifs** : Baies et plans doivent être zoomables/navigables facilement
