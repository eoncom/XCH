#!/bin/bash
# Generate PWA icons from SVG using ImageMagick (convert command)

if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not installed. Install it first:"
    echo "   Ubuntu/Debian: sudo apt install imagemagick"
    echo "   macOS: brew install imagemagick"
    echo "   Windows: choco install imagemagick"
    exit 1
fi

cd "$(dirname "$0")/.."

if [ ! -f "public/icon.svg" ]; then
    echo "❌ public/icon.svg not found"
    exit 1
fi

echo "📱 Generating PWA icons..."

# Generate 192x192
convert public/icon.svg -resize 192x192 public/icon-192.png
echo "✅ Generated icon-192.png"

# Generate 512x512
convert public/icon.svg -resize 512x512 public/icon-512.png
echo "✅ Generated icon-512.png"

# Generate favicon
convert public/icon.svg -resize 32x32 public/favicon.ico
echo "✅ Generated favicon.ico"

# Generate apple-touch-icon
convert public/icon.svg -resize 180x180 public/apple-touch-icon.png
echo "✅ Generated apple-touch-icon.png"

echo ""
echo "🎉 All PWA icons generated successfully!"
echo ""
echo "Next steps:"
echo "1. Rebuild frontend: npm run build"
echo "2. Redeploy to production"
