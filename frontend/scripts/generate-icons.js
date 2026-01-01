#!/usr/bin/env node

/**
 * Script to generate PWA icons from SVG
 * Usage: node scripts/generate-icons.js
 *
 * Prerequisites:
 * npm install -D sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ sharp is not installed. Install it with:');
  console.error('   npm install -D sharp');
  console.error('\nAlternatively, see public/ICONS_README.md for other options.');
  process.exit(1);
}

const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'icon.svg');

// Check if SVG exists
if (!fs.existsSync(svgPath)) {
  console.error('❌ icon.svg not found in public/ directory');
  process.exit(1);
}

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons from icon.svg...\n');

  for (const { size, name } of sizes) {
    const outputPath = path.join(publicDir, name);

    try {
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 59, g: 130, b: 246, alpha: 1 }, // #3b82f6
        })
        .png()
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      const kb = (stats.size / 1024).toFixed(2);

      console.log(`✅ ${name} (${size}x${size}) - ${kb} KB`);
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
    }
  }

  console.log('\n✨ Done! Icons generated in public/ directory.');
  console.log('\nNext steps:');
  console.log('1. Verify the icons look correct');
  console.log('2. The manifest.json is already configured');
  console.log('3. Test the PWA install prompt in your browser');
}

generateIcons().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
