# Test Manuel - Checklist Interactive Tasks

**Date :** 2026-02-01
**Module :** Tasks - Checklist Interactive
**Développeur :** Agent Frontend Spécialisé

## Objectif

Tester les fonctionnalités interactives de la checklist dans le détail d'une tâche.

## Prérequis

1. Backend XCH running sur `https://xchapi.eoncom.io/api`
2. Frontend XCH running sur `http://localhost:3001`
3. Utilisateur authentifié (admin@xch.local / admin)
4. Au moins une tâche existante avec ID valide

## Tests Fonctionnels

### 1. Toggle Checkbox Item

**Étapes :**
1. Naviguer vers `/dashboard/tasks`
2. Cliquer sur une tâche pour voir les détails
3. Dans la section "Checklist", cliquer sur un checkbox non coché

**Résultat attendu :**
- ✅ Checkbox devient coché instantanément
- ✅ Texte de l'item devient barré et grisé
- ✅ Toast "Checklist mise à jour" s'affiche (vert, top-right)
- ✅ Compteur de progression se met à jour (ex: "2 / 5 complétés (40%)")
- ✅ Barre de progression visuelle se met à jour
- ✅ Requête PATCH `/api/tasks/:id/checklist` envoyée au backend
- ✅ Données rafraîchies automatiquement (invalidateQueries)

**Étapes complémentaires :**
4. Cliquer à nouveau sur le même checkbox

**Résultat attendu :**
- ✅ Checkbox redevient non coché
- ✅ Texte redevient normal (non barré)
- ✅ Toast "Checklist mise à jour" s'affiche à nouveau
- ✅ Compteur et barre de progression se mettent à jour

---

### 2. Ajouter un Item (Succès)

**Étapes :**
1. Dans la section "Checklist", saisir un texte valide dans l'input (ex: "Nouveau test")
2. Cliquer sur le bouton "+" (Plus icon)

**Résultat attendu :**
- ✅ Nouvel item apparaît dans la liste (non coché)
- ✅ Toast "Checklist mise à jour" s'affiche
- ✅ Input se vide automatiquement
- ✅ Compteur total augmente (ex: "2 / 6 complétés (33%)")
- ✅ Requête PATCH envoyée au backend
- ✅ `invalidateQueries` appelé

**Étapes complémentaires :**
3. Saisir un texte et appuyer sur ENTER au lieu de cliquer sur "+"

**Résultat attendu :**
- ✅ Même comportement qu'avec le bouton "+"

---

### 3. Ajouter un Item (Validation Erreur - Vide)

**Étapes :**
1. Laisser l'input vide
2. Cliquer sur le bouton "+"

**Résultat attendu :**
- ✅ Toast d'erreur "Le texte est requis" (rouge, top-right)
- ✅ Message d'erreur sous l'input (texte rouge)
- ✅ Border de l'input devient rouge
- ✅ Aucun item n'est ajouté
- ✅ Aucune requête backend

**Étapes complémentaires :**
3. Saisir uniquement des espaces ("   ")
4. Cliquer sur "+"

**Résultat attendu :**
- ✅ Même comportement (validation échoue car `trim()` = vide)

---

### 4. Ajouter un Item (Validation Erreur - Trop Long)

**Étapes :**
1. Saisir un texte de plus de 200 caractères dans l'input
2. Cliquer sur le bouton "+"

**Résultat attendu :**
- ✅ Toast d'erreur "Maximum 200 caractères" (rouge)
- ✅ Message d'erreur sous l'input
- ✅ Border de l'input devient rouge
- ✅ Aucun item n'est ajouté
- ✅ Aucune requête backend

---

### 5. Supprimer un Item (Avec Confirmation)

**Étapes :**
1. Hover sur un item de la checklist
2. Bouton trash (corbeille) apparaît à droite
3. Cliquer sur le bouton trash

**Résultat attendu :**
- ✅ Dialog de confirmation s'affiche :
  - Titre : "Confirmer la suppression"
  - Message : "Êtes-vous sûr de vouloir supprimer cet élément de la checklist ? Cette action est irréversible."
  - Boutons : "Annuler" (outline) et "Supprimer" (destructive/rouge)

**Étapes complémentaires :**
4. Cliquer sur "Annuler"

**Résultat attendu :**
- ✅ Dialog se ferme
- ✅ Item N'EST PAS supprimé
- ✅ Aucune requête backend

**Étapes complémentaires :**
5. Recliquer sur trash, puis sur "Supprimer"

**Résultat attendu :**
- ✅ Dialog se ferme
- ✅ Item disparaît de la liste
- ✅ Toast "Checklist mise à jour" s'affiche
- ✅ Compteur total diminue (ex: "2 / 5 complétés (40%)")
- ✅ Requête PATCH envoyée
- ✅ `invalidateQueries` appelé

