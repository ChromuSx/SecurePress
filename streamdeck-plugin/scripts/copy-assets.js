const fs = require('fs');
const path = require('path');

const pluginDir = 'com.securepress.action.sdPlugin';

fs.rmSync(pluginDir, { recursive: true, force: true });
fs.mkdirSync(pluginDir, { recursive: true });

// Copy manifest from the tracked source file into the packaged plugin folder.
const manifestSource = 'manifest.json';
if (!fs.existsSync(manifestSource)) {
  console.error('Error: manifest.json source file not found.');
  process.exit(1);
}
fs.copyFileSync(manifestSource, path.join(pluginDir, 'manifest.json'));
console.log('✓ Copied manifest');

// Copy all compiled JS files from bin
const binSourceDir = 'bin';
const binDestDir = path.join(pluginDir, 'bin');

if (fs.existsSync(binSourceDir)) {
  fs.mkdirSync(binDestDir, { recursive: true });

  const jsFiles = fs.readdirSync(binSourceDir).filter(f => f.endsWith('.js'));

  if (jsFiles.length === 0) {
    console.warn('Warning: No .js files found in bin/. Run tsc first.');
  } else {
    jsFiles.forEach(file => {
      fs.copyFileSync(
        path.join(binSourceDir, file),
        path.join(binDestDir, file)
      );
    });
    console.log(`✓ Copied ${jsFiles.length} JavaScript file(s) to sdPlugin directory`);
  }
} else {
  console.warn('Warning: bin/ directory not found. Run tsc first.');
}

// Copy UI files if they exist
const uiSource = 'ui';
const uiDest = path.join(pluginDir, 'ui');

if (fs.existsSync(uiSource)) {
  fs.mkdirSync(uiDest, { recursive: true });
  const uiFiles = fs.readdirSync(uiSource);

  uiFiles.forEach(file => {
    fs.copyFileSync(
      path.join(uiSource, file),
      path.join(uiDest, file)
    );
  });
  console.log('✓ Copied UI files');
}

// Copy images if they exist
const imgsSource = 'imgs';
const imgsDest = path.join(pluginDir, 'imgs');

if (fs.existsSync(imgsSource)) {
  fs.mkdirSync(imgsDest, { recursive: true });
  const imgFiles = [
    'plugin-icon.png',
    'plugin-icon@2x.png',
    'category-icon.png',
    'category-icon@2x.png',
    'action-icon.png',
    'action-icon@2x.png',
    'key-idle.png',
    'key-idle@2x.png',
    'key-authenticating.png',
    'key-authenticating@2x.png',
    'key-success.png',
    'key-success@2x.png',
    'key-error.png',
    'key-error@2x.png',
  ];

  imgFiles.forEach(file => {
    const sourcePath = path.join(imgsSource, file);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Warning: image asset missing: ${file}`);
      return;
    }

    fs.copyFileSync(
      sourcePath,
      path.join(imgsDest, file)
    );
  });
  console.log('✓ Copied image files');
}

// Copy Windows Hello helper if it was published.
const helperSource = path.join(
  'native',
  'SecurePress.AuthHelper',
  'bin',
  'Release',
  'net8.0-windows10.0.19041.0',
  'win-x64',
  'publish',
  'SecurePress.AuthHelper.exe'
);

if (fs.existsSync(helperSource)) {
  fs.copyFileSync(helperSource, path.join(pluginDir, 'SecurePress.AuthHelper.exe'));
  console.log('✓ Copied Windows Hello auth helper');
} else {
  console.warn('Warning: Windows Hello auth helper not found. Run npm run build:auth-helper first.');
}

// Copy node_modules (production dependencies only)
console.log('Copying production dependencies...');
const nodeModulesSource = 'node_modules';
const nodeModulesDest = path.join(pluginDir, 'node_modules');

if (fs.existsSync(nodeModulesSource)) {
  // Copy only production dependencies (including transitive dependencies for node-fetch)
  const prodDeps = [
    'passport-desktop',
    'node-fetch',
    'ws',
    'data-uri-to-buffer',
    'fetch-blob',
    'formdata-polyfill',
    'web-streams-polyfill',
    'node-domexception'
  ];

  for (const dep of prodDeps) {
    const depSource = path.join(nodeModulesSource, dep);
    const depDest = path.join(nodeModulesDest, dep);

    if (fs.existsSync(depSource)) {
      fs.mkdirSync(path.dirname(depDest), { recursive: true });

      // Copy directory recursively
      copyRecursive(depSource, depDest);
      console.log(`✓ Copied ${dep}`);
    }
  }
}

function copyRecursive(src, dest) {
  if (path.basename(src) === '.history') {
    return;
  }

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);

    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('✓ Build complete!');
