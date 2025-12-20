const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imgsDir = 'imgs';

// Icon configurations: [name, width, height, generate2x]
const iconConfigs = [
  // Plugin icons
  { name: 'plugin-icon', size: 512, need2x: true },
  { name: 'category-icon', size: 28, need2x: true },
  { name: 'action-icon', size: 144, need2x: true },

  // Key state icons
  { name: 'key-idle', size: 144, need2x: true },
  { name: 'key-authenticating', size: 144, need2x: true },
  { name: 'key-success', size: 144, need2x: true },
  { name: 'key-error', size: 144, need2x: true },
];

async function convertSVGToPNG(svgPath, pngPath, size) {
  try {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath);

    console.log(`✓ Created ${path.basename(pngPath)} (${size}x${size})`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to create ${path.basename(pngPath)}:`, error.message);
    return false;
  }
}

async function generateAllIcons() {
  console.log('🎨 Generating PNG icons from SVG...\n');

  let successCount = 0;
  let totalCount = 0;

  for (const config of iconConfigs) {
    const svgFile = path.join(imgsDir, `${config.name}.svg`);

    // Check if SVG exists
    if (!fs.existsSync(svgFile)) {
      console.warn(`⚠ SVG not found: ${config.name}.svg`);
      continue;
    }

    // Generate standard size
    const pngFile = path.join(imgsDir, `${config.name}.png`);
    totalCount++;
    if (await convertSVGToPNG(svgFile, pngFile, config.size)) {
      successCount++;
    }

    // Generate @2x version if needed
    if (config.need2x) {
      const png2xFile = path.join(imgsDir, `${config.name}@2x.png`);
      totalCount++;
      if (await convertSVGToPNG(svgFile, png2xFile, config.size * 2)) {
        successCount++;
      }
    }
  }

  console.log(`\n✅ Generated ${successCount}/${totalCount} PNG files`);

  if (successCount < totalCount) {
    console.log('\n⚠ Some icons failed to generate. Check errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All icons generated successfully!');
  }
}

// Run the script
generateAllIcons().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
