# Refactoring: Providers → Contacts

**Date**: 2026-02-03
**Statut**: 💡 **Idée / Proposition**
**Priorité**: Post-MVP (v1.1+)

---

## Contexte

Actuellement, le module `Providers` est limité aux **fournisseurs** (opérateurs télécom, hébergement, cloud, etc.). Cependant, dans un contexte chantier IT, on a besoin de gérer plusieurs types de **contacts**:

1. **Fournisseurs** (actuellement couvert)
   - Opérateurs télécom (Orange, SFR, Bouygues...)
   - Fournisseurs cloud (AWS, Azure, OVH...)
   - Fournisseurs énergie, maintenance, etc.

2. **Contacts chantier internes** (NON couvert)
   - Contacts sur site (responsable chantier, gardien, accueil...)
   - Multiples contacts par chantier (N contacts)

3. **Partenaires IT externes** (NON couvert)
   - Intégrateurs tiers présents sur le chantier
   - Sous-traitants techniques
   - Prestataires temporaires

4. **Contacts d'urgence** (NON couvert)
   - Contacts techniques NetBox
   - Contacts support applications tierces
   - Contacts GED (Gestion Électronique de Documents)

---

## Problématique

Le modèle actuel `Provider` est trop **spécifique** et ne permet pas de gérer tous ces cas d'usage.

**Conséquence**: Les contacts chantier, partenaires IT et contacts techniques doivent être saisis dans des champs texte simples au lieu d'être structurés et réutilisables.

---

## Proposition: Renommage `Providers` → `Contacts`

### Objectif

Créer un module **générique** `Contacts` pour gérer **tous types de contacts** liés à l'écosystème IT chantier.

### Avantages

1. **Réutilisabilité**: Un contact peut être référencé depuis:
   - Sites (contacts chantier internes)
   - Providers/Fournisseurs (contacts commerciaux, support)
   - Intégrations NetBox (contacts techniques)
   - Applications tierces (contacts GED, monitoring, etc.)

2. **Cohérence**: Modèle unifié pour tous les types de contacts

3. **Évolutivité**: Facilite l'ajout de nouveaux types de contacts

4. **Compatibilité NetBox**: NetBox utilise déjà un modèle `Contact` générique

---

## Conception Proposée

### Modèle `Contact` (vs actuel `Provider`)

```typescript
interface Contact {
  id: string;
  tenantId: string;

  // Identité
  name: string;                    // Nom personne OU entreprise
  type: ContactType;               // Type de contact (voir ci-dessous)
  category?: ContactCategory;      // Catégorie (fournisseur, partenaire, interne...)

  // Coordonnées
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;

  // Contexte
  company?: string;                // Entreprise (si contact personne)
  role?: string;                   // Rôle/Fonction
  department?: string;             // Service/Département

  // Relations
  siteIds?: string[];              // Sites associés (contacts chantier)
  providerType?: ProviderType;     // Type fournisseur (si category=PROVIDER)

  // Méta
  notes?: string;
  tags?: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Enum `ContactCategory`

```typescript
enum ContactCategory {
  PROVIDER = 'PROVIDER',          // Fournisseur
  INTERNAL = 'INTERNAL',          // Contact interne (sur site)
  PARTNER = 'PARTNER',            // Partenaire IT externe
  EMERGENCY = 'EMERGENCY',        // Contact d'urgence
  TECHNICAL = 'TECHNICAL',        // Contact technique (NetBox, apps...)
  OTHER = 'OTHER'
}
```

### Enum `ContactType` (exemples)

```typescript
enum ContactType {
  // Personnes
  PERSON = 'PERSON',

  // Entreprises
  COMPANY = 'COMPANY',

  // Départements
  DEPARTMENT = 'DEPARTMENT',

