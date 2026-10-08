// Compiles the Speech.framework helper (dictate/dictate.swift) into bin/dictate, with the Info.plist that carries
// the microphone + speech usage strings embedded in the binary. macOS with Xcode command line tools only; the
// release workflow runs on macOS. Skipped when the binary is newer than its sources.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const desk = path.resolve(__dirname, '..');
const src = path.join(desk, 'dictate', 'dictate.swift'), plist = path.join(desk, 'dictate', 'Info.plist'), out = path.join(desk, 'bin', 'dictate');
if (process.platform !== 'darwin') { console.log('dictate: skipped (not macOS)'); process.exit(0); }
const newest = Math.max(fs.statSync(src).mtimeMs, fs.statSync(plist).mtimeMs, fs.statSync(__filename).mtimeMs);
if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= newest) { console.log('dictate: up to date'); process.exit(0); }
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  execFileSync('xcrun', ['swiftc', '-O', '-framework', 'Speech', '-framework', 'AVFoundation', src, '-o', out,
    '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plist], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--sign', '-', out], { stdio: 'inherit' }); // ad-hoc identity so TCC can remember the helper in dev runs
  console.log('dictate: built ' + out);
} catch (e) { console.error('dictate: build failed'); process.exit(1); }
