const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const publicDir = path.join(rootDir, 'public');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Copy icon from public/icon.png to build/icon.png if missing or outdated
const publicIcon = path.join(publicDir, 'icon.png');
const buildIcon = path.join(buildDir, 'icon.png');

if (fs.existsSync(publicIcon)) {
  fs.copyFileSync(publicIcon, buildIcon);
  console.log('[prepare-build] icon.png successfully synchronized to build/icon.png');
} else {
  console.warn('[prepare-build] Warning: public/icon.png not found');
}
