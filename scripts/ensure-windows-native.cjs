const { execSync } = require('child_process');

if (process.platform === 'win32') {
  console.log('[ensure-windows-native] Running on Windows platform, verifying native binary modules...');
  const missing = [];

  try {
    require('@rollup/rollup-win32-x64-msvc');
    console.log('[ensure-windows-native] @rollup/rollup-win32-x64-msvc OK');
  } catch (e) {
    missing.push('@rollup/rollup-win32-x64-msvc@4.62.4');
  }

  try {
    require('esbuild').buildSync({ stdin: { contents: '' }, write: false });
    console.log('[ensure-windows-native] esbuild Windows native module OK');
  } catch (e) {
    missing.push('@esbuild/win32-x64@0.25.12');
  }

  if (missing.length > 0) {
    console.log('[ensure-windows-native] Installing missing Windows native packages:', missing.join(' '));
    try {
      execSync(`npm install --no-save --include=optional ${missing.join(' ')}`, { stdio: 'inherit' });
      console.log('[ensure-windows-native] Windows native packages installed successfully.');
    } catch (err) {
      console.error('[ensure-windows-native] Failed to install packages:', err);
      process.exit(1);
    }
  }
} else {
  // Non-Windows environment (e.g., Linux container)
  console.log('[ensure-windows-native] Running on', process.platform, '- skipping Windows native check.');
}
