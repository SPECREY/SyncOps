// SYNC OPS — daily task launcher for learning game development.
// Main process: window, data storage, opening links/apps, autostart.
const { app, BrowserWindow, ipcMain, Notification, dialog, shell, protocol, session } = require('electron');
const { Readable } = require('stream');
const IS_WIN = process.platform === 'win32';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const APP_ID = 'sync-ops';

// Walkman: music files are served through a private "syncmusic://" scheme (with byte ranges so seeking works).
protocol.registerSchemesAsPrivileged([{ scheme: 'syncmusic', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }]);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let win = null;
const launchedByAutostart = process.argv.includes('--autostart');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
}

// ---------- storage ----------
const dataFile = () => path.join(app.getPath('userData'), 'data.json');

function loadData() {
  try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); }
  catch { return null; }
}
function saveData(data) {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dataFile());
  return true;
}

// ---------- clean environment for launched programs ----------
// When running as an AppImage, the bundle injects variables that can break
// other programs. Strip them before launching anything.
function cleanEnv() {
  const env = { ...process.env };
  const appdir = env.APPDIR;
  for (const k of ['APPDIR', 'APPIMAGE', 'ARGV0', 'OWD', 'CHROME_DESKTOP', 'ELECTRON_RUN_AS_NODE', 'GDK_BACKEND_ORIG']) delete env[k];
  if (appdir) {
    for (const k of ['PATH', 'LD_LIBRARY_PATH', 'XDG_DATA_DIRS', 'GSETTINGS_SCHEMA_DIR', 'PYTHONPATH', 'PERLLIB', 'QT_PLUGIN_PATH']) {
      if (!env[k]) continue;
      const parts = env[k].split(':').filter(p => p && !p.startsWith(appdir));
      if (parts.length) env[k] = parts.join(':'); else delete env[k];
    }
  }
  return env;
}

function runDetached(cmd, args, cwd) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore', env: cleanEnv(), cwd: cwd || os.homedir() });
      child.on('error', (e) => resolve({ ok: false, error: e.message }));
      child.unref();
      setTimeout(() => resolve({ ok: true }), 250);
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

// ---------- installed applications (.desktop files) ----------
function desktopDirs() {
  const home = os.homedir();
  const dataDirs = (process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':');
  const dirs = [
    path.join(home, '.local/share/applications'),
    path.join(home, '.local/share/flatpak/exports/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
    '/var/lib/snapd/desktop/applications',
    '/usr/share/applications',
    '/usr/local/share/applications',
    ...dataDirs.map(d => path.join(d, 'applications')),
  ];
  return [...new Set(dirs)].filter(d => !process.env.APPDIR || !d.startsWith(process.env.APPDIR));
}

function parseDesktop(text) {
  const out = {};
  let inMain = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) { inMain = line === '[Desktop Entry]'; continue; }
    if (!inMain || !line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    if (k in out) continue;
    out[k] = line.slice(i + 1).trim();
  }
  return out;
}

