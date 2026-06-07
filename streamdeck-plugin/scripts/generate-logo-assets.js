const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imgsDir = path.join(__dirname, '..', 'imgs');
const marketplaceDir = path.join(__dirname, '..', 'marketplace');
const sourceLogo = path.join(imgsDir, 'source-logo.png');

const stateBadges = {
  idle: null,
  authenticating: { color: '#00E5FF', mark: 'dots' },
  success: { color: '#22C55E', mark: 'check' },
  error: { color: '#EF4444', mark: 'x' },
};

async function getTransparentSourceBuffer() {
  const metadata = await sharp(sourceLogo).metadata();
  if (metadata.hasAlpha) {
    const { data, info } = await sharp(sourceLogo)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let hasTransparentPixel = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        hasTransparentPixel = true;
        break;
      }
    }

    if (hasTransparentPixel) {
      return sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4,
        },
      }).png().toBuffer();
    }
  }

  const { data, info } = await sharp(sourceLogo)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const luminance = (red + green + blue) / 3;
    const isNeutralLight = min >= 210 && max - min <= 18;

    if (!isNeutralLight) {
      continue;
    }

    if (luminance >= 232) {
      data[i + 3] = 0;
    } else {
      const alpha = Math.round(((232 - luminance) / 22) * 255);
      data[i + 3] = Math.min(data[i + 3], Math.max(0, alpha));
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).png().toBuffer();
}

async function renderSquare(input, outputPath, size) {
  await sharp(input)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toFile(outputPath);
  console.log(`✓ ${path.basename(outputPath)} ${size}x${size}`);
}

function badgeSvg(size, badge) {
  const badgeSize = Math.round(size * 0.34);
  const center = Math.round(badgeSize / 2);
  const stroke = Math.max(3, Math.round(size * 0.035));
  const radius = center - Math.round(stroke / 2);

  let mark = '';
  if (badge.mark === 'check') {
    mark = `<path d="M ${badgeSize * 0.28} ${badgeSize * 0.52} L ${badgeSize * 0.44} ${badgeSize * 0.68} L ${badgeSize * 0.75} ${badgeSize * 0.34}" fill="none" stroke="#FFFFFF" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (badge.mark === 'x') {
    mark = `<path d="M ${badgeSize * 0.34} ${badgeSize * 0.34} L ${badgeSize * 0.66} ${badgeSize * 0.66} M ${badgeSize * 0.66} ${badgeSize * 0.34} L ${badgeSize * 0.34} ${badgeSize * 0.66}" fill="none" stroke="#FFFFFF" stroke-width="${stroke}" stroke-linecap="round"/>`;
  } else {
    const dot = Math.max(2, Math.round(size * 0.025));
    mark = `
      <circle cx="${badgeSize * 0.34}" cy="${center}" r="${dot}" fill="#FFFFFF"/>
      <circle cx="${center}" cy="${center}" r="${dot}" fill="#FFFFFF"/>
      <circle cx="${badgeSize * 0.66}" cy="${center}" r="${dot}" fill="#FFFFFF"/>
    `;
  }

  return Buffer.from(`
    <svg width="${badgeSize}" height="${badgeSize}" viewBox="0 0 ${badgeSize} ${badgeSize}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="${badge.color}" stroke="#06131F" stroke-width="${stroke}"/>
      ${mark}
    </svg>
  `);
}

async function renderState(sourceBuffer, name, size) {
  const base = sharp(sourceBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png();

  const badge = stateBadges[name];
  const outputPath = path.join(imgsDir, `key-${name}${size === 144 ? '@2x' : ''}.png`);

  if (!badge) {
    await base.toFile(outputPath);
  } else {
    const badgeSize = Math.round(size * 0.34);
    await base
      .composite([{
        input: badgeSvg(size, badge),
        left: size - badgeSize - Math.round(size * 0.05),
        top: size - badgeSize - Math.round(size * 0.05),
      }])
      .toFile(outputPath);
  }

  console.log(`✓ ${path.basename(outputPath)} ${size}x${size}`);
}

async function main() {
  if (!fs.existsSync(sourceLogo)) {
    console.error(`Missing ${sourceLogo}`);
    process.exit(1);
  }

  fs.mkdirSync(marketplaceDir, { recursive: true });
  const transparentSource = await getTransparentSourceBuffer();

  await sharp(transparentSource).toFile(path.join(imgsDir, 'source-logo-transparent.png'));
  await renderSquare(transparentSource, path.join(imgsDir, 'plugin-icon.png'), 256);
  await renderSquare(transparentSource, path.join(imgsDir, 'plugin-icon@2x.png'), 512);
  await renderSquare(transparentSource, path.join(__dirname, '..', '..', 'logo.png'), 512);
  await renderSquare(transparentSource, path.join(marketplaceDir, 'app-icon.png'), 288);

  for (const state of Object.keys(stateBadges)) {
    await renderState(transparentSource, state, 72);
    await renderState(transparentSource, state, 144);
  }

  console.log('✓ Logo assets generated');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
