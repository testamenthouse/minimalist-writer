// Pulls the authoritative prototype (../handoff) into ./app for packaging.
// handoff/Writer.dc.html stays the only source of the UI; never edit ./app by hand.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const handoff = path.join(root, '..', 'handoff');
const app = path.join(root, 'app');
const fonts = path.join(app, 'fonts');

fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(fonts, { recursive: true });

let html = fs.readFileSync(path.join(handoff, 'Writer.dc.html'), 'utf8');
const before = html;
html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/[^"]*" rel="stylesheet">/, '<link href="./fonts/inter.css" rel="stylesheet">');
if (html === before) throw new Error('sync: Google Fonts link not found in Writer.dc.html');
const csp = "default-src 'self' app:; script-src 'self' 'unsafe-inline' 'unsafe-eval' app:; style-src 'self' 'unsafe-inline' app:; font-src 'self' app:; img-src 'self' data: blob: app:; connect-src 'self' app:; frame-src 'self' about: blob: app:";
const resources = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': './vendor/react.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': './vendor/react-dom.js'
};
html = html.replace('<script src="./support.js"></script>',
  '<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n' +
  '<script>window.__resources = ' + JSON.stringify(resources) + ';</script>\n' +
  '<script src="./support.js"></script>');
if (!html.includes('Content-Security-Policy')) throw new Error('sync: support.js script tag not found');
fs.writeFileSync(path.join(app, 'index.html'), html);
fs.copyFileSync(path.join(handoff, 'support.js'), path.join(app, 'support.js'));
for (const f of fs.readdirSync(path.join(root, 'vendor', 'inter'))) fs.copyFileSync(path.join(root, 'vendor', 'inter', f), path.join(fonts, f));
const vendor = path.join(app, 'vendor'); fs.mkdirSync(vendor, { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'vendor', 'react'))) fs.copyFileSync(path.join(root, 'vendor', 'react', f), path.join(vendor, f));
require('child_process').execSync('node scripts/build-dictate.js', { cwd: root, stdio: 'inherit' });
console.log('synced handoff → desktop/app + dictate');