  // Automatisé
  API_SERVICE = 'API_SERVICE',    // Contact technique API (NetBox, monitoring...)
}
```

---

## Migration `Provider` → `Contact`

### Étapes

1. **Backend**:
   - Créer module `contacts` (copie de `providers`)
   - Ajouter champs: `category`, `email`, `phone`, `mobile`, `company`, `role`, `department`, `siteIds`, `tags`, `active`
   - Migrer table `providers` → `contacts` (ajouter colonne `category='PROVIDER'`)
   - Ajouter colonne `providerType` (renommage de `type`)
   - Créer endpoint migration: `POST /api/admin/migrate-providers-to-contacts`

2. **Frontend**:
   - Renommer routes `/dashboard/providers` → `/dashboard/contacts`
   - Renommer composants `ProvidersXXX` → `ContactsXXX`
   - Ajouter filtre par `category` dans liste contacts
   - Formulaire création: sélection `category` + champs conditionnels

3. **Database**:
   ```sql
   -- Renommer table
   ALTER TABLE providers RENAME TO contacts;

   -- Ajouter nouvelles colonnes
   ALTER TABLE contacts ADD COLUMN category VARCHAR(20) DEFAULT 'PROVIDER';
   ALTER TABLE contacts ADD COLUMN email VARCHAR(255);
   ALTER TABLE contacts ADD COLUMN phone VARCHAR(50);
   ALTER TABLE contacts ADD COLUMN mobile VARCHAR(50);
   ALTER TABLE contacts ADD COLUMN company VARCHAR(200);
   ALTER TABLE contacts ADD COLUMN role VARCHAR(100);
   ALTER TABLE contacts ADD COLUMN department VARCHAR(100);
   ALTER TABLE contacts ADD COLUMN tags TEXT[];
   ALTER TABLE contacts ADD COLUMN active BOOLEAN DEFAULT true;

   -- Renommer colonne type
   ALTER TABLE contacts RENAME COLUMN type TO providerType;
   ```

4. **Rétro-compatibilité**:
   - Alias API: `/api/providers` → `/api/contacts?category=PROVIDER`
   - Documentation migration pour utilisateurs existants

---

## Cas d'Usage Améliorés

### 1. Contacts Chantier (N contacts par site)

**Avant** (actuel):
```typescript
site.contacts = [
  { name: 'Jean Dupont', email: 'jean@site.fr', phone: '06...' }
] // Tableau JSON simple, non réutilisable
```

**Après** (avec Contacts):
```typescript
// Créer contacts réutilisables
const contact1 = await contactsApi.create({
  name: 'Jean Dupont',
  type: 'PERSON',
  category: 'INTERNAL',
  email: 'jean@site.fr',
  phone: '0612345678',
  role: 'Responsable Chantier',
  siteIds: [site.id]
});

const contact2 = await contactsApi.create({
  name: 'Marie Martin',
  type: 'PERSON',
  category: 'INTERNAL',
  email: 'marie@gardiennage.fr',
  phone: '0698765432',
  company: 'SecuriSite',
  role: 'Gardien',
  siteIds: [site.id]
});

// Lier au site
site.contactIds = [contact1.id, contact2.id];
```

**Avantages**:
- Contacts réutilisables sur plusieurs sites
- Recherche globale de contacts
- Historique des contacts par chantier

---

### 2. Intégration NetBox (Mapping Contacts)

**Scénario**: Importer contacts NetBox vers XCH

**NetBox API** → **XCH Contacts**:
```typescript
// Récupérer contacts depuis NetBox
const netboxContacts = await netboxApi.get('/api/tenancy/contacts/');

