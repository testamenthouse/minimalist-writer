// Native dictation: one bin/dictate process (Speech.framework, see dictate/dictate.swift) per session. Its JSON
// lines are relayed to the page as 'dictate:event'; the page's dictation module reads them through the
// window.dictate bridge in preload.js. DICTATE_BIN overrides the helper path (smoke tests use a fake).
const { app, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function binary() {
  if (process.env.DICTATE_BIN) return process.env.DICTATE_BIN;
  const p = app.isPackaged ? path.join(process.resourcesPath, 'bin', 'dictate') : path.join(__dirname, '..', 'bin', 'dictate');
  return fs.existsSync(p) ? p : null;
}
let child = null, openedSettings = false;
function stop() {
  const c = child; if (!c) return; child = null;
  try { c.stdin.write('stop\n'); } catch (e) {}
  const kill = setTimeout(() => { try { c.kill('SIGTERM'); } catch (e) {} }, 1500);
  c.once('exit', () => clearTimeout(kill));
}
function wire(getWin) {
  const send = ev => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('dictate:event', ev); };
  ipcMain.handle('dictate:available', () => process.platform === 'darwin' && !!binary());
  ipcMain.handle('dictate:start', (e, lang) => {
    if (child) return true;
    const bin = binary(); if (!bin) { send({ t: 'error', msg: 'Dictation unavailable' }); send({ t: 'exit' }); return false; }
    let c;
    // Dev runs: the helper becomes its own permission principal (see dictate/dictate.swift); packaged: the app is.
    const env = { ...process.env, ...(app.isPackaged ? {} : { DICTATE_DISCLAIM: '1' }) };
    try { c = spawn(bin, [lang || app.getLocale() || 'en-US'], { stdio: ['pipe', 'pipe', 'pipe'], env }); }
    catch (err) { send({ t: 'error', msg: err.message }); send({ t: 'exit' }); return false; }
    child = c; let buf = '';
    c.stdout.on('data', d => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
        let ev; try { ev = JSON.parse(line); } catch (err) { continue; }
        send(ev);
        // macOS Dictation is off: show the Keyboard pane where it is switched on (once per app run).
        if (ev.t === 'error' && ev.code === 'dictation-off' && !openedSettings) { openedSettings = true; shell.openExternal('x-apple.systempreferences:com.apple.Keyboard-Settings.extension?Dictation').catch(() => {}); }
      }
    });
    let ebuf = ''; c.stderr.on('data', d => { ebuf += d; let i; while ((i = ebuf.indexOf('\n')) >= 0) { const line = ebuf.slice(0, i).trim(); ebuf = ebuf.slice(i + 1); if (!line) continue; if (!app.isPackaged) console.log('dictate: ' + line); send({ t: 'log', msg: line }); } });
    c.on('error', err => { if (child === c) child = null; send({ t: 'error', msg: err.message }); send({ t: 'exit' }); });
    c.on('exit', code => { if (child === c) child = null; send({ t: 'exit', code }); });
    return true;
  });
  ipcMain.handle('dictate:stop', () => { stop(); });
  app.on('before-quit', stop);
}
module.exports = { wire, stop };