// Windows: read Start Menu shortcuts (.lnk) from the user and all-users folders.
function listAppsWindows() {
  const roots = [
    path.join(process.env.APPDATA || '', 'Microsoft/Windows/Start Menu/Programs'),
    path.join(process.env.ProgramData || 'C:/ProgramData', 'Microsoft/Windows/Start Menu/Programs'),
  ];
  const skip = /uninstall|readme|help|documentation|release notes|license|website/i;
  const seen = new Map();
  const walk = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 3) walk(p, depth + 1); continue; }
      if (!/\.(lnk|url)$/i.test(e.name)) continue;
      const name = e.name.replace(/\.(lnk|url)$/i, '');
      if (skip.test(name) || seen.has(name.toLowerCase())) continue;
      seen.set(name.toLowerCase(), { id: name.toLowerCase() + '.lnk', name, exec: p, comment: path.basename(dir), categories: '', win: true });
    }
  };
  roots.forEach(r => walk(r, 0));
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function listApps() {
  if (IS_WIN) return listAppsWindows();
  const seen = new Map();
  for (const dir of desktopDirs()) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.desktop') || seen.has(f)) continue;
      try {
        const e = parseDesktop(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (e.Type !== 'Application' || !e.Exec) continue;
        if (e.NoDisplay === 'true' || e.Hidden === 'true') continue;
        seen.set(f, { id: f, name: e.Name || f.replace('.desktop', ''), exec: e.Exec, comment: e.Comment || '', categories: e.Categories || '' });
      } catch { /* unreadable */ }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function shQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

function buildCommand(exec, arg) {
  let used = false;
  let cmd = exec.replace(/%[fFuU]/g, () => {
    if (arg && !used) { used = true; return shQuote(arg); }
    return '';
  });
  cmd = cmd.replace(/%[ick]/g, '').replace(/%%/g, '%');
  if (arg && !used) cmd += ' ' + shQuote(arg);
  return cmd.trim();
}

const winQuote = (s) => '"' + String(s).replace(/"/g, '') + '"';
function runShellWin(cmd) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, { shell: true, detached: true, stdio: 'ignore', windowsHide: true, cwd: os.homedir() });
      child.on('error', (e) => resolve({ ok: false, error: e.message }));
      child.unref(); setTimeout(() => resolve({ ok: true }), 250);
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}
async function launchAppWindows(entry) {
  if (entry.custom) return runShellWin(entry.arg ? `${entry.exec} ${winQuote(entry.arg)}` : entry.exec);
  if (!entry.arg) {
    const err = await shell.openPath(entry.exec);
    return err ? { ok: false, error: err } : { ok: true };
  }
  // Open a file/folder with this app: resolve the shortcut target and pass the path to it
  try {
    const link = shell.readShortcutLink(entry.exec);
    return runShellWin(`start "" ${winQuote(link.target)} ${link.args || ''} ${winQuote(entry.arg)}`);
  } catch {
    const err = await shell.openPath(entry.exec);
    return err ? { ok: false, error: err } : { ok: true };
  }
}

async function launchApp(entry) {
  // entry: { exec, arg, custom }
  if (!entry || !entry.exec) return { ok: false, error: 'No command' };
  if (IS_WIN) return launchAppWindows(entry);
  const cmd = entry.custom ? (entry.arg ? entry.exec + ' ' + shQuote(entry.arg) : entry.exec) : buildCommand(entry.exec, entry.arg);
  return runDetached('/bin/sh', ['-c', cmd]);
}

async function openUrl(url) {
  if (!/^(https?:\/\/|file:\/\/)/i.test(url)) url = 'https://' + url;
  if (IS_WIN) { try { await shell.openExternal(url); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } }
  return runDetached('xdg-open', [url]);
}
async function openPath(p) {
  if (IS_WIN) { const err = await shell.openPath(p); return err ? { ok: false, error: err } : { ok: true }; }
  return runDetached('xdg-open', [p]);
}

// ---------- start with computer ----------
const autostartFile = () => path.join(os.homedir(), '.config/autostart', APP_ID + '.desktop');

function selfCommand() {
  if (process.env.APPIMAGE) {
    const launcher = path.join(path.dirname(process.env.APPIMAGE), 'launch.sh');
    if (fs.existsSync(launcher)) return `bash ${shQuote(launcher)}`;
  }
  if (process.env.APPIMAGE) return `env APPIMAGE_EXTRACT_AND_RUN=1 ${shQuote(process.env.APPIMAGE)} --no-sandbox`;
  if (app.isPackaged) return `${shQuote(process.execPath)} --no-sandbox`;
  return `${shQuote(process.execPath)} ${shQuote(app.getAppPath())} --no-sandbox`;
}

function setAutostart(enabled) {
  if (IS_WIN) {
    try { app.setLoginItemSettings({ openAtLogin: !!enabled, args: ['--autostart'] }); return { ok: true, enabled: !!enabled }; }
    catch (e) { return { ok: false, error: e.message }; }
  }
  try {
    if (!enabled) { fs.rmSync(autostartFile(), { force: true }); return { ok: true, enabled: false }; }
    fs.mkdirSync(path.dirname(autostartFile()), { recursive: true });
    fs.writeFileSync(autostartFile(), [
      '[Desktop Entry]', 'Type=Application', 'Name=Sync Ops',
      'Comment=Opens today\'s learning tasks',
      `Exec=sh -c "sleep 8; ${selfCommand().replace(/"/g, '\\"')} --autostart"`,
      'X-GNOME-Autostart-enabled=true', 'Terminal=false', '',
    ].join('\n'));
    return { ok: true, enabled: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 640, ...(process.env.WIN_SIZE ? { width: +process.env.WIN_SIZE.split("x")[0], height: +process.env.WIN_SIZE.split("x")[1] } : {}),
    backgroundColor: '#050505', autoHideMenuBar: true, title: 'SYNC OPS',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { openUrl(url); return { action: 'deny' }; });
}

ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_e, d) => saveData(d));
ipcMain.handle('apps:list', () => listApps());
ipcMain.handle('apps:launch', (_e, entry) => launchApp(entry));
ipcMain.handle('url:open', (_e, url) => openUrl(url));
ipcMain.handle('path:open', (_e, p) => openPath(p));
ipcMain.handle('autostart:set', (_e, on) => setAutostart(on));
ipcMain.handle('autostart:get', () => IS_WIN ? app.getLoginItemSettings({ args: ['--autostart'] }).openAtLogin : fs.existsSync(autostartFile()));
ipcMain.handle('env:info', () => ({ launchedByAutostart, home: os.homedir(), dataFile: dataFile() }));
ipcMain.handle('notify', (_e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
  if (win) { win.show(); win.focus(); win.flashFrame(true); }
  return true;
});
ipcMain.handle('dialog:pick', async (_e, kind) => {
  const opts = { properties: [kind === 'folder' ? 'openDirectory' : 'openFile'] };
  if (kind === 'audio') opts.filters = [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'opus'] }];
  const r = await dialog.showOpenDialog(win, opts);
  return r.canceled ? null : r.filePaths[0];
});
// Read a user-chosen sound file (max 8 MB) so the page can decode it.
ipcMain.handle('audio:read', (_e, p) => {
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > 8 * 1024 * 1024) return null;
    return fs.readFileSync(p).toString('base64');
  } catch { return null; }
});