// Mapper vers XCH
for (const nc of netboxContacts.results) {
  await contactsApi.create({
    name: nc.name,
    type: 'PERSON',
    category: 'TECHNICAL',
    email: nc.email,
    phone: nc.phone,
    company: nc.group?.name,
    role: nc.title,
    notes: `Importé NetBox ID: ${nc.id}`,
    tags: nc.tags.map(t => t.name),
    active: nc.active,
  });
}
```

**Mapping automatique**:
```typescript
interface NetBoxContactMapping {
  netboxId: number;
  xchContactId: string;
  syncedAt: Date;
}
```

---

### 3. Contacts Fournisseurs (Rétro-compatible)

**Avant** (actuel `Provider`):
```typescript
const provider = {
  name: 'Orange Business Services',
  type: 'TELECOM',
  contact: 'Service Client: 3900 | contact@orange.fr',
  notes: 'Opérateur principal'
};
```

**Après** (avec `Contact`):
```typescript
const provider = {
  name: 'Orange Business Services',
  type: 'COMPANY',
  category: 'PROVIDER',
  providerType: 'TELECOM',
  email: 'contact@orange.fr',
  phone: '3900',
  role: 'Service Client',
  notes: 'Opérateur principal',
  tags: ['telecom', 'principal'],
  active: true
};
```

---

## Interface Graphique Mapping NetBox

**💡 Idée Future** (v1.2+)

Créer une page `/dashboard/integrations/netbox/mapping` pour mapper visuellement les champs NetBox ↔ XCH.

### Mockup Concept

```
┌─────────────────────────────────────────────────────────────┐
│  🔗 Mapping NetBox → XCH                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Entité: [Contacts ▼]                                        │
│                                                               │
│  ┌─────────────────────┐       ┌───────────────────────┐    │
│  │ NetBox             │       │ XCH                   │    │
│  ├─────────────────────┤       ├───────────────────────┤    │
│  │ ☑ name             │ ───→  │ name                  │    │
│  │ ☑ email            │ ───→  │ email                 │    │
│  │ ☑ phone            │ ───→  │ phone                 │    │
│  │ ☑ title            │ ───→  │ role                  │    │
│  │ ☑ group.name       │ ───→  │ company               │    │
│  │ ☑ tags             │ ───→  │ tags                  │    │
│  │ ☑ comments         │ ───→  │ notes                 │    │
│  │ ☐ address          │ ─ ─→  │ address               │    │
│  │ ☐ custom_fields    │       │ -                     │    │
│  └─────────────────────┘       └───────────────────────┘    │
│                                                               │
│  Transformation personnalisée:                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ category = "TECHNICAL"                                │   │
│  │ type = "PERSON"                                      │   │
│  │ active = netbox.status === "active"                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Mode synchronisation:                                        │
│  ○ Lecture seule (Read-Only)    ● Import manuel              │
│  ○ Synchronisation automatique (toutes les X heures)         │
│                                                               │
│  [Tester Mapping]  [Sauvegarder Configuration]               │
└─────────────────────────────────────────────────────────────┘
```

### Fonctionnalités UI Mapping

1. **Sélection Entité**: Choisir entité à mapper (Sites, Devices, Contacts, Racks...)
2. **Glisser-Déposer**: Drag & drop champs NetBox vers XCH
3. **Transformation**: Ajouter scripts transformation (ex: `status === "active"` → `active: true`)
4. **Prévisualisation**: Voir échantillon données avant import
5. **Mode Sync**:
   - Read-Only: XCH lit depuis NetBox, jamais d'écriture
   - Import manuel: Bouton "Importer maintenant"
   - Sync auto: Cron toutes les X heures
6. **Historique**: Log des imports (date, nb records, erreurs)
7. **Sauvegarde Config**: Enregistrer mapping dans DB pour réutilisation

---

## Estimation Effort

| Tâche                                      | Effort | Priorité |
|--------------------------------------------|--------|----------|
| Backend: Créer module `contacts`           | 2-3j   | P1       |
| Backend: Migration DB `providers→contacts` | 1j     | P1       |
| Frontend: Renommer routes/composants       | 2j     | P1       |
| Frontend: Formulaires multi-catégories     | 1-2j   | P1       |
| Tests E2E migration                        | 1j     | P1       |
| Documentation utilisateur                  | 0.5j   | P1       |
| **UI Mapping NetBox graphique**            | **5-7j** | **P2 (v1.2+)** |

**Total MVP Refactoring**: ~7-9 jours
**Total avec UI Mapping**: ~12-16 jours

---

## Décision

**Statut**: 💭 **En discussion**

**Avantages**:
- ✅ Modèle générique et évolutif
- ✅ Réutilisabilité des contacts
- ✅ Préparation NetBox mapping
- ✅ Cohérence avec standards (NetBox utilise `Contact`)

**Inconvénients**:
- ⚠️ Refactoring significatif (7-9j)
- ⚠️ Migration données utilisateurs existants
- ⚠️ Breaking change API (nécessite alias rétro-compatibilité)

**Recommandation**: Planifier pour **v1.1** (post-MVP) avec migration progressive.

---

## Références

- [NetBox Contacts Model](https://docs.netbox.dev/en/stable/models/tenancy/contact/)
- [NetBox Contact Groups](https://docs.netbox.dev/en/stable/models/tenancy/contactgroup/)
- [Discussion GitHub: Contacts vs Providers](./PROVIDERS_TO_CONTACTS_REFACTORING.md)
