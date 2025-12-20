const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const pluginDir = 'com.securepress.action.sdPlugin';
const outputFile = 'com.securepress.action.streamDeckPlugin';

// Check if plugin directory exists
if (!fs.existsSync(pluginDir)) {
  console.error(`Error: ${pluginDir} directory not found. Run 'npm run build' first.`);
  process.exit(1);
}

// Remove old package if exists
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
  console.log('✓ Removed old package');
}

// Create zip file (Stream Deck plugin is just a renamed zip)
try {
  const zip = new AdmZip();

  // Stream Deck expects the .sdPlugin directory to be INSIDE the .streamDeckPlugin file
  // So we need to add the entire plugin directory, not just its contents
  function addDirectory(dirPath, zipBasePath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const zipPath = path.join(zipBasePath, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        addDirectory(fullPath, zipPath);
      } else {
        // Add file with the correct path in the zip
        const fileBuffer = fs.readFileSync(fullPath);
        zip.addFile(zipPath, fileBuffer);
      }
    }
  }

  // Add the entire plugin directory with its name
  addDirectory(pluginDir, pluginDir);

  // Write the zip file
  zip.writeZip(outputFile);

  const stats = fs.statSync(outputFile);
  const fileSizeInKB = (stats.size / 1024).toFixed(2);

  console.log(`✓ Created ${outputFile} (${fileSizeInKB} KB)`);
  console.log('✓ Package complete! Double-click the .streamDeckPlugin file to install.');
  console.log('');
  console.log('📦 To distribute:');
  console.log(`   - Upload ${outputFile} to Stream Deck Marketplace`);
  console.log('   - Or share the file for manual installation');
} catch (error) {
  console.error('Error creating package:', error.message);
  process.exit(1);
}
