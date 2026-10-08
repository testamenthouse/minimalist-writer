// The page is the prototype (handoff/Writer.dc.html) untouched; this bridge adds only native dictation:
// start/stop the Speech.framework helper (desktop/src/dictate.js) and receive its events as window.dictate.
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('dictate', {
  available: () => call('dictate:available'), start: lang => call('dictate:start', lang), stop: () => call('dictate:stop'),
  on: cb => { const h = (e, ev) => cb(ev); ipcRenderer.on('dictate:event', h); return () => ipcRenderer.removeListener('dictate:event', h); }
});
