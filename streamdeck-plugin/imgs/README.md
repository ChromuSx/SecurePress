# SecurePress Icons

This directory should contain the plugin icons for Stream Deck.

## Required Icons

### Plugin Icons
- **plugin-icon.png** - Main plugin icon (256x256px)
- **plugin-icon@2x.png** - High-resolution version (512x512px)
- **category-icon.png** - Category icon in plugin list (28x28px)
- **category-icon@2x.png** - High-resolution version (56x56px)

### Action Icons
- **action-icon.png** - Action-list icon (20x20px)
- **action-icon@2x.png** - High-resolution version (40x40px)

### Key State Images
- **key-idle.png** / **key-idle@2x.png** - Default state (lock icon)
- **key-authenticating.png** / **key-authenticating@2x.png** - During auth (fingerprint/loading)
- **key-success.png** / **key-success@2x.png** - Success state (unlocked/checkmark)
- **key-error.png** / **key-error@2x.png** - Error state (red X)

Standard key icons are 72x72px; high-DPI `@2x` key icons are 144x144px.

### Source Logo
- **source-logo.png** - Master logo used by `scripts/generate-logo-assets.js`
- **../marketplace/app-icon.png** - Marketplace app icon (288x288px)

## Design Guidelines

- Use a lock/security theme
- Primary color: Blue (#0e6dbb) for brand consistency
- States should be clearly distinguishable
- Consider using:
  - 🔒 Lock for idle
  - 🔐 Lock with keyhole for authenticating
  - 🔓 Unlocked for success
  - ❌ Red X for error

## Temporary Solution

For testing, you can:
1. Use solid colored squares with emoji
2. Copy icons from similar security plugins
3. Create simple SVG icons and convert to PNG

## Icon Creation Tools

- **Online**: Figma, Canva, Photopea
- **Desktop**: GIMP, Inkscape, Adobe Illustrator
- **AI**: Use AI image generators with prompts like "security lock icon blue modern"

Once you have a new master logo, save it as `source-logo.png` and run:

```bash
npm run icons:logo
npm run icons
```
