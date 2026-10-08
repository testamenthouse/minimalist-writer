// Bridge: the same interface as the browser adapter (the FS object in index.html), backed by Node fs in the main process.
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('writer', {
  pick: () => call('lib:pick'), resume: () => call('lib:resume'), forget: () => call('lib:forget'),
  list: () => call('fs:list'), read: p => call('fs:read', p), write: (p, t) => call('fs:write', p, t), remove: p => call('fs:remove', p), rename: (a, b) => call('fs:rename', a, b), mkdir: p => call('fs:mkdir', p),
  watch: cb => { const h = () => cb(null); ipcRenderer.on('lib:changed', h); return () => ipcRenderer.removeListener('lib:changed', h); },
  reveal: p => call('lib:reveal', p), libraryPath: () => call('lib:path')
});
// Dictation: start/stop the Speech.framework helper (desktop/src/dictate.js) and receive its events as window.dictate.
contextBridge.exposeInMainWorld('dictate', {
  available: () => call('dictate:available'), start: lang => call('dictate:start', lang), stop: () => call('dictate:stop'),
  on: cb => { const h = (e, ev) => cb(ev); ipcRenderer.on('dictate:event', h); return () => ipcRenderer.removeListener('dictate:event', h); }
});
