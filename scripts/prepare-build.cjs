const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const publicDir = path.join(rootDir, 'public');
const nodeModulesDir = path.join(rootDir, 'node_modules');

// 1. Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 2. Copy icon from public/icon.png to build/icon.png if missing or outdated
const publicIcon = path.join(publicDir, 'icon.png');
const buildIcon = path.join(buildDir, 'icon.png');

if (fs.existsSync(publicIcon)) {
  fs.copyFileSync(publicIcon, buildIcon);
  console.log('[prepare-build] icon.png successfully synchronized to build/icon.png');
} else {
  console.warn('[prepare-build] Warning: public/icon.png not found');
}

// 3. Fix self-referencing dependencies in node_modules (e.g. node-zklib@1.3.0 lists "node-zklib": "^1.0.0")
// which cause infinite recursion / JS heap OOM in electron-builder v26 node-module-collector
if (fs.existsSync(nodeModulesDir)) {
  let fixedSelfDeps = 0;
  const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = path.join(nodeModulesDir, entry.name, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg && pkg.name && pkg.dependencies && pkg.dependencies[pkg.name]) {
        delete pkg.dependencies[pkg.name];
        if (Object.keys(pkg.dependencies).length === 0) {
          delete pkg.dependencies;
        }
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        fixedSelfDeps++;
        console.log(`[prepare-build] Removed circular self-dependency in ${pkg.name}/package.json`);
      }
    } catch (err) {
      // Ignore malformed package.json
    }
  }
  if (fixedSelfDeps === 0) {
    console.log('[prepare-build] No circular self-dependencies found in top-level node_modules.');
  }
}

// 4. Add cycle-detection guard in app-builder-lib's NodeModulesCollector._getNodeModules (electron-builder v26)
const collectorPath = path.join(
  nodeModulesDir,
  'app-builder-lib',
  'out',
  'node-module-collector',
  'nodeModulesCollector.js'
);
if (fs.existsSync(collectorPath)) {
  try {
    let content = fs.readFileSync(collectorPath, 'utf8');
    const targetSig = 'async _getNodeModules(dependencies, result) {';
    if (content.includes(targetSig) && !content.includes('/* DRAC_CYCLE_GUARD */')) {
      content = content.replace(
        targetSig,
        'async _getNodeModules(dependencies, result, visited = new Set()) { /* DRAC_CYCLE_GUARD */'
      );
      content = content.replace(
        'const key = `${d.name}@${reference}`;',
        'const key = `${d.name}@${reference}`;\n            if (visited.has(key)) { continue; }'
      );
      content = content.replace(
        'await this._getNodeModules(d.dependencies, node.dependencies);',
        'const nextVisited = new Set(visited);\n                nextVisited.add(key);\n                await this._getNodeModules(d.dependencies, node.dependencies, nextVisited);'
      );
      fs.writeFileSync(collectorPath, content, 'utf8');
      console.log('[prepare-build] Applied circular dependency guard to app-builder-lib NodeModulesCollector.');
    }
  } catch (err) {
    console.warn('[prepare-build] Warning patching nodeModulesCollector.js:', err.message);
  }
}

