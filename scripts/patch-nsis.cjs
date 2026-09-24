const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-nsis] NsisTarget.js not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

if (content.includes('UninstallerReader.exec(installerPath, uninstallerPath);') && content.includes('falling back to wine')) {
  console.log('[patch-nsis] NsisTarget.js is already patched.');
  process.exit(0);
}

const unpatchedPattern = /if \(\(0, macosVersion_1\.isMacOsCatalina\)\(\)\) \{[\s\S]*?const wineVm = new WineVm_1\.WineVmManager\(\(_a = packager\.config\.toolsets\) === null \|\| _a === void 0 \? void 0 : _a\.wine\);\s*await wineVm\.exec\(installerPath, \[\], \{ env: \{ __COMPAT_LAYER: "RunAsInvoker" \} \}\);\s*\}/;

const replacement = `try {
            await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);
        }
        catch (error) {
            builder_util_1.log.warn(\`UninstallerReader failed: \${error.message}, falling back to wine\`);
            try {
                const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);
                await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
            } catch (wineErr) {
                builder_util_1.log.warn(\`Wine fallback failed: \${wineErr.message}\`);
            }
        }`;

if (unpatchedPattern.test(content)) {
  content = content.replace(unpatchedPattern, replacement);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-nsis] Successfully applied UninstallerReader patch to NsisTarget.js');
} else {
  console.log('[patch-nsis] Pattern not matched, inspecting...');
}
