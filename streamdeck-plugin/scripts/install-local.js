const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

const pluginPackage = 'com.securepress.action.streamDeckPlugin';
const pluginDir = path.join(process.env.APPDATA, 'Elgato', 'StreamDeck', 'Plugins', 'com.securepress.action.sdPlugin');

console.log('🔧 Installing SecurePress plugin locally...\n');

// Check if package exists
if (!fs.existsSync(pluginPackage)) {
  console.error('❌ Error: ' + pluginPackage + ' not found');
  console.log('Run "npm run build:package" first');
  process.exit(1);
}

// Close Stream Deck
console.log('🛑 Closing Stream Deck...');
try {
  execSync('taskkill /F /IM StreamDeck.exe', { stdio: 'ignore' });
} catch (e) {
  // Stream Deck already closed
}

// Wait a bit
setTimeout(() => {
  // Remove old plugin
  if (fs.existsSync(pluginDir)) {
    console.log('🗑️  Removing old plugin...');
    fs.rmSync(pluginDir, { recursive: true, force: true });
  }

  // Extract package
  console.log('📦 Extracting plugin...');
  const zip = new AdmZip(pluginPackage);
  const pluginsDir = path.join(process.env.APPDATA, 'Elgato', 'StreamDeck', 'Plugins');
  zip.extractAllTo(pluginsDir, true);

  console.log('');
  console.log('✅ Plugin installed successfully!');
  console.log('');
  console.log('📍 Installed to:', pluginDir);
  console.log('');
  console.log('👉 Now open Stream Deck to use the plugin!');
}, 2000);
