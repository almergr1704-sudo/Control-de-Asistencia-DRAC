const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-nsis] NsisTarget.js not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

const targetBlock = `        if ((0, macosVersion_1.isMacOsCatalina)()) {
            try {
                await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);
            }
            catch (error) {
                builder_util_1.log.warn(\`packager.vm is used: \${error.message}\`);
                const vm = await packager.vm.value;
                await vm.exec(installerPath, []);
                // Parallels VM can exit after command execution, but NSIS continue to be running
                let i = 0;
                while (!(await (0, builder_util_1.exists)(uninstallerPath)) && i++ < 100) {
                    // noinspection JSUnusedLocalSymbols
                    await new Promise((resolve, _reject) => setTimeout(resolve, 300));
                }
            }
        }
        else {
            const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);
            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
        }`;

const replacementBlock = `        try {
            await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);
        }
        catch (error) {
            builder_util_1.log.warn(\`UninstallerReader failed: \${error.message}\`);
        }`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-nsis] Successfully applied UninstallerReader patch to NsisTarget.js');
} else if (content.includes('await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);') && !content.includes('wineVm.exec(installerPath')) {
  console.log('[patch-nsis] NsisTarget.js already cleanly patched!');
} else {
  console.log('[patch-nsis] Warning: Target block not found in NsisTarget.js');
}
