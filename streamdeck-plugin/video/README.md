# Marketplace Promo Video

Code-driven marketplace screenshots and promo video for the **SecurePress**
Stream Deck plugin, built with [Remotion](https://www.remotion.dev/)
(React -> MP4).

Generated marketplace assets:

- `../marketplace/promo-thumbnail.png` - 1920x960 promo thumbnail
- `../marketplace/gallery-hero.png` - 1920x960 gallery image
- `../marketplace/gallery-property-inspector.png` - 1920x960 gallery image
- `../marketplace/promo.mp4` - 1920x1080 H.264 video, about 35 seconds

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
| 5-13s | The Stream Deck setup and protected action configuration breathe on screen |
| 13-21s | Windows Hello confirmation appears above the workflow |
| 21-24.3s | Real Property Inspector: protected program launch setup |
| 24.3-27.6s | Real Property Inspector: HTTP request setup with DPAPI-backed data |
| 27.6-31s | Real Property Inspector: secure text input setup |
| 31-35s | Closing frame: one press, then verify |

## Structure

```text
src/
  Root.tsx              Remotion compositions for video and stills
  SecurePressPromo.tsx  Main timeline plus static marketplace frames
public/
  *.png                 Plugin icon, logo, action icon and key-state assets
  *.mp3                 Licensed music used by the promo video
  keys/*.png            Real Stream Deck key-state art
  inspector-*.png       Real Property Inspector screenshots used in the video
```

## Music

The promo video uses `securepress-mixkit-close-up.mp3`, downloaded from Mixkit:

- Track: `Close Up`
- Artist: `Michael Ramir C.`
- Source: `https://mixkit.co/free-stock-music/tag/technology/`
- License: `Mixkit Stock Music Free License`
