const { app, BrowserWindow, Menu, dialog, net, protocol, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');

const SCHEME = 'app';
const ORIGIN = `${SCHEME}://writer`;
const APP_DIR = path.join(__dirname, '..', 'app');
const SMOKE = !!process.env.WRITER_SMOKE;

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

// ---- static files: app://writer/<path> → ./app/<path>
function serveApp() {
  protocol.handle(SCHEME, (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR)) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ---- the page is ours: grant it the File System Access API and fullscreen, nothing else
const ALLOWED = new Set(['fileSystem', 'fullscreen', 'clipboard-sanitized-write']);
function trustApp() {
  const ses = session.defaultSession;
  const ours = (origin) => typeof origin === 'string' && origin.startsWith(ORIGIN);
  ses.setPermissionCheckHandler((wc, permission, origin) => ours(origin) && ALLOWED.has(permission));
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(ours(details.requestingUrl) && ALLOWED.has(permission)));
}

// ---- updates: download quietly, install on quit, offer a restart from the menu
let updateReady = false;
let checking = false;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = null;
autoUpdater.on('update-downloaded', () => { updateReady = true; buildMenu(); });
autoUpdater.on('error', () => { checking = false; });

async function checkForUpdates(manual) {
  if (!app.isPackaged || checking) return;
  checking = true;
  try {
    const r = await autoUpdater.checkForUpdates();
    if (manual && !(r && r.isUpdateAvailable) && !updateReady) await dialog.showMessageBox({ message: 'Up to date', buttons: ['OK'] });
  } catch (e) {
    if (manual) await dialog.showMessageBox({ type: 'error', message: 'Could not check for updates', buttons: ['OK'] });
  } finally { checking = false; }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const updateItems = [
    updateReady
      ? { label: 'Restart to Update', click: () => autoUpdater.quitAndInstall() }
      : { label: 'Check for Updates…', click: () => checkForUpdates(true) },
    { type: 'separator' }
  ];
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, ...updateItems, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])] },
    ...(isMac ? [] : [{ label: 'Help', submenu: updateItems }])
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 720, minHeight: 480,
    title: 'Writer', backgroundColor: '#ffffff', show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.once('ready-to-show', () => { if (!SMOKE) win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) { e.preventDefault(); shell.openExternal(url); } });
  if (SMOKE) {
    win.webContents.on('console-message', (e, level, msg) => { if (level >= 2) console.log('SMOKE console: ' + msg); });
    win.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const r = await win.webContents.executeJavaScript(`(async () => ({
          title: document.title, origin: location.origin, text: document.body.innerText.trim().replace(/\\s+/g, ' ').slice(0, 60),
          fsa: typeof window.showDirectoryPicker,
          opfsPerm: await navigator.storage.getDirectory().then(h => h.queryPermission({ mode: 'readwrite' })).catch(e => 'ERR ' + e.message),
          font: document.fonts.check('600 20px Inter')
        }))()`);
        console.log('SMOKE ' + JSON.stringify(r));
      } catch (e) { console.log('SMOKE ERROR ' + e.message); }
      app.exit(0);
    });
  }
  win.loadURL(`${ORIGIN}/index.html`);
}

app.whenReady().then(() => {
  serveApp(); trustApp(); buildMenu(); createWindow();
  checkForUpdates(false);
  setInterval(() => checkForUpdates(false), 60 * 60 * 1000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