// ---------- Walkman: music folder ----------
const AUDIO_EXT = /\.(mp3|ogg|oga|opus|flac|wav|m4a|aac|webm)$/i;
const MIME = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm' };
const musicRoots = new Set();
function defaultMusicDir() {
  let base; try { base = app.getPath('music'); } catch { base = path.join(os.homedir(), 'Music'); }
  const dir = path.join(base, 'SyncOps');
  fs.mkdirSync(dir, { recursive: true });
  const readme = path.join(dir, 'PUT YOUR MUSIC HERE.txt');
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, 'Copy MP3, FLAC, OGG, WAV or M4A files (or folders of them) into this folder.\nThen press RESCAN in the SyncOps Walkman.\n');
  return dir;
}
function scanMusic(dir) {
  const tracks = [];
  if (!dir || !fs.existsSync(dir)) return { ok: false, error: 'Folder not found', tracks };
  musicRoots.add(path.resolve(dir));
  const walk = (d, depth) => {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 4) walk(p, depth + 1); }
      else if (AUDIO_EXT.test(e.name)) tracks.push({ path: p, name: e.name.replace(AUDIO_EXT, ''), folder: path.relative(dir, d) });
      if (tracks.length >= 5000) return;
    }
  };
  walk(dir, 0);
  tracks.sort((a, b) => (a.folder + '/' + a.name).localeCompare(b.folder + '/' + b.name, undefined, { numeric: true }));
  return { ok: true, tracks };
}
function insideMusicRoot(p) {
  const r = path.resolve(p);
  for (const root of musicRoots) if (r === root || r.startsWith(root + path.sep)) return true;
  return false;
}
function serveMusic(request) {
  try {
    const u = new URL(request.url);
    const p = decodeURIComponent(u.pathname.slice(1));
    if (!AUDIO_EXT.test(p) || !insideMusicRoot(p)) return new Response('forbidden', { status: 403 });
    const size = fs.statSync(p).size;
    const type = MIME[p.split('.').pop().toLowerCase()] || 'application/octet-stream';
    const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
    const range = request.headers.get('range');
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
      if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      end = Math.min(end, size - 1);
      return new Response(Readable.toWeb(fs.createReadStream(p, { start, end })), { status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
    }
    return new Response(Readable.toWeb(fs.createReadStream(p)), { status: 200, headers: { ...base, 'Content-Length': String(size) } });
  } catch (e) { return new Response('not found', { status: 404 }); }
}
ipcMain.handle('music:default', () => defaultMusicDir());
ipcMain.handle('music:scan', (_e, dir) => scanMusic(dir));

// ---------- Walkman: YouTube ----------
// YouTube's embedded player refuses to play without a Referer; pages loaded from files have none, so add one.
function fixYouTubeReferer() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.ytimg.com/*', '*://*.googlevideo.com/*'] },
    (d, cb) => {
      if (!d.requestHeaders.Referer && !d.requestHeaders.referer) d.requestHeaders.Referer = 'https://syncops.app/';
      cb({ requestHeaders: d.requestHeaders });
    });
}
let ytWin = null;
ipcMain.handle('yt:popout', (_e, url) => {
  if (!/^https:\/\/(www\.)?youtube\.com\//.test(url)) return false;
  if (ytWin && !ytWin.isDestroyed()) { ytWin.loadURL(url); ytWin.show(); return true; }
  ytWin = new BrowserWindow({ width: 560, height: 380, title: 'SyncOps Walkman · YouTube', backgroundColor: '#000', autoHideMenuBar: true, alwaysOnTop: true,
    icon: path.join(__dirname, 'build', 'icon.png'), webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  ytWin.webContents.setWindowOpenHandler(({ url }) => { openUrl(url); return { action: 'deny' }; });
  ytWin.loadURL(url);
  ytWin.on('closed', () => { ytWin = null; });
  return true;
});

app.whenReady().then(() => {
  protocol.handle('syncmusic', serveMusic);
  fixYouTubeReferer();
  createWindow();
});
app.on('window-all-closed', () => app.quit());

// Dev-only: SHOT=/path.png captures a screenshot after load (used for testing).
if (process.env.SHOT) {
  app.whenReady().then(() => setTimeout(async () => {
    try {
      if (process.env.SHOT_JS) await win.webContents.executeJavaScript(process.env.SHOT_JS);
      await new Promise(r => setTimeout(r, 1200));
      if (process.env.SHOT_EVAL) console.log('EVAL', JSON.stringify(await win.webContents.executeJavaScript(process.env.SHOT_EVAL)));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.SHOT, img.toPNG());
    } catch (e) { console.error(e); }
    app.quit();
  }, Number(process.env.SHOT_DELAY || 3500)));
}
