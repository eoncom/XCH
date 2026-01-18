# Configuration des icônes PWA

**Date:** 2026-01-18
**Statut:** En attente icônes design

## Problème

Les icônes PWA sont manquantes, causant des erreurs 404:
```
GET https://xch.eoncom.io/icon-192.png 404 (Not Found)
GET https://xch.eoncom.io/icon-512.png 404 (Not Found)
```

**Impact:** Mineur - PWA fonctionne, mais avertissements console et pas d'icône pour "Ajouter à l'écran d'accueil".

## Solution 1: Génération automatique depuis SVG

### Prérequis
- ImageMagick installé
- Fichier `frontend/public/icon.svg` existant

### Étapes

1. **Installer ImageMagick:**
```bash
# Ubuntu/Debian
sudo apt install imagemagick

# macOS
brew install imagemagick

# Windows
choco install imagemagick
```

2. **Créer ou placer icon.svg:**
```bash
cd frontend/public
# Créer un SVG simple ou utiliser un logo existant
```

Exemple SVG (512x512):
```svg
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#3b82f6"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="white" text-anchor="middle">XCH</text>
</svg>
```

3. **Générer les icônes:**
```bash
cd frontend
bash scripts/generate-pwa-icons.sh
```

Ou manuellement:
```bash
cd frontend/public

# Icon 192x192 (requis PWA)
convert icon.svg -resize 192x192 icon-192.png

# Icon 512x512 (requis PWA)
convert icon.svg -resize 512x512 icon-512.png

# Favicon (optionnel)
convert icon.svg -resize 32x32 favicon.ico

# Apple Touch Icon (optionnel)
convert icon.svg -resize 180x180 apple-touch-icon.png
```

4. **Déployer:**
```bash
# Frontend local
npm run build

# Production
cd frontend
tar -czf /tmp/frontend-public.tar.gz public/icon*.png public/favicon.ico
scp /tmp/frontend-public.tar.gz xch-deploy:/tmp/
ssh xch-deploy "
  docker cp /tmp/frontend-public.tar.gz xch-frontend:/tmp/ &&
  docker exec xch-frontend sh -c 'cd /app && tar -xzf /tmp/frontend-public.tar.gz' &&
  docker restart xch-frontend
"
```

## Solution 2: Création manuelle

### Sans ImageMagick

1. **Créer les images dans un éditeur:**
   - Photoshop, GIMP, Figma, Canva, etc.
   - Dimensions: 192x192px et 512x512px
   - Format: PNG avec fond opaque
   - Contenu: Logo XCH ou texte "XCH" sur fond bleu (#3b82f6)

2. **Enregistrer dans `frontend/public/`:**
   ```
   frontend/public/
   ├── icon-192.png
   ├── icon-512.png
   ├── favicon.ico (optionnel)
   └── apple-touch-icon.png (optionnel)
   ```

3. **Déployer (voir Solution 1, étape 4)**

## Solution 3: Utiliser un service en ligne

### Services gratuits

- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)
- [PWA Builder](https://www.pwabuilder.com/imageGenerator)

### Étapes
1. Upload logo/texte
2. Télécharger package d'icônes
3. Extraire dans `frontend/public/`
4. Déployer

## Solution 4: Placeholder temporaire (Canvas HTML)

Pour tester rapidement sans outils:

1. **Créer `frontend/public/generate-icon.html`:**
```html
<!DOCTYPE html>
<html>
<body>
  <h1>XCH Icon Generator</h1>
  <button onclick="generate(192)">Generate 192x192</button>
  <button onclick="generate(512)">Generate 512x512</button>
  <br><br>
  <canvas id="c"></canvas>

  <script>
  function generate(size) {
    const c = document.getElementById('c');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Background
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, size, size);

    // Text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('XCH', size/2, size/2);

    // Download
    c.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `icon-${size}.png`;
      a.click();
    });
  }
  </script>
</body>
</html>
```

2. **Ouvrir dans navigateur:**
```bash
# Ouvrir frontend/public/generate-icon.html
# Cliquer sur les boutons pour télécharger les icônes
```

3. **Placer les fichiers téléchargés dans `frontend/public/`**

4. **Déployer**

## Vérification

Après déploiement, vérifier:

1. **URLs accessibles:**
   - https://xch.eoncom.io/icon-192.png ✅
   - https://xch.eoncom.io/icon-512.png ✅
   - https://xch.eoncom.io/favicon.ico ✅

2. **Manifest.json mis à jour:**
```json
{
  "name": "XCH",
  "short_name": "XCH",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/"
}
```

3. **Console DevTools:**
   - Aucune erreur 404 pour les icônes
   - PWA installable (icône en barre d'adresse Chrome)

## Recommandations design

### Tailles requises PWA
- **192x192px:** Icon standard (écran d'accueil, splash screen)
- **512x512px:** Icon haute résolution (installation, store)

### Tailles optionnelles
- **32x32px:** Favicon navigateur
- **180x180px:** Apple Touch Icon (iOS)
- **144x144px, 96x96px, 72x72px, 48x48px:** Compatibilité multi-device

### Design guidelines
- **Fond opaque** (pas transparent pour PWA)
- **Contraste élevé** (visible sur tous thèmes)
- **Simple et lisible** (reconnaissable en petite taille)
- **Cohérent avec branding** (couleurs XCH: bleu #3b82f6)

## Alternatives temporaires

En attendant les vraies icônes, options:

1. **Texte "XCH" sur fond bleu** (Solution 4 ci-dessus)
2. **Lettres stylisées** (via générateur en ligne)
3. **Icône générique IT** (serveur, réseau, etc.)

## Référence

- Fichier manifest: `frontend/public/manifest.json`
- Configuration PWA: `frontend/src/app/layout.tsx` (metadata)
- Script génération: `frontend/scripts/generate-pwa-icons.sh`

---

**Action requise:** Choisir une solution ci-dessus et générer les icônes.
