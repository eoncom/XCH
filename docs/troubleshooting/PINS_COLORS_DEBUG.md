# Diagnostic - Couleurs des Pins

**Dernière mise à jour :** 2026-02-03

## Problème

Les pins sur les floor plans n'affichent pas de couleurs (apparaissent gris au lieu de couleurs par type).

## Causes Possibles

### 1. Données en Base de Données

**Hypothèse :** Les pins existants ont `pinType` à `NULL` ou une valeur invalide.

**Vérification :**
```bash
# Se connecter au serveur
ssh user@192.168.0.13

# Se connecter à PostgreSQL
docker exec -it xch-postgres psql -U xch_user -d xch_dev

# Exécuter le script de diagnostic
\i /path/to/scripts/check-pins-data.sql
```

**Solution si pinType est NULL :**
```sql
-- Mettre à jour les pins avec pinType NULL vers OTHER
UPDATE "Pin"
SET "pinType" = 'OTHER'
WHERE "pinType" IS NULL;
```

### 2. API ne Renvoie pas pinType

**Hypothèse :** L'API backend ne renvoie pas le champ `pinType` dans la réponse.

**Vérification :**
```bash
# Tester l'API localement
bash scripts/test-pins-api.sh https://xchapi.eoncom.io admin@xch.demo admin123

# Ou avec curl directement
TOKEN="your_access_token"
curl -X GET "https://xchapi.eoncom.io/api/floor-plans/{id}" \
  -H "Authorization: Bearer $TOKEN" | jq '.pins'
```

**Exemple de réponse attendue :**
```json
{
  "id": "clxxx...",
  "pins": [
    {
      "id": "pin-1",
      "x": 0.5,
      "y": 0.3,
      "pinType": "SWITCH",     // ✅ Ce champ doit être présent
      "label": "SW-01",
      "asset": { ... }
    }
  ]
}
```

**Solution si pinType manque :**
- Vérifier que le backend renvoie bien `pinType` dans les includes
- Vérifier la version du backend déployée (doit être >= 1.0.0)

### 3. Frontend ne Reçoit pas les Données

**Hypothèse :** Le composant FloorPlanViewer ne reçoit pas correctement les pins.

**Vérification :**
```javascript
// Ouvrir la console navigateur (F12)
// Ajouter un console.log dans FloorPlanViewer.tsx ligne 225

console.log('Pins received:', pins);
pins.forEach(pin => {
  console.log(`Pin ${pin.id}: pinType=${pin.pinType}, type=${pin.type}`);
});
```

**Résultat attendu :**
```
Pins received: (3) [{...}, {...}, {...}]
Pin xxx: pinType=SWITCH, type=undefined
Pin yyy: pinType=FIREWALL, type=undefined
Pin zzz: pinType=ACCESS_POINT, type=undefined
```

### 4. Cache Navigateur

**Hypothèse :** Le navigateur utilise une version en cache du frontend.

**Vérification :**
1. Ouvrir DevTools (F12)
2. Onglet Network
3. Cocher "Disable cache"
4. Recharger la page (Ctrl+Shift+R)

**Solution :**
```bash
# Forcer un rebuild complet du frontend sans cache
cd frontend
rm -rf .next/
npm run build

# Redéployer sur le serveur
ssh user@192.168.0.13
cd /var/www/xch
git pull
docker-compose down frontend
docker-compose up -d --build frontend
```

### 5. Types TypeScript Incorrects

**Hypothèse :** Le type `Pin` dans le frontend ne correspond pas à la réponse API.

**Vérification :**
```typescript
// frontend/src/types/index.ts
export interface Pin {
  id: string;
  x: number;
  y: number;
  pinType: PinType;  // ✅ Doit utiliser pinType, pas type
  label?: string;
  description?: string;
  // ...
}
```

**Solution si le type utilise `type` au lieu de `pinType` :**
```bash
# Vérifier le fichier de types
grep -n "type.*PinType" frontend/src/types/index.ts

# Si nécessaire, corriger pour utiliser pinType
```

## Codes de Couleur Attendus

```typescript
const PIN_COLORS = {
  SWITCH: '#3b82f6',       // bleu
  FIREWALL: '#ef4444',     // rouge
  ACCESS_POINT: '#10b981', // vert
  PRINTER: '#6366f1',      // indigo
  RACK: '#8b5cf6',         // violet
  CAMERA: '#f59e0b',       // orange
  PATCH_PANEL: '#06b6d4',  // cyan
  RJ45: '#14b8a6',         // teal
  NRO: '#a855f7',          // violet clair
  OTHER: '#6b7280',        // gris
};
```

## Fallback Implémenté

Le frontend utilise maintenant un fallback pour supporter à la fois `pinType` (nouveau) et `type` (ancien) :

```typescript
// FloorPlanViewer.tsx ligne 108
fill={PIN_COLORS[pin.pinType || (pin as any).type] || PIN_COLORS.OTHER}

// page.tsx ligne 494 (tooltip)
{pinTypeLabels[selectedPin.pinType || (selectedPin as any).type] || 'Inconnu'}
```

## Étapes de Diagnostic Recommandées

1. **Vérifier les données en base**
   ```bash
   bash scripts/check-pins-data.sql
   ```

2. **Tester l'API**
   ```bash
   bash scripts/test-pins-api.sh
   ```

3. **Vider le cache navigateur**
   - Ctrl+Shift+R (hard reload)
   - Ou DevTools > Network > Disable cache

4. **Vérifier la console navigateur**
   - F12 > Console
   - Chercher des erreurs ou warnings
   - Vérifier les données reçues dans Network > XHR

5. **Créer un nouveau pin de test**
   - Ouvrir un floor plan
   - Cliquer sur le plan pour créer un nouveau pin
   - Sélectionner un type (ex: SWITCH)
   - Vérifier si ce nouveau pin affiche bien la couleur bleue

## Si le Problème Persiste

**Créer un nouveau floor plan avec un nouveau pin :**

1. Créer un nouveau site de test
2. Uploader un floor plan de test
3. Créer un pin avec type SWITCH
4. Vérifier si ce pin affiche la couleur bleue

Si le **nouveau** pin a la couleur correcte, alors le problème vient des anciennes données.

**Solution :** Recréer les pins existants avec les bons types.

## Logs Backend à Vérifier

```bash
# Vérifier les logs backend pour les requêtes /api/floor-plans
ssh user@192.168.0.13
docker logs xch-backend -f --tail=100 | grep "floor-plans"
```

## Commit de Correction

Le fallback a été ajouté dans le commit `2dbfe0c` :
```
fix: Fallback pin.type si pin.pinType undefined
```

**Fichiers modifiés :**
- `frontend/src/components/floor-plans/FloorPlanViewer.tsx` (ligne 108)
- `frontend/src/app/dashboard/floor-plans\[id]\page.tsx` (ligne 494)

## Contact Support

Si le problème persiste après toutes ces vérifications, contacter l'équipe technique avec :

1. Capture d'écran du floor plan (pins gris)
2. Résultat de `bash scripts/test-pins-api.sh`
3. Résultat de `bash scripts/check-pins-data.sql`
4. Logs console navigateur (F12)
5. Version du frontend déployée (git log -1)
6. Version du backend déployée (git log -1)

---

**🔙 [Retour index](../00-INDEX.md)**
