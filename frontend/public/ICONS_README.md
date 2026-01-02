# PWA Icons Generation

**Dernière mise à jour :** 2026-01-01

## Current Status

Un fichier SVG `icon.svg` est fourni comme source pour les icons PWA.

## Générer les PNG (192x192 et 512x512)

### Option 1: En ligne (recommandé)

1. Ouvrez https://jakearchibald.github.io/svgomg/
2. Upload `icon.svg`
3. Téléchargez le SVG optimisé

Puis utilisez https://cloudconvert.com/svg-to-png pour convertir:
- Taille 1: 192x192 pixels → sauvegarder comme `icon-192.png`
- Taille 2: 512x512 pixels → sauvegarder comme `icon-512.png`

### Option 2: Avec ImageMagick (ligne de commande)

```bash
# Installer ImageMagick
# Windows: https://imagemagick.org/script/download.php
# Mac: brew install imagemagick
# Linux: apt-get install imagemagick

# Générer les PNG
magick icon.svg -resize 192x192 icon-192.png
magick icon.svg -resize 512x512 icon-512.png
```

### Option 3: Avec Inkscape

1. Ouvrir `icon.svg` dans Inkscape
2. File → Export PNG Image
3. Image Size: 192x192 → Export as `icon-192.png`
4. Image Size: 512x512 → Export as `icon-512.png`

### Option 4: Avec Node.js (sharp)

```bash
npm install -D sharp sharp-cli

# Générer les PNG
npx sharp -i icon.svg -o icon-192.png resize 192 192
npx sharp -i icon.svg -o icon-512.png resize 512 512
```

## Vérification

Après génération, vérifiez que:
- `icon-192.png` fait exactement 192x192 pixels
- `icon-512.png` fait exactement 512x512 pixels
- Les deux fichiers sont dans le dossier `public/`

Le manifest.json est déjà configuré pour utiliser ces fichiers.

## Personnalisation

Pour personnaliser l'icon:
1. Modifiez `icon.svg` (logo, couleurs, texte)
2. Régénérez les PNG avec une des méthodes ci-dessus

### Couleurs actuelles

- Background: `#3b82f6` (blue-500 Tailwind)
- Texte principal: `#ffffff` (blanc)
- Sous-titre: `#dbeafe` (blue-100 Tailwind)
