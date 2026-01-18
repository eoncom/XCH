#!/usr/bin/env node

/**
 * Generate PWA icons from icon.svg
 * Automatically generates all required PNG icons for PWA manifest
 *
 * Usage:
 *   npm run generate-icons
 *   node scripts/generate-pwa-icons.js
 */

const fs = require('fs');
const path = require('path');

// Icon sizes to generate
const ICON_SIZES = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
];

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SVG_PATH = path.join(PUBLIC_DIR, 'icon.svg');

console.log('🎨 Generating PWA icons from SVG...\n');

// Check if icon.svg exists
if (!fs.existsSync(SVG_PATH)) {
  console.error('❌ Error: icon.svg not found in public/ directory');
  console.log('Please create frontend/public/icon.svg first');
  process.exit(1);
}

// Try to use sharp (preferred) or canvas for PNG generation
let useSharp = false;
let useCanvas = false;

try {
  require.resolve('sharp');
  useSharp = true;
  console.log('✅ Using sharp for image generation (best quality)');
} catch (e) {
  try {
    require.resolve('canvas');
    useCanvas = true;
    console.log('✅ Using canvas for image generation');
  } catch (e2) {
    console.error('❌ Error: Neither sharp nor canvas is installed');
    console.log('\nPlease install one of the following:');
    console.log('  npm install --save-dev sharp (recommended)');
    console.log('  npm install --save-dev canvas');
    process.exit(1);
  }
}

async function generateIconsWithSharp() {
  const sharp = require('sharp');
  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const { size, name } of ICON_SIZES) {
    const outputPath = path.join(PUBLIC_DIR, name);

    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
    }
  }
}

async function generateIconsWithCanvas() {
  const { createCanvas, loadImage } = require('canvas');
  const svgContent = fs.readFileSync(SVG_PATH, 'utf8');

  for (const { size, name } of ICON_SIZES) {
    const outputPath = path.join(PUBLIC_DIR, name);

    try {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // For canvas, we need to convert SVG to image URL
      const svgBlob = Buffer.from(svgContent);
      const img = await loadImage(svgBlob);

      ctx.drawImage(img, 0, 0, size, size);

      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);

      console.log(`✅ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Failed to generate ${name}:`, error.message);
    }
  }
}

// Generate favicon.ico (multi-size ICO file)
function generateFavicon() {
  console.log('\n📝 Note: favicon.ico generation requires png-to-ico package');
  console.log('   Run: npm install --save-dev png-to-ico');
  console.log('   Or use an online tool: https://favicon.io/');
}

// Main execution
(async () => {
  try {
    if (useSharp) {
      await generateIconsWithSharp();
    } else if (useCanvas) {
      await generateIconsWithCanvas();
    }

    console.log('\n✅ PWA icons generated successfully!');
    console.log('\nGenerated files:');
    ICON_SIZES.forEach(({ name, size }) => {
      const filePath = path.join(PUBLIC_DIR, name);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`  - ${name} (${size}x${size}) - ${sizeKB} KB`);
      }
    });

    generateFavicon();

    console.log('\n🚀 Icons are ready for deployment!');
    console.log('   Next: npm run build && deploy to production');

  } catch (error) {
    console.error('\n❌ Error generating icons:', error);
    process.exit(1);
  }
})();
