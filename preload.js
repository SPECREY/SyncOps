const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('ops', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (d) => ipcRenderer.invoke('data:save', d),
  listApps: () => ipcRenderer.invoke('apps:list'),
  launchApp: (entry) => ipcRenderer.invoke('apps:launch', entry),
  openUrl: (url) => ipcRenderer.invoke('url:open', url),
  openPath: (p) => ipcRenderer.invoke('path:open', p),
  setAutostart: (on) => ipcRenderer.invoke('autostart:set', on),
  getAutostart: () => ipcRenderer.invoke('autostart:get'),
  envInfo: () => ipcRenderer.invoke('env:info'),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  pick: (kind) => ipcRenderer.invoke('dialog:pick', kind),
  readAudio: (p) => ipcRenderer.invoke('audio:read', p),
  setZoom: (f) => webFrame.setZoomFactor(f),
  musicDefault: () => ipcRenderer.invoke('music:default'),
  musicScan: (dir) => ipcRenderer.invoke('music:scan', dir),
  ytPopout: (url) => ipcRenderer.invoke('yt:popout', url),
  platform: process.platform,
});
