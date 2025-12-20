const fs = require('fs');
const path = require('path');

const pluginDir = 'com.securepress.action.sdPlugin';

// Copy manifest
fs.copyFileSync(
  path.join(pluginDir, 'manifest.json'),
  path.join(pluginDir, 'manifest.json')
);

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
  const imgFiles = fs.readdirSync(imgsSource);

  imgFiles.forEach(file => {
    fs.copyFileSync(
      path.join(imgsSource, file),
      path.join(imgsDest, file)
    );
  });
  console.log('✓ Copied image files');
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