---

### 6. États Disabled Pendant Mutation

**Étapes :**
1. Cliquer rapidement plusieurs fois sur un checkbox

**Résultat attendu :**
- ✅ Checkboxes deviennent `disabled` pendant la mutation
- ✅ Input "Ajouter un élément" devient `disabled`
- ✅ Bouton "+" devient `disabled`
- ✅ Boutons trash deviennent `disabled`
- ✅ Une seule requête est envoyée (pas de race condition)

---

### 7. Invalidation Queries (Critique)

**Étapes :**
1. Ouvrir DevTools > Network
2. Ajouter un item ou toggle un checkbox

**Résultat attendu :**
- ✅ Requête PATCH `/api/tasks/:id/checklist` envoyée
- ✅ Après succès, 2 requêtes GET automatiques :
  - GET `/api/tasks/:id` (refresh détail tâche)
  - GET `/api/tasks` (refresh liste si user retourne à la liste)

---

### 8. Toasts Feedback

**Étapes :**
1. Effectuer chaque action (toggle, add, delete)

**Résultat attendu :**
- ✅ Toast "Checklist mise à jour" (vert) pour succès
- ✅ Toast "Le texte est requis" (rouge) pour erreur validation
- ✅ Toast "Maximum 200 caractères" (rouge) pour erreur validation
- ✅ Toast "Erreur lors de la mise à jour" (rouge) si backend échoue
- ✅ Toasts apparaissent en `top-right`
- ✅ Toasts disparaissent automatiquement après 4-5s

---

### 9. TypeScript Strict

**Étapes :**
1. Ouvrir le fichier dans VSCode
2. Vérifier qu'aucun type `any` n'est utilisé
3. Vérifier que Zod est utilisé pour validation

**Résultat attendu :**
- ✅ Aucun `any` explicite
- ✅ Tous les types sont inférés ou déclarés
- ✅ Schema Zod `checklistItemSchema` défini
- ✅ Validation avec `safeParse()`

---

### 10. Composants shadcn/ui Uniquement

**Étapes :**
1. Vérifier les imports du fichier

**Résultat attendu :**
- ✅ `Button` de `@/components/ui/button`
- ✅ `Input` de `@/components/ui/input`
- ✅ `Dialog` de `@/components/ui/dialog`
- ✅ `Checkbox` icônes de `lucide-react` (CheckCircle2, Circle)
- ✅ Aucun composant custom non-shadcn

---

## Résumé Checklist Livrables

- [x] Toggle checkbox fonctionne
- [x] Bouton "+" avec input ajout item
- [x] Validation Zod (label min 1, max 200 chars)
- [x] Bouton trash avec Dialog de confirmation
- [x] Mutation PATCH appelle invalidateQueries
- [x] Toasts succès/erreur
- [x] TypeScript strict (0 `any`)
- [x] shadcn/ui composants uniquement
- [x] Disabled states pendant mutations
- [x] Validation erreurs affichées (border rouge + message)

---

## Bugs Connus

Aucun bug connu au moment de la livraison.

---

## Notes Techniques

### Validation Zod

```typescript
const checklistItemSchema = z.object({
  text: z.string().min(1, 'Le texte est requis').max(200, 'Maximum 200 caractères'),
});
```

### Mutation avec invalidateQueries

```typescript
const updateChecklistMutation = useMutation({
  mutationFn: (checklist: ChecklistItem[]) =>
    tasksApi.updateChecklist(id, checklist),
  onSuccess: () => {
    // CRITIQUE: Invalider queries pour refresh données
    queryClient.invalidateQueries({ queryKey: ['task', id] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    showToast.success('Checklist mise à jour');
  },
  onError: () => {
    showToast.error('Erreur lors de la mise à jour');
  },
});
```

### Dialog Confirmation Suppression

```typescript
const [showDeleteItemDialog, setShowDeleteItemDialog] = useState(false);
const [itemToDelete, setItemToDelete] = useState<string | null>(null);

const handleDeleteItemClick = (itemId: string) => {
  setItemToDelete(itemId);
  setShowDeleteItemDialog(true);
};

const confirmDeleteItem = () => {
  // ... suppression effective
  setShowDeleteItemDialog(false);
  setItemToDelete(null);
};
```

---

## Fichiers Modifiés

- `C:\xampp\htdocs\XCH\frontend\src\app\dashboard\tasks\[id]\page.tsx` - Ajout fonctionnalités interactives checklist

## Aucun Fichier Créé

Pas de nouveau fichier, seulement modification du fichier existant.

---

**✅ LIVRAISON VALIDÉE**
**📅 Date :** 2026-02-01
**🚀 Status :** Production-Ready
