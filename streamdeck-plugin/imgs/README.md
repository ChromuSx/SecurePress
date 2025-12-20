# SecurePress Icons

This directory should contain the plugin icons for Stream Deck.

## Required Icons

### Plugin Icons
- **plugin-icon.png** - Main plugin icon (256x256px or 512x512px)
- **plugin-icon@2x.png** - High-resolution version
- **category-icon.png** - Category icon in plugin list (28x28px)
- **category-icon@2x.png** - High-resolution version

### Action Icons
- **action-icon.png** - Default action icon (144x144px)
- **action-icon@2x.png** - High-resolution version

### Key State Images (144x144px each)
- **key-idle.png** / **key-idle@2x.png** - Default state (lock icon)
- **key-authenticating.png** / **key-authenticating@2x.png** - During auth (fingerprint/loading)
- **key-success.png** / **key-success@2x.png** - Success state (unlocked/checkmark)
- **key-error.png** / **key-error@2x.png** - Error state (red X)

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

Once you have icons, place them in this directory with the exact names listed above.
