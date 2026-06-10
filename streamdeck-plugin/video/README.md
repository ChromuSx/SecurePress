# Marketplace Promo Video

Code-driven marketplace screenshots and promo video for the **SecurePress**
Stream Deck plugin, built with [Remotion](https://www.remotion.dev/)
(React -> MP4).

Generated marketplace assets:

- `../marketplace/promo-thumbnail.png` - 1920x960 promo thumbnail
- `../marketplace/gallery-hero.png` - 1920x960 gallery image
- `../marketplace/gallery-property-inspector.png` - 1920x960 gallery image
- `../marketplace/promo.mp4` - 1920x1080 H.264 video, about 24 seconds

## Setup

```bash
npm install
```

The first render may download a Chromium Headless Shell used by Remotion.

## Commands

| Command | What it does |
|---|---|
| `npm run studio` | Open the live preview/editor at `localhost:3000` |
| `npm run render` | Render the video to `out/promo.mp4` |
| `npm run thumbnail` | Render the promo thumbnail to `out/promo-thumbnail.png` |
| `npm run hero` | Render the first gallery image to `out/gallery-hero.png` |
| `npm run property` | Render the property inspector gallery image to `out/gallery-property-inspector.png` |
| `npm run stills` | Render all three PNG stills |

Copy finished files from `out/` into `../marketplace/` before packaging or
submitting the listing.

## Storyboard

| Time | Beat |
|---|---|
| 0-4s | SecurePress key on a Stream Deck asks for explicit approval |
| 4-8s | Windows Hello confirmation appears above the workflow |
| 8-13s | The approved action unlocks and runs |
| 13-18s | Protected action types are shown: app, script, hotkey, HTTP, text |
| 18-24s | Closing frame: one press, then verify |

## Structure

```text
src/
  Root.tsx              Remotion compositions for video and stills
  SecurePressPromo.tsx  Main timeline plus static marketplace frames
public/
  *.png                 Plugin icon, logo, action icon and key-state assets
  keys/*.png            Real Stream Deck key-state art
```
