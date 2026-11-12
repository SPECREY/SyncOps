'use strict';
// SYNC OPS renderer. All state lives in `S` and is saved through window.ops.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const KINDS = { code: 'CODE', art: 'ART', game: 'GAME BUILD', study: 'STUDY', other: 'OTHER' };
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; };
const calm = () => S && S.settings.calm;

// Movement break ideas. Physical activity is linked to better executive function in ADHD (see SYSTEM > Evidence).
const MOVES = [
  'Stand up and walk around the room for the whole break.',
  '20 jumping jacks, then shake out your arms.',
  'Go get a glass of water — walk, do not scroll.',
  '10 squats + a slow neck and shoulder stretch.',
  'Climb the stairs once, or march in place for 60 seconds.',
  'Stretch: reach up high, then touch your toes, 5 times.',
];

// Philosopher quotes — all from public-domain translations, checked for correct attribution.
const QUOTES = [
  { q: 'Men are disturbed not by the things which happen, but by the opinions about the things.', a: 'Epictetus', s: 'Enchiridion 5 · tr. G. Long' },
  { q: 'Hold every hour in your grasp.', a: 'Seneca', s: 'Letters to Lucilius, 1 · tr. R. M. Gummere' },
  { q: 'While we are postponing, life speeds by.', a: 'Seneca', s: 'Letters to Lucilius, 1 · tr. R. M. Gummere' },
  { q: 'No great thing is produced suddenly, since not even the bunch of grapes or the fig is.', a: 'Epictetus', s: 'Discourses I.15 · tr. G. Long' },
  { q: 'First say to yourself what you would be; and then do what you have to do.', a: 'Epictetus', s: 'Discourses III.23 · tr. G. Long' },
  { q: 'The things we have to learn before we can do them, we learn by doing them.', a: 'Aristotle', s: 'Nicomachean Ethics II · tr. W. D. Ross' },
  { q: 'The beginning is the most important part of any work.', a: 'Plato', s: 'Republic II · tr. B. Jowett' },
  { q: 'Learning without thought is labour lost; thought without learning is perilous.', a: 'Confucius', s: 'Analects II.15 · tr. J. Legge' },
  { q: 'The journey of a thousand li commenced with a single step.', a: 'Laozi', s: 'Tao Te Ching 64 · tr. J. Legge' },
  { q: 'Confine thyself to the present.', a: 'Marcus Aurelius', s: 'Meditations VII.29 · tr. G. Long' },
  { q: 'Do every act of thy life as if it were the last.', a: 'Marcus Aurelius', s: 'Meditations II.5 · tr. G. Long' },
  { q: 'Wherever a man may be, he can live well.', a: 'Marcus Aurelius', s: 'Meditations V.16 · tr. G. Long' },
];

const POINTS = { step: 10, chunk: 25, task: 50, recall: 15, ontask: 5 };

let S = null;          // saved state
let APPS = [];         // installed apps
let ENV = {};
let view = 'hub';

function defaults() {
  return {
    version: 2,
    settings: {
      calm: false, sound: true, volume: 0.7, attentionSpan: 25, cueEvery: 10, breakMin: 5, briefingSeen: '',
      noise: 'off', noiseVol: 0.12, zoom: 1, hud: 'high', custom: { click: '', alarm: '', complete: '' }, reminders: true,
    },
    tasks: [], log: {}, parked: [], autoOpened: '',
    hub: { apps: [], links: [] },               // pinned apps/links for the hub
    walkman: { dir: '', vol: 0.7, shuffle: false, repeat: 'all', lastPath: '', playlists: [] },
    points: 0, pointsLog: [],                   // { at, pts, why }
    rewards: [], redeemed: [],                  // rewards: { id, name, cost }
    recall: [],                                  // { id, taskId, day, text }
    reminded: {},                                // reminded[day] = [taskIds]
  };
}

function findApp(...needles) {
  for (const n of needles) {
    const a = APPS.find(x => x.id.toLowerCase().includes(n) || x.name.toLowerCase().includes(n));
    if (a) return { name: a.name, exec: a.exec, id: a.id, arg: '' };
  }
  return null;
}

function seedTasks() {
  const vscode = findApp('code.desktop', 'visual studio code', 'vscodium');
  const krita = findApp('krita');
  const hub = findApp('unityhub', 'unity hub');
  return [
    {
      id: uid(), title: 'C# Fundamentals', kind: 'code', order: 0, startTime: '',
      links: [{ label: 'Code Monkey C# tutorials (replace with your exact course link)', url: 'https://www.youtube.com/results?search_query=code+monkey+c%23+tutorial' }],
      apps: vscode ? [vscode] : [],
      steps: [
        { id: uid(), text: 'Open the next lesson where you stopped' },
        { id: uid(), text: 'Watch one section — pause whenever code appears' },
        { id: uid(), text: 'Type the code yourself in the editor and run it' },
        { id: uid(), text: 'Write one sentence about what you learned' },
      ],
      days: [1, 2, 3, 4, 5], autoOpen: true, estimate: 45, chunk: 0,
      ifThen: { when: 'I sit down at my desk', then: 'I press ENGAGE on C# before opening anything else' },
    },
    {
      id: uid(), title: 'Drawing Lesson', kind: 'art', order: 1, startTime: '',
      links: [], apps: krita ? [krita] : [],
      steps: [
        { id: uid(), text: 'Paste your drawing tutorial link into this task (EDIT)' },
        { id: uid(), text: 'Warm up: 5 minutes of lines and circles' },
        { id: uid(), text: 'Follow the lesson exercise' },
        { id: uid(), text: 'Save the drawing with today\'s date' },
      ],
      days: [0, 1, 2, 3, 4, 5, 6], autoOpen: false, estimate: 30, chunk: 0,
      ifThen: { when: 'I finish the C# session', then: 'I open the drawing lesson right after a short break' },
    },
    {
      id: uid(), title: 'Unity Practice', kind: 'game', order: 2, startTime: '',
      links: [], apps: hub ? [hub] : [],
      steps: [
        { id: uid(), text: 'Open your practice project' },
        { id: uid(), text: 'Use today\'s C# idea in one small script' },
        { id: uid(), text: 'Press Play and test it' },
        { id: uid(), text: 'Save the scene and project' },
      ],
      days: [1, 3, 5], autoOpen: false, estimate: 30, chunk: 0,
      ifThen: { when: 'I learn a new C# concept', then: 'I try it in Unity the same day' },
    },
  ];
}
function seedRewards() {
  return [
    { id: uid(), name: 'One episode of a show I like', cost: 150 },
    { id: uid(), name: '30 minutes of a video game', cost: 250 },
    { id: uid(), name: 'Favourite snack or drink', cost: 120 },
    { id: uid(), name: 'Buy a small asset / brush pack', cost: 1000 },
  ];
}

// ---------- persistence ----------
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => window.ops.save(S), 150); }
function todayLog() { return (S.log[dayKey()] ||= {}); }
function taskLog(id) { return (todayLog()[id] ||= { steps: [], done: false, seconds: 0, on: 0, off: 0 }); }
function todaysTasks() {
  const wd = new Date().getDay();
  return S.tasks.filter(t => t.days.includes(wd)).sort((a, b) => a.order - b.order);
}
function taskProgress(t) {
  const L = taskLog(t.id);
  if (L.done) return 1;
  if (!t.steps.length) return 0;
  return t.steps.filter(s => L.steps.includes(s.id)).length / t.steps.length;
}
function addPoints(pts, why, el) {
  S.points += pts; S.pointsLog.push({ at: Date.now(), pts, why });
  if (S.pointsLog.length > 400) S.pointsLog.splice(0, S.pointsLog.length - 400);
  save(); refreshChrome();
  if (!calm()) popText(`+${pts} PTS`, el);
}

// =====================================================================
// SOUND — original synthesized sound kit (Web Audio), plus optional user files
// =====================================================================
const SND = { ctx: null, master: null, custom: {}, noise: null };
function audio() {
  if (!SND.ctx) {
    SND.ctx = new AudioContext();
    const comp = SND.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    SND.master = SND.ctx.createGain(); SND.master.gain.value = S.settings.volume;
    SND.master.connect(comp).connect(SND.ctx.destination);
  }
  if (SND.ctx.state === 'suspended') SND.ctx.resume();
  return SND.ctx;
}
function tone({ f = 880, f2 = null, d = 0.08, type = 'square', v = 0.1, at = 0, lp = 0, attack = 0.003 }) {
  const c = audio(), t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  let node = o.connect(g);
  if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; node = g.connect(fl); node.connect(SND.master); }
  else g.connect(SND.master);
  o.start(t0); o.stop(t0 + d + 0.03);
}
function noiseBurst({ d = 0.03, v = 0.08, at = 0, hp = 2000, bp = 0 }) {
  const c = audio(), t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * d));
  const buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const fl = c.createBiquadFilter(); fl.type = bp ? 'bandpass' : 'highpass'; fl.frequency.value = bp || hp;
  const g = c.createGain(); g.gain.value = v;
  src.connect(fl).connect(g).connect(SND.master); src.start(t0);
}
function playCustom(key) {
  const buf = SND.custom[key]; if (!buf) return false;
  const c = audio(), src = c.createBufferSource(); src.buffer = buf; src.connect(SND.master); src.start(); return true;
}
const sfx = {
  // Click: transient snap + falling pitched blip + low thump — punchy terminal key
  click() {
    if (!S.settings.sound || playCustom('click')) return;
    noiseBurst({ d: 0.018, v: 0.12, hp: 3500 });
    tone({ f: 2400, f2: 1100, d: 0.045, type: 'square', v: 0.06 });
    tone({ f: 160, f2: 60, d: 0.07, type: 'sine', v: 0.18 });
  },
  hover() { if (!S.settings.sound || calm()) return; tone({ f: 3200, d: 0.012, type: 'square', v: 0.012 }); },
  nav() {
    if (!S.settings.sound) return;
    noiseBurst({ d: 0.02, v: 0.1, hp: 3000 });
    [1400, 1900].forEach((f, i) => tone({ f, d: 0.04, type: 'square', v: 0.05, at: i * 0.045 }));
    if (!calm()) for (let i = 0; i < 6; i++) tone({ f: 600 + Math.random() * 2600, d: 0.015, type: 'square', v: 0.018, at: 0.1 + i * 0.022 });
  },
  step() {
    if (!S.settings.sound) return;
    tone({ f: 1320, d: 0.06, type: 'square', v: 0.06 }); tone({ f: 1980, d: 0.12, type: 'square', v: 0.05, at: 0.06 });
    tone({ f: 2640, d: 0.16, type: 'triangle', v: 0.05, at: 0.12 });
  },
  engage() {
    if (!S.settings.sound) return;
    noiseBurst({ d: 0.35, v: 0.06, bp: 1200 });
    [220, 330, 440, 660, 880].forEach((f, i) => tone({ f, d: 0.12, type: 'sawtooth', v: 0.05, at: i * 0.06, lp: 3000 }));
    tone({ f: 55, f2: 40, d: 0.5, type: 'sine', v: 0.25, at: 0.05 });
  },
  complete() {
    if (!S.settings.sound || playCustom('complete')) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.5, type: 'triangle', v: 0.07, at: i * 0.09, attack: 0.01 }));
    tone({ f: 1568, d: 0.8, type: 'sine', v: 0.05, at: 0.4, attack: 0.02 });
  },
  chime() {
    if (!S.settings.sound) return;
    [660, 880, 1320].forEach((f, i) => tone({ f, d: 0.5, type: 'sine', v: 0.09, at: i * 0.2, attack: 0.01 }));
  },
  // Alarm: two-tone emergency klaxon (soft chime instead in calm mode)
  alarm() {
    if (!S.settings.sound) return;
    if (calm()) return sfx.chime();
    if (playCustom('alarm')) return;
    for (let i = 0; i < 4; i++) {
      tone({ f: 740, d: 0.22, type: 'sawtooth', v: 0.07, at: i * 0.5, lp: 2200, attack: 0.01 });
      tone({ f: 988, d: 0.22, type: 'sawtooth', v: 0.07, at: i * 0.5 + 0.25, lp: 2200, attack: 0.01 });
    }
  },
  cue() { if (!S.settings.sound) return; tone({ f: 520, d: 0.14, type: 'sine', v: 0.08 }); tone({ f: 780, d: 0.18, type: 'sine', v: 0.08, at: 0.18 }); },
  chatter() {
    if (!S.settings.sound || calm()) return;
    for (let i = 0; i < 10; i++) tone({ f: 800 + Math.random() * 3000, d: 0.012, type: 'square', v: 0.014, at: i * 0.028 });
  },
  boot() {
    if (!S.settings.sound) return;
    tone({ f: 40, f2: 90, d: 1.2, type: 'sawtooth', v: 0.12, lp: 400, attack: 0.3 });
    for (let i = 0; i < 14; i++) tone({ f: 900 + Math.random() * 2400, d: 0.015, type: 'square', v: 0.02, at: 0.2 + i * 0.07 });
    tone({ f: 880, d: 0.4, type: 'triangle', v: 0.08, at: 1.2 }); tone({ f: 1320, d: 0.5, type: 'triangle', v: 0.06, at: 1.3 });
  },
};
async function loadCustomSounds() {
  SND.custom = {};
  for (const [k, p] of Object.entries(S.settings.custom || {})) {
    if (!p) continue;
    try {
      const b64 = await window.ops.readAudio(p); if (!b64) continue;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      SND.custom[k] = await audio().decodeAudioData(bytes.buffer);
    } catch { /* bad file — fall back to built-in */ }
  }
}

// Background noise (white / pink / brown) — looped generated buffer
function setNoise(kind) {
  S.settings.noise = kind; save();
  $$('.noise-btn').forEach(b => b.classList.toggle('on', b.dataset.noise === kind));
  if (SND.noise) { try { SND.noise.src.stop(); } catch { } SND.noise = null; }
  if (kind === 'off' || $('#focus').classList.contains('hidden')) return;
  const c = audio(), len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') ch[i] = w * 0.5;
    else if (kind === 'pink') {
      b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
      b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
      ch[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * 0.11; b6 = w * .115926;
    } else { last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.5; }
  }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const g = c.createGain(); g.gain.value = S.settings.noiseVol;
  src.connect(g).connect(c.destination); src.start();
  SND.noise = { src, g };
}

// =====================================================================
// VISUAL FX
// =====================================================================
function popText(text, el, color) {
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2 - 60, top: innerHeight / 2 };
  const pop = document.createElement('div'); pop.className = 'sync-pop'; pop.textContent = text;
  if (color) pop.style.color = color;
  pop.style.left = (r.left + 20) + 'px'; pop.style.top = (r.top - 10) + 'px';
  document.body.appendChild(pop); setTimeout(() => pop.remove(), 1100);
}
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$';
function scramble(el, dur = 420) {
  if (calm() || !el) return;
  const final = el.textContent; if (!final || final.length > 60) return;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), n = Math.floor(final.length * p);
    el.textContent = final.slice(0, n) + [...final.slice(n)].map(ch => ch === ' ' ? ' ' : GLYPHS[Math.random() * GLYPHS.length | 0]).join('');
    if (p < 1) requestAnimationFrame(step); else el.textContent = final;
  };
  requestAnimationFrame(step);
}
function flashRed() {
  if (calm()) return;
  document.body.classList.remove('red-flash'); void document.body.offsetWidth; document.body.classList.add('red-flash');
}
function wipe() {
  if (calm()) return;
  const w = $('#wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
}

// Animated background: drifting contour lines, crosshairs, radar sweep
const BG = { t: 0, raf: 0, last: 0 };
function bgLoop(ts) {
  BG.raf = requestAnimationFrame(bgLoop);
  if (ts - BG.last < 40) return; BG.last = ts;
  const cv = $('#bgfx'), g = cv.getContext('2d');
  if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
  const W = cv.width, H = cv.height; BG.t += 0.006;
  g.clearRect(0, 0, W, H);
  // contour lines (green/red), like a topographic scan
  for (let k = 0; k < 16; k++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 18) {
      const y = H * 0.55 + k * 22 + Math.sin(x * 0.004 + BG.t * 2 + k * 0.35) * 46 + Math.sin(x * 0.011 - BG.t * 3 + k) * 14 - k * k * 1.5;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.strokeStyle = k % 5 === 0 ? 'rgba(227,18,31,0.22)' : 'rgba(76,255,138,0.07)';
    g.lineWidth = 1; g.stroke();
  }
  // crosshairs
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let x = 96; x < W; x += 192) for (let y = 96; y < H; y += 192) {
    g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke();
  }
  // radar sweep, top-right
  const cx = W - 140, cy = 210, R = 120, a = BG.t * 6;
  g.strokeStyle = 'rgba(227,18,31,0.25)';
  [R, R * 0.66, R * 0.33].forEach(r => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); });
  const grad = g.createConicGradient ? g.createConicGradient(a, cx, cy) : null;
  if (grad) {
    grad.addColorStop(0, 'rgba(227,18,31,0.28)'); grad.addColorStop(0.12, 'rgba(227,18,31,0)'); grad.addColorStop(1, 'rgba(227,18,31,0)');
    g.fillStyle = grad; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  }
}
function setBg() {
  cancelAnimationFrame(BG.raf);
  const cv = $('#bgfx');
  if (calm()) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
  BG.raf = requestAnimationFrame(bgLoop);
}

// Ticker + side code column
function hex(n) { return Array.from({ length: n }, () => '0123456789ABCDEF'[Math.random() * 16 | 0]).join(''); }
function updateTicker() {
  const t = todaysTasks();
  const bits = [
    `SYNC ${$('#syncPct').textContent}`, `PTS ${S.points}`,
    ...t.map(x => `${x.title.toUpperCase()} :: ${taskLog(x.id).done ? 'COMPLETE' : 'STANDBY'}`),
    `PARKED ${S.parked.filter(p => !p.done).length}`, `ADDR 0x${hex(6)}`, 'ALL SYSTEMS NOMINAL', `CHK ${hex(4)}-${hex(4)}`,
  ];
  $('#tickerText').textContent = ('   ///   ' + bits.join('   ///   ')).repeat(3);
}
const CODE_WORDS = ['SYNAPSE-L', 'SYNAPSE-R', 'MOTOR', 'SENSORY', 'CORTEX', 'BUFFER', 'STACK', 'HEAP', 'VECTOR3', 'QUATERNION', 'RIGIDBODY', 'SHADER', 'MESH', 'PREFAB', 'UPDATE()', 'START()', 'AWAKE()', 'TRANSFORM', 'COLLIDER', 'SPRITE'];
function updateSideCode() {
  const lines = [];
  for (let i = 0; i < 40; i++) lines.push(`${CODE_WORDS[Math.random() * CODE_WORDS.length | 0].padEnd(11)} ${hex(4)} ${Math.random() > 0.8 ? 'ERR' : 'OK '}`);
  $('#sideCode').textContent = lines.join('\n');
}

// ---------- toast ----------
let toastT;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('err', err); t.classList.remove('hidden');
  t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ---------- top bar ----------
function tickClock() {
  const d = new Date();
  $('#clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('#dateText').textContent = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${DAYS[d.getDay()]}`;
}
function refreshChrome() {
  const tasks = todaysTasks();
  const p = tasks.length ? tasks.reduce((a, t) => a + taskProgress(t), 0) / tasks.length : 0;
  $('#syncFill').style.width = (p * 100).toFixed(1) + '%';
  $('#syncPct').textContent = (p * 100).toFixed(1) + '%';
  const done = tasks.filter(t => taskLog(t.id).done).length;
  $('#hexDone').textContent = done;
  $('#hexLeft').textContent = tasks.length - done;
  const sec = Object.values(todayLog()).reduce((a, l) => a + (l.seconds || 0), 0);
  $('#hexMin').textContent = Math.round(sec / 60);
  $('#ptsTop').textContent = `· ${S.points} PTS`;
  const open = S.parked.filter(x => !x.done).length;
  $('#parkedCount').textContent = open || '';
  $('#calmBtn').textContent = 'CALM MODE: ' + (S.settings.calm ? 'ON' : 'OFF');
  $('#calmBtn').classList.toggle('on', S.settings.calm);
  document.body.classList.toggle('calm', S.settings.calm);
}

// =====================================================================
// VIEWS
// =====================================================================
function setView(v) {
  if (v !== view) { sfx.nav(); wipe(); }
  view = v;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  render();
}
function render() {
  refreshChrome();
  const el = $('#view');
  const fn = { hub: viewHub, today: viewToday, ops: viewOps, parked: viewParked, walkman: viewWalkman, rewards: viewRewards, record: viewRecord, system: viewSystem }[view];
  el.innerHTML = fn();
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  bindView(el);
  if (view === 'walkman') bindWalkman(el); else placeDock();
  scramble($('.view-title .vt', el));
  $$('.title-card', el).forEach(t => scramble(t, 500));
}

function resChips(t) {
  const out = [];
  t.links.forEach(l => out.push(`<span class="res">▸ ${esc(l.label || l.url)}</span>`));
  t.apps.forEach(a => out.push(`<span class="res app">◆ ${esc(a.name)}${a.arg ? ' · ' + esc(a.arg.split('/').pop()) : ''}</span>`));
  if (!out.length) out.push('<span class="res warn">NO LINKS OR APPS YET — EDIT TO ADD</span>');
  return `<div class="res-list">${out.join('')}</div>`;
}
const head = (small, title, right = '') => `<div class="view-head"><div class="view-title"><small>${small}</small><span class="vt">${title}</span></div><div class="spacer"></div>${right}</div>`;

function quoteOfDay(offset = 0) {
  const d = new Date(); const n = Math.floor(d.getTime() / 86400000) + offset;
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
let quoteOffset = 0;

// ---------- HUB ----------
function hubAppList() {
  // today's task apps + pinned apps, de-duplicated by command
  const seen = new Set(), list = [];
  todaysTasks().forEach(t => t.apps.forEach(a => {
    const k = a.exec + '|' + (a.arg || ''); if (seen.has(k)) return; seen.add(k);
    list.push({ ...a, from: t.title });
  }));
  S.hub.apps.forEach(a => { const k = a.exec + '|' + (a.arg || ''); if (seen.has(k)) return; seen.add(k); list.push({ ...a, pinned: true }); });
  return list;
}
function viewHub() {
  const q = quoteOfDay(quoteOffset);
  const apps = hubAppList();
  const tasks = todaysTasks();
  const next = tasks.find(t => !taskLog(t.id).done);
  const links = [...tasks.flatMap(t => t.links.map(l => ({ ...l, from: t.title }))), ...S.hub.links.map(l => ({ ...l, pinned: true }))];
  let html = head(`${DAYS[new Date().getDay()]} // COMMAND HUB`, 'HUB', `<button class="btn ghost" data-act="pin-app">+ PIN APP</button><button class="btn ghost" data-act="pin-link">+ PIN LINK</button>`);
  html += `<div class="quote-panel">
      <div class="q-hz hazard"></div>
      <div class="q-body"><div class="micro red">TRANSMISSION // DAILY DIRECTIVE</div>
        <div class="q-text">“${esc(q.q)}”</div>
        <div class="q-by">— ${esc(q.a)} <span>· ${esc(q.s)}</span></div></div>
      <button class="btn small ghost" data-act="next-quote" title="Another quote">NEXT ▸</button>
    </div>`;

  html += `<div class="hub-grid">
    <div class="panel hub-next">
      <div class="panel-label">NEXT OPERATION</div>
      ${next ? `<div class="title-card sm">${esc(next.title)}</div>
        <div class="micro" style="margin:6px 0 12px">${KINDS[next.kind]} · ${next.estimate} MIN${next.startTime ? ' · START ' + esc(next.startTime) : ''}</div>
        <button class="btn engage" data-act="engage" data-id="${next.id}">ENGAGE</button>`
      : `<div class="title-card sm">${tasks.length ? 'All done today.' : 'Nothing scheduled.'}</div>`}
    </div>
    <div class="panel hub-stats">
      <div class="panel-label">STATUS</div>
      <div class="stat-mini"><b>${tasks.filter(t => taskLog(t.id).done).length}/${tasks.length}</b><span>OPERATIONS</span></div>
      <div class="stat-mini"><b>${S.points}</b><span>POINTS</span></div>
      <div class="stat-mini"><b>${S.parked.filter(p => !p.done).length}</b><span>PARKED</span></div>
    </div>
  </div>`;

  html += `<div class="hub-section"><div class="panel-label">APPS FOR TODAY <span class="micro">— FROM TODAY'S TASKS + YOUR PINS</span></div>
    ${apps.length ? `<div class="app-tiles">${apps.map((a, i) => `<button class="app-tile ${a.pinned ? 'pinned' : ''}" data-act="hub-launch" data-i="${i}" style="--d:${i * 40}ms">
        <span class="at-hex"></span><span class="at-code mono">UNIT-${pad(i + 1)}</span>
        <span class="at-name">${esc(a.name)}</span><span class="at-sub mono">${a.pinned ? 'PINNED' : esc(a.from)}${a.arg ? ' · ' + esc(a.arg.split('/').pop()) : ''}</span>
        ${a.pinned ? `<span class="at-x" data-act="unpin-app" data-i="${S.hub.apps.findIndex(p => p.exec === a.exec && (p.arg || '') === (a.arg || ''))}" title="Unpin">✕</span>` : ''}
      </button>`).join('')}</div>
      <div style="margin-top:12px"><button class="btn" data-act="launch-all">LAUNCH ALL APPS ▸▸</button></div>`
      : '<div class="empty micro">NO APPS YET — PIN ONE OR ADD APPS TO A TASK</div>'}
  </div>`;

  html += `<div class="hub-section"><div class="panel-label">LINKS FOR TODAY</div>
    ${links.length ? `<div class="link-rows">${links.map((l, i) => `<button class="link-row" data-act="hub-link" data-i="${i}"><span class="mono red">▸</span> ${esc(l.label || l.url)} <span class="micro">${l.pinned ? 'PINNED' : esc(l.from)}</span>
      ${l.pinned ? `<span class="at-x" data-act="unpin-link" data-i="${S.hub.links.findIndex(p => p.url === l.url)}">✕</span>` : ''}</button>`).join('')}</div>`
      : '<div class="empty micro">NO LINKS FOR TODAY</div>'}
  </div>`;
  return html;
}

// ---------- TODAY ----------
function viewToday() {
  const tasks = todaysTasks();
  const today = dayKey();
  let html = head(`${DAYS[new Date().getDay()]} // OPERATIONS SCHEDULED: ${tasks.length}`, 'TODAY', `<button class="btn ghost" data-act="new">+ NEW OPERATION</button>`);

  if (S.settings.briefingSeen !== today && tasks.length) {
    const openParked = S.parked.filter(p => !p.done).length;
    html += `<div class="briefing">
      <div style="flex:1"><div class="micro" style="color:var(--cyan)">DAILY BRIEFING</div>
        <div class="bt">Here is today. You only need to start the first one.</div>
        <ul>${tasks.map(t => `<li>${esc(t.title)} — about ${t.estimate || '?'} min${t.startTime ? ' · starts ' + esc(t.startTime) : ''}</li>`).join('')}
        ${openParked ? `<li style="color:var(--cyan)">${openParked} parked thought(s) waiting — check them after your first task</li>` : ''}</ul></div>
      <button class="btn" data-act="brief-ok">GOT IT</button></div>`;
  }
  if (!tasks.length) {
    return html + `<div class="empty"><div class="title-card">No operations today.</div>
      <p class="micro">REST DAY — OR ADD A TASK FOR TODAY</p><button class="btn" data-act="new">+ NEW OPERATION</button></div>`;
  }
  const next = tasks.find(t => !taskLog(t.id).done);
  if (next) {
    const L = taskLog(next.id);
    const doneSteps = next.steps.filter(s => L.steps.includes(s.id)).length;
    const curStep = next.steps.find(s => !L.steps.includes(s.id));
    html += `<div class="panel next">
      <div>
        <div class="panel-label">NEXT OPERATION — ONE THING AT A TIME</div>
        <div><span class="kind ${next.kind}">${KINDS[next.kind] || 'OTHER'}</span></div>
        <div class="title-card" style="margin-top:6px">${esc(next.title)}</div>
        ${next.ifThen?.when ? `<div class="ifthen">IF <b>${esc(next.ifThen.when)}</b> → THEN <b>${esc(next.ifThen.then)}</b></div>` : ''}
        <div class="meta"><span>EST <b>${next.estimate || '?'} MIN</b></span><span>CHUNKS OF <b>${next.chunk || S.settings.attentionSpan} MIN</b></span>
          <span>STEPS <b>${doneSteps}/${next.steps.length}</b></span>${next.startTime ? `<span>START <b>${esc(next.startTime)}</b></span>` : ''}${L.seconds ? `<span>DONE SO FAR <b>${Math.round(L.seconds / 60)} MIN</b></span>` : ''}</div>
        ${curStep ? `<div class="ifthen" style="color:var(--green);margin-top:10px">FIRST TINY STEP ▸ <span style="color:var(--text)">${esc(curStep.text)}</span></div>` : ''}
        ${resChips(next)}
      </div>
      <div class="next-actions">
        <button class="btn engage" data-act="engage" data-id="${next.id}">ENGAGE</button>
        <button class="btn" data-act="tiny" data-id="${next.id}" title="Can't get started? Commit to just 5 minutes.">CAN'T START? 5-MIN MODE</button>
        <button class="btn" data-act="open" data-id="${next.id}">ONLY OPEN LINKS + APPS</button>
        <button class="btn ghost" data-act="later" data-id="${next.id}">MOVE TO END OF QUEUE</button>
        <button class="btn ghost" data-act="edit" data-id="${next.id}">EDIT</button>
      </div></div>`;
  } else {
    html += `<div class="panel" style="text-align:center;padding:30px">
      <div class="micro green">ALL OPERATIONS COMPLETE</div>
      <div class="title-card" style="transform-origin:center">Mission accomplished.</div>
      <p class="mono" style="color:var(--muted)">Everything for today is done. Rest counts as training too.</p></div>`;
  }
  html += `<div class="queue"><div class="panel-label">QUEUE</div>`;
  tasks.forEach((t, i) => {
    const L = taskLog(t.id);
    const n = t.steps.filter(s => L.steps.includes(s.id)).length;
    html += `<div class="q-row ${L.done ? 'done' : ''}" style="--d:${i * 50}ms"><div class="lamp"></div>
      <div><div class="qt">${esc(t.title)}</div><div class="qm">${KINDS[t.kind] || ''} · ${t.estimate || '?'} MIN · ${n}/${t.steps.length} STEPS${t.startTime ? ' · ' + esc(t.startTime) : ''}${t.autoOpen ? ' · AUTO-OPEN' : ''}</div></div>
      ${L.done ? `<button class="btn small ghost" data-act="undo" data-id="${t.id}">UNDO</button>` : `<button class="btn small" data-act="engage" data-id="${t.id}">ENGAGE</button>`}
      <button class="btn small ghost" data-act="edit" data-id="${t.id}">EDIT</button></div>`;
  });
  return html + '</div>';
}

function viewOps() {
  let html = head('EVERY TASK YOU HAVE SET UP', 'ALL OPERATIONS', `<button class="btn" data-act="new">+ NEW OPERATION</button>`);
  if (!S.tasks.length) return html + `<div class="empty"><div class="title-card">Nothing here yet.</div><button class="btn" data-act="new">+ NEW OPERATION</button></div>`;
  html += '<div class="ops-grid">';
  [...S.tasks].sort((a, b) => a.order - b.order).forEach((t, i, arr) => {
    html += `<div class="panel op-card" style="--d:${i * 50}ms">
      <div class="row gap"><span class="kind ${t.kind}" style="font-family:var(--mono);font-size:13px;border:1px solid;padding:1px 6px">${KINDS[t.kind]}</span>
        ${t.autoOpen ? '<span class="micro" style="color:var(--cyan)">AUTO-OPEN</span>' : ''}${t.startTime ? `<span class="micro red">⏰ ${esc(t.startTime)}</span>` : ''}</div>
      <div class="ot">${esc(t.title)}</div>
      <div class="days">${DAYS.map((d, k) => `<span class="${t.days.includes(k) ? 'on' : ''}">${d[0]}${d[1]}</span>`).join('')}</div>
      <div class="micro">${t.estimate || '?'} MIN · ${t.steps.length} STEPS · ${t.links.length} LINKS · ${t.apps.length} APPS</div>
      <div class="row gap wrap" style="margin-top:4px">
        <button class="btn small" data-act="edit" data-id="${t.id}">EDIT</button>
        <button class="btn small ghost" data-act="open" data-id="${t.id}">TEST OPEN</button>
        <button class="btn small ghost" data-act="up" data-id="${t.id}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn small ghost" data-act="down" data-id="${t.id}" ${i === arr.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn small ghost" data-act="dup" data-id="${t.id}">COPY</button>
        <button class="btn small danger" data-act="del" data-id="${t.id}">DELETE</button>
      </div></div>`;
  });
  return html + '</div>';
}

function viewParked() {
  const items = [...S.parked].sort((a, b) => (a.done - b.done) || (b.at - a.at));
  let html = head('DISTRACTIONS YOU WROTE DOWN INSTEAD OF FOLLOWING', 'PARKED THOUGHTS') +
    `<p class="mono" style="color:var(--muted);margin-top:0">When something pops into your head mid-task, park it here and keep going. Come back after the timer and decide: do it, schedule it, or delete it.</p>
    <div class="row gap" style="margin-bottom:16px"><input type="text" id="parkInput" placeholder="Park a thought…"><button class="btn" data-act="park-add">PARK</button></div>`;
  if (!items.length) return html + '<div class="empty micro">NOTHING PARKED</div>';
  items.forEach((p, i) => {
    const d = new Date(p.at);
    html += `<div class="park-item ${p.done ? 'done' : ''}" style="--d:${i * 30}ms"><input type="checkbox" data-act="park-toggle" data-id="${p.id}" ${p.done ? 'checked' : ''} style="accent-color:var(--orange)">
      <div>${esc(p.text)}${p.task ? ` <small>· during ${esc(p.task)}</small>` : ''}</div>
      <small>${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}</small>
      <button class="btn small ghost" data-act="park-del" data-id="${p.id}">✕</button></div>`;
  });
  if (items.some(p => p.done)) html += `<div style="margin-top:12px"><button class="btn small ghost" data-act="park-clear">CLEAR CHECKED</button></div>`;
  return html;
}

// ---------- REWARDS ----------
function viewRewards() {
  const todayPts = S.pointsLog.filter(p => dayKey(new Date(p.at)) === dayKey() && p.pts > 0).reduce((a, p) => a + p.pts, 0);
  let html = head('EARN POINTS, SPEND THEM ON REAL REWARDS YOU CHOOSE', 'REWARDS') +
    `<div class="stat-row">
      <div class="panel stat"><div class="panel-label">POINTS AVAILABLE</div><b>${S.points}</b></div>
      <div class="panel stat"><div class="panel-label">EARNED TODAY</div><b>${todayPts}</b></div>
      <div class="panel stat"><div class="panel-label">HOW TO EARN</div><div class="mono" style="font-size:14px;line-height:1.7">STEP +${POINTS.step} · CHUNK +${POINTS.chunk}<br>TASK DONE +${POINTS.task} · RECALL +${POINTS.recall}<br>"ON TARGET" CHECK +${POINTS.ontask}</div></div>
    </div>
    <div class="panel"><div class="panel-label">REWARD MENU — MAKE THESE THINGS YOU ACTUALLY WANT</div>
    ${S.rewards.map((r, i) => `<div class="reward-row" style="--d:${i * 40}ms">
      <div class="rw-name">${esc(r.name)}</div><div class="mono rw-cost">${r.cost} PTS</div>
      <div class="rw-bar"><i style="width:${Math.min(100, S.points / r.cost * 100)}%"></i></div>
      <button class="btn small ${S.points >= r.cost ? 'go' : 'ghost'}" data-act="redeem" data-id="${r.id}" ${S.points >= r.cost ? '' : 'disabled'}>CLAIM</button>
      <button class="btn small ghost" data-act="rw-del" data-id="${r.id}">✕</button></div>`).join('') || '<div class="micro">NO REWARDS YET</div>'}
    <div class="row gap" style="margin-top:12px"><input type="text" id="rwName" placeholder="New reward (e.g. order pizza)"><input type="number" id="rwCost" min="10" value="200" style="width:110px"><button class="btn" data-act="rw-add">ADD</button></div>
    </div>
    ${S.redeemed.length ? `<div class="panel" style="margin-top:18px"><div class="panel-label">CLAIMED</div>${S.redeemed.slice(-10).reverse().map(r => `<div class="mono" style="font-size:15px;padding:4px 0">${new Date(r.at).toLocaleDateString()} — ${esc(r.name)} (${r.cost})</div>`).join('')}</div>` : ''}`;
  return html;
}

// ---------- RECORD ----------
function viewRecord() {
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const tasks = [...S.tasks].sort((a, b) => a.order - b.order);
  let weekSec = 0, weekDone = 0, on = 0, off = 0;
  days.slice(-7).forEach(d => Object.values(S.log[dayKey(d)] || {}).forEach(l => { weekSec += l.seconds || 0; if (l.done) weekDone++; on += l.on || 0; off += l.off || 0; }));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const any = Object.values(S.log[dayKey(d)] || {}).some(l => l.done);
    if (any) streak++; else if (i > 0) break;
  }
  const rows = [];
  Object.entries(S.log).forEach(([day, tl]) => Object.entries(tl).forEach(([id, l]) => {
    if (l.done && l.estimate && l.seconds > 60) {
      const t = S.tasks.find(x => x.id === id);
      rows.push({ day, title: t ? t.title : '(deleted)', est: l.estimate, act: Math.round(l.seconds / 60) });
    }
  }));
  rows.sort((a, b) => b.day.localeCompare(a.day));
  const ratio = rows.length ? rows.reduce((a, r) => a + r.act / r.est, 0) / rows.length : null;

  let html = head('WHAT YOU ACTUALLY DID', 'RECORD') + `
  <div class="stat-row four">
    <div class="panel stat"><div class="panel-label">FOCUS · 7 DAYS</div><b>${Math.round(weekSec / 60)}<span style="font-size:18px"> MIN</span></b></div>
    <div class="panel stat"><div class="panel-label">TASKS DONE · 7 DAYS</div><b>${weekDone}</b></div>
    <div class="panel stat"><div class="panel-label">DAY STREAK</div><b>${streak}</b></div>
    <div class="panel stat"><div class="panel-label">ON TARGET AT CHECKS · 7 DAYS</div><b>${on + off ? Math.round(on / (on + off) * 100) + '%' : '--'}</b></div>
  </div>
  <div class="panel" style="margin-bottom:18px"><div class="panel-label">LAST 14 DAYS</div>
  <div class="rec-grid" style="grid-template-columns: 180px repeat(14, 1fr)">
    <div class="c h"></div>${days.map(d => `<div class="c h">${DAYS[d.getDay()][0]}${d.getDate()}</div>`).join('')}`;
  tasks.forEach(t => {
    html += `<div class="c t">${esc(t.title)}</div>`;
    days.forEach(d => {
      const l = (S.log[dayKey(d)] || {})[t.id];
      const sched = t.days.includes(d.getDay());
      if (l?.done) html += '<div class="c full">■</div>';
      else if (l && (l.steps.length || l.seconds)) html += '<div class="c part">▪</div>';
      else html += `<div class="c">${sched ? '·' : ''}</div>`;
    });
  });
  html += `</div><p class="micro" style="margin-top:8px">■ FINISHED · ▪ STARTED · · SCHEDULED. MISSED DAYS ARE DATA, NOT FAILURE — JUST START THE NEXT ONE.</p></div>
  <div class="two">
  <div class="panel"><div class="panel-label">TIME ESTIMATE CHECK</div>
  ${ratio ? `<p class="mono" style="font-size:17px">On average your tasks take <b class="orange">${ratio.toFixed(1)}×</b> what you planned. ${ratio > 1.2 ? 'Try multiplying your next estimates by this number.' : ratio < 0.8 ? 'You finish faster than you plan — nice.' : 'Your estimates are close. Good calibration.'}</p>` :
      '<p class="mono" style="color:var(--muted)">Finish a few tasks with focus mode and this will show how long things really take compared to your guess.</p>'}
  ${rows.length ? `<table class="est"><tr><th>DATE</th><th>TASK</th><th>PLANNED</th><th>ACTUAL</th></tr>${rows.slice(0, 10).map(r => `<tr><td>${r.day}</td><td>${esc(r.title)}</td><td>${r.est} MIN</td><td class="${r.act > r.est * 1.2 ? 'red' : 'green'}">${r.act} MIN</td></tr>`).join('')}</table>` : ''}
  </div>
  <div class="panel"><div class="panel-label">LEARNING JOURNAL — YOUR RECALL NOTES</div>
  ${S.recall.length ? S.recall.slice(-12).reverse().map(r => { const t = S.tasks.find(x => x.id === r.taskId); return `<div class="journal-item"><div class="micro">${r.day} · ${esc(t ? t.title : '')}</div><div class="mono">${esc(r.text)}</div></div>`; }).join('')
      : '<p class="mono" style="color:var(--muted)">After each task you write what you remember without looking. Those notes show up here, and as a warm-up quiz next time.</p>'}
  </div></div>`;
  return html;
}

function viewSystem() {
  const s = S.settings;
  const cs = (k, label) => `<div class="custom-snd"><span class="mono">${label}</span><span class="micro cs-path">${s.custom[k] ? esc(s.custom[k].split('/').pop()) : 'BUILT-IN'}</span>
    <button class="btn small ghost" data-act="snd-pick" data-k="${k}">CHOOSE FILE</button>${s.custom[k] ? `<button class="btn small ghost" data-act="snd-clear" data-k="${k}">RESET</button>` : ''}<button class="btn small ghost" data-act="snd-test" data-k="${k}">TEST</button></div>`;
  return head('SETTINGS AND HOW THIS APP WORKS', 'SYSTEM') + `
  <div class="two">
    <div class="panel">
      <div class="panel-label">STARTUP + REMINDERS</div>
      <label class="toggle"><input type="checkbox" id="setAuto"> START SYNC OPS WHEN I LOG IN</label>
      <p class="micro" style="margin:6px 0 16px 28px;line-height:1.5">TASKS MARKED "AUTO-OPEN" LAUNCH AFTER A 10-SECOND COUNTDOWN YOU CAN CANCEL.</p>
      <label class="toggle"><input type="checkbox" id="setRem" ${s.reminders ? 'checked' : ''}> ALARM AT A TASK'S START TIME</label>
      <p class="micro" style="margin:6px 0 16px 28px;line-height:1.5">SET A START TIME IN A TASK'S EDIT SCREEN.</p>
      <label class="toggle"><input type="checkbox" id="setCalm" ${s.calm ? 'checked' : ''}> CALM MODE (NO SCANLINES, FLASHING OR ANIMATION)</label>
      <div class="field" style="margin-top:18px"><span class="lbl">TEXT SIZE</span>
        <div class="row gap wrap">${[[1, 'NORMAL'], [1.1, 'LARGE'], [1.2, 'X-LARGE'], [1.35, 'HUGE']].map(([z, n]) => `<button class="btn small ${Math.abs(s.zoom - z) < .01 ? 'go' : 'ghost'}" data-act="zoom" data-z="${z}">${n}</button>`).join('')}</div>
        <span class="hint">Makes everything in the app bigger. Ctrl + / Ctrl − also work.</span></div>
      <div class="field"><span class="lbl">BACKGROUND HUD EFFECTS</span>
        <div class="row gap wrap">${['off', 'low', 'high'].map(l => `<button class="btn small ${s.hud === l ? 'go' : 'ghost'}" data-act="hud" data-l="${l}">${l.toUpperCase()}</button>`).join('')}</div>
        <span class="hint">Flashing warning boxes, hexagons and data readouts behind the screens. Flashes stay at about 2 per second or slower.</span></div>
    </div>
    <div class="panel">
      <div class="panel-label">FOCUS TIMING</div>
      <div class="field"><label for="setSpan">ATTENTION SPAN (MINUTES PER CHUNK)</label>
        <div class="row gap"><input type="number" id="setSpan" min="3" max="90" value="${s.attentionSpan}" style="width:100px"><button class="btn small" data-act="measure">MEASURE MINE</button></div>
        <span class="hint">Work is split into chunks this long, with a break between. Measure it on a boring task, then set it.</span></div>
      <div class="field"><label for="setCue">ATTENTION CHECK EVERY (MINUTES, 0 = OFF)</label>
        <input type="number" id="setCue" min="0" max="60" value="${s.cueEvery}" style="width:100px">
        <span class="hint">A soft prompt asks if you were on target. Your answers show in RECORD.</span></div>
      <div class="field"><label for="setBreak">BREAK LENGTH (MINUTES)</label>
        <input type="number" id="setBreak" min="1" max="30" value="${s.breakMin}" style="width:100px"></div>
    </div>
  </div>
  <div class="panel" style="margin-top:18px"><div class="panel-label">SOUND</div>
    <div class="row gap wrap"><label class="toggle"><input type="checkbox" id="setSound" ${s.sound ? 'checked' : ''}> SOUND EFFECTS</label>
      <span class="micro" style="margin-left:20px">VOLUME</span><input type="range" id="setVol" min="0" max="1" step="0.05" value="${s.volume}" style="width:200px">
      <button class="btn small ghost" data-act="snd-demo">PLAY DEMO</button></div>
    <p class="micro" style="line-height:1.6">ALL BUILT-IN SOUNDS ARE ORIGINAL AND GENERATED BY THE APP. YOU CAN REPLACE THREE OF THEM WITH SOUND FILES OF YOUR OWN:</p>
    ${cs('click', 'CLICK')}${cs('alarm', 'ALARM')}${cs('complete', 'TASK COMPLETE')}
  </div>
  <div class="panel" style="margin-top:18px"><div class="panel-label">WHY THE APP WORKS THIS WAY — EVIDENCE</div>
  <ul class="evidence">
    <li><b>ONE TASK LIST, REVIEWED DAILY · TASKS BROKEN INTO STEPS</b> — core skills in the CBT program for adult ADHD by Safren and colleagues (Massachusetts General Hospital), tested in randomized controlled trials. <a href="#" data-url="https://pmc.ncbi.nlm.nih.gov/articles/PMC3874265">Source</a></li>
    <li><b>CHUNKS SIZED TO YOUR ATTENTION SPAN · PARKED THOUGHTS · INTERVAL ALARMS · START-TIME ALARMS</b> — the same program's distractibility module: measure your span, split work into chunks that fit it, write distractions down for later, and use alarms as cues. <a href="#" data-url="https://pmc.ncbi.nlm.nih.gov/articles/PMC3874265">Source</a></li>
    <li><b>ATTENTION CHECKS YOU ANSWER (SELF-MONITORING)</b> — students with ADHD symptoms used an interval timer to record whether they were on task, aiming to reduce off-task behavior. Most of this research is with school-age children. <a href="#" data-url="https://www.pubmed.gov/30889976/">Source</a></li>
    <li><b>RECALL CHECK + WARM-UP QUIZ</b> — retrieval practice (testing yourself instead of re-reading) helped college students with and without ADHD remember more on a final test (Minear et al., 2023). <a href="#" data-url="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1186566/full">Source</a></li>
    <li><b>WHITE / PINK NOISE</b> — a 2024 meta-analysis (13 studies, children and college-age young adults) found a small benefit on task performance for people with ADHD symptoms. Safe volume levels are not established yet, so keep it quiet. No brown-noise studies were found. <a href="#" data-url="https://pmc.ncbi.nlm.nih.gov/articles/PMC11283987/">Source</a></li>
    <li><b>POINTS + A REWARD MENU YOU CHOOSE</b> — token systems help when points buy real rewards; one app that only tracked ratings without real rewards did not change behavior. Evidence is mostly from children. <a href="#" data-url="https://behavioristbookclub.com/aba-research/school-classroom/designing-an-ipad-app-to-monitor-and-improve-classroom-behavior-for-ch/">Source</a></li>
    <li><b>TIME ESTIMATE CHECK</b> — the CBT program's thinking module targets over-optimistic thoughts about how long tasks take. <a href="#" data-url="https://pmc.ncbi.nlm.nih.gov/articles/PMC3874265">Source</a></li>
    <li><b>IF–THEN PLANS</b> — "implementation intentions" improved self-control and goal pursuit in studies of children with ADHD (Gawrilow, Gollwitzer, Oettingen). <a href="#" data-url="https://www.socmot.uni-konstanz.de/node/96">Source</a></li>
    <li><b>VISIBLE TIMER · STUFF OPENED FOR YOU</b> — Barkley's clinical principles: make time and information external, and help at the "point of performance". <a href="#" data-url="https://continuingedcourses.net/course/adhd-goes-to-school-providing-teachers-and-parents-with-specific-management-strategies/">Source</a></li>
    <li><b>INSTANT FEEDBACK (SYNC RATE, POINTS)</b> — ADHD is linked to a strong preference for immediate over delayed rewards (Sonuga-Barke). <a href="#" data-url="https://eprints.soton.ac.uk/210968">Source</a></li>
    <li><b>MOVEMENT BREAKS</b> — meta-analyses of trials found exercise improves executive function in children and teens with ADHD. <a href="#" data-url="https://pmc.ncbi.nlm.nih.gov/articles/PMC10080114">Source</a></li>
    <li><b>NOT INCLUDED: BODY DOUBLING</b> — popular online, but no peer-reviewed controlled trials in adults with ADHD yet. <a href="#" data-url="https://arxiv.org/html/2509.12153v1">Source</a></li>
  </ul>
  <p class="micro" style="line-height:1.6">THIS APP IS A STUDY TOOL, NOT TREATMENT. IF ADHD IS AFFECTING YOUR LIFE A LOT, A DOCTOR OR PSYCHOLOGIST CAN HELP.</p></div>
  <div class="panel" style="margin-top:18px"><div class="panel-label">DATA</div>
    <p class="mono" style="font-size:14px;color:var(--muted)">SAVED AT: ${esc(ENV.dataFile || '')} · ${APPS.length} INSTALLED APPS DETECTED.</p></div>`;
}

// ---------- view events ----------
function bindView(el) {
  el.onclick = async (e) => {
    const a = e.target.closest('[data-act], [data-url]');
    if (!a) return;
    if (a.dataset.url) { e.preventDefault(); window.ops.openUrl(a.dataset.url); return; }
    e.stopPropagation();
    const id = a.dataset.id, t = S.tasks.find(x => x.id === id), i = +a.dataset.i;
    switch (a.dataset.act) {
      case 'new': openEditor(null); break;
      case 'edit': openEditor(t); break;
      case 'engage': engage(t); break;
      case 'tiny': engage(t, 5); break;
      case 'open': await openResources(t); break;
      case 'brief-ok': S.settings.briefingSeen = dayKey(); save(); render(); break;
      case 'later': { t.order = Math.max(...S.tasks.map(x => x.order)) + 1; normalizeOrder(); save(); render(); break; }
      case 'undo': taskLog(id).done = false; save(); render(); break;
      case 'up': case 'down': {
        const arr = [...S.tasks].sort((x, y) => x.order - y.order);
        const k = arr.indexOf(t), j = a.dataset.act === 'up' ? k - 1 : k + 1;
        if (j >= 0 && j < arr.length) { [arr[k], arr[j]] = [arr[j], arr[k]]; arr.forEach((x, n) => x.order = n); save(); render(); }
        break;
      }
      case 'dup': {
        const c = JSON.parse(JSON.stringify(t)); c.id = uid(); c.title += ' (copy)'; c.steps.forEach(s => s.id = uid());
        c.order = S.tasks.length; S.tasks.push(c); save(); render(); break;
      }
      case 'del':
        confirmAlert('DELETE OPERATION', `Delete "${t.title}"? Its history stays in RECORD.`, 'DELETE', () => {
          S.tasks = S.tasks.filter(x => x.id !== id); normalizeOrder(); save(); render();
        });
        break;
      case 'park-add': addParked($('#parkInput').value); $('#parkInput').value = ''; render(); break;
      case 'park-toggle': { const p = S.parked.find(x => x.id === id); p.done = a.checked; save(); render(); break; }
      case 'park-del': S.parked = S.parked.filter(x => x.id !== id); save(); render(); break;
      case 'park-clear': S.parked = S.parked.filter(x => !x.done); save(); render(); break;
      case 'measure': measureSpan(); break;
      case 'zoom': setZoom(+a.dataset.z); render(); break;
      case 'hud': S.settings.hud = a.dataset.l; save(); setHud(); render(); break;
      // hub
      case 'next-quote': quoteOffset++; render(); break;
      case 'hub-launch': { const app = hubAppList()[i]; sfx.engage(); flashTile(a); const r = await window.ops.launchApp(app); toast(r.ok ? `LAUNCHING ${app.name.toUpperCase()}` : `COULD NOT OPEN ${app.name}: ${r.error}`, !r.ok); break; }
      case 'launch-all': {
        sfx.engage(); const list = hubAppList();
        for (const app of list) { await window.ops.launchApp(app); await new Promise(r => setTimeout(r, 500)); }
        toast(`LAUNCHED ${list.length} APP(S)`); break;
      }
      case 'hub-link': {
        const tasks = todaysTasks();
        const links = [...tasks.flatMap(x => x.links), ...S.hub.links];
        window.ops.openUrl(links[i].url); sfx.click(); break;
      }
      case 'pin-app': pickAppDialog(app => { S.hub.apps.push(app); save(); render(); }); break;
      case 'pin-link': pinLinkDialog(); break;
      case 'unpin-app': S.hub.apps.splice(i, 1); save(); render(); break;
      case 'unpin-link': S.hub.links.splice(i, 1); save(); render(); break;
      // rewards
      case 'rw-add': {
        const name = $('#rwName').value.trim(), cost = Math.max(10, +$('#rwCost').value || 100);
        if (!name) { toast('NAME THE REWARD', true); return; }
        S.rewards.push({ id: uid(), name, cost }); save(); render(); break;
      }
      case 'rw-del': S.rewards = S.rewards.filter(r => r.id !== id); save(); render(); break;
      case 'redeem': {
        const r = S.rewards.find(x => x.id === id); if (!r || S.points < r.cost) return;
        S.points -= r.cost; S.redeemed.push({ at: Date.now(), name: r.name, cost: r.cost }); S.pointsLog.push({ at: Date.now(), pts: -r.cost, why: 'claim ' + r.name });
        save(); sfx.complete(); flashRed();
        const al = showAlert(`<div class="a-kicker">REWARD UNLOCKED</div><div class="a-title">${esc(r.name)}</div><div class="a-text">You earned this. Enjoy it fully — no guilt.</div><div class="a-btns"><button class="btn go" data-x="ok">NICE</button></div>`, true);
        al.onclick = (ev) => { if (ev.target.closest('[data-x]')) { hideAlert(); render(); } };
        break;
      }
      // sound
      case 'snd-pick': { const p = await window.ops.pick('audio'); if (p) { S.settings.custom[a.dataset.k] = p; save(); await loadCustomSounds(); render(); } break; }
      case 'snd-clear': S.settings.custom[a.dataset.k] = ''; save(); await loadCustomSounds(); render(); break;
      case 'snd-test': ({ click: sfx.click, alarm: sfx.alarm, complete: sfx.complete })[a.dataset.k](); break;
      case 'snd-demo': { const seq = [sfx.click, sfx.nav, sfx.step, sfx.engage, sfx.cue, sfx.complete, sfx.alarm]; seq.forEach((f, n) => setTimeout(f, n * 900)); break; }
    }
  };
  const pi = $('#parkInput', el);
  if (pi) pi.onkeydown = (e) => { if (e.key === 'Enter') { addParked(pi.value); pi.value = ''; render(); } };

  if (view === 'system') {
    window.ops.getAutostart().then(on => { const c = $('#setAuto'); if (c) c.checked = on; });
    $('#setAuto').onchange = async (e) => {
      const r = await window.ops.setAutostart(e.target.checked);
      toast(r.ok ? (r.enabled ? 'SYNC OPS WILL START WHEN YOU LOG IN' : 'AUTOSTART OFF') : 'COULD NOT CHANGE AUTOSTART: ' + r.error, !r.ok);
    };
    $('#setCalm').onchange = (e) => { S.settings.calm = e.target.checked; save(); refreshChrome(); setBg(); setHud(); };
    $('#setSound').onchange = (e) => { S.settings.sound = e.target.checked; save(); };
    $('#setRem').onchange = (e) => { S.settings.reminders = e.target.checked; save(); };
    $('#setVol').oninput = (e) => { S.settings.volume = +e.target.value; if (SND.master) SND.master.gain.value = S.settings.volume; save(); };
    $('#setVol').onchange = () => sfx.click();
    const num = (sel, key, min, max) => { $(sel).onchange = (e) => { S.settings[key] = Math.min(max, Math.max(min, Math.round(+e.target.value || min))); e.target.value = S.settings[key]; save(); refreshChrome(); }; };
    num('#setSpan', 'attentionSpan', 3, 90); num('#setCue', 'cueEvery', 0, 60); num('#setBreak', 'breakMin', 1, 30);
  }
}
function flashTile(el) { if (calm()) return; el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire'); }

function normalizeOrder() { [...S.tasks].sort((a, b) => a.order - b.order).forEach((t, i) => t.order = i); }
function addParked(text, task) {
  text = (text || '').trim(); if (!text) return false;
  S.parked.push({ id: uid(), text, at: Date.now(), done: false, task: task || '' }); save(); refreshChrome(); return true;
}

// ---------- opening resources ----------
async function openResources(t, quiet) {
  if (!t) return;
  const fails = [];
  if (!quiet) sfx.engage();
  for (const l of t.links) {
    if (!l.url) continue;
    const r = await window.ops.openUrl(l.url.trim()); if (!r.ok) fails.push(l.label || l.url);
    await new Promise(r => setTimeout(r, 500));
  }
  for (const a of t.apps) {
    const r = await window.ops.launchApp(a); if (!r.ok) fails.push(a.name);
    await new Promise(r => setTimeout(r, 500));
  }
  if (fails.length) toast('COULD NOT OPEN: ' + fails.join(', '), true);
  else if (!quiet) toast(`OPENED ${t.links.length} LINK(S) AND ${t.apps.length} APP(S) FOR ${t.title.toUpperCase()}`);
}

// ---------- small dialogs: pick app / pin link ----------
function modalShell(title, body, foot = '') {
  $('#modal').innerHTML = `<div class="modal-head"><div class="mt">${title}</div><div class="spacer"></div>
    <button class="btn small ghost" style="color:#000;border-color:#000" data-e="close">CLOSE ✕</button></div>
    <div class="modal-body">${body}</div><div class="modal-foot">${foot}</div>`;
  $('#modalWrap').classList.remove('hidden');
}
function pickAppDialog(onPick) {
  modalShell('PIN AN APP TO THE HUB', `<div class="field"><label for="pa">SEARCH INSTALLED APPS</label><input type="text" id="pa" placeholder="unity, code, krita, blender, discord…" autocomplete="off"></div>
    <div class="field"><label for="paArg">FILE OR FOLDER TO OPEN WITH IT (OPTIONAL)</label><div class="row gap"><input type="text" id="paArg"><button class="btn small ghost" data-e="pf">FOLDER</button><button class="btn small ghost" data-e="pfile">FILE</button></div></div>
    <div class="app-picker" id="paList"></div>`);
  const draw = () => {
    const q = $('#pa').value.trim().toLowerCase();
    const hits = APPS.filter(a => !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)).slice(0, 80);
    $('#paList').innerHTML = hits.map(a => `<button data-pick="${esc(a.id)}">${esc(a.name)}<small>${esc(a.id)}</small></button>`).join('') || '<div class="micro" style="padding:8px">NO MATCH</div>';
  };
  $('#pa').oninput = draw; draw(); setTimeout(() => $('#pa').focus(), 30);
  $('#modal').onclick = async (e) => {
    const p = e.target.closest('[data-pick]');
    if (p) { const a = APPS.find(x => x.id === p.dataset.pick); onPick({ name: a.name, exec: a.exec, id: a.id, arg: $('#paArg').value.trim() }); closeModal(); toast('PINNED ' + a.name.toUpperCase()); return; }
    const b = e.target.closest('[data-e]'); if (!b) return;
    if (b.dataset.e === 'close') closeModal();
    if (b.dataset.e === 'pf' || b.dataset.e === 'pfile') { const r = await window.ops.pick(b.dataset.e === 'pf' ? 'folder' : 'file'); if (r) $('#paArg').value = r; }
  };
}
function pinLinkDialog() {
  modalShell('PIN A LINK TO THE HUB', `<div class="two"><div class="field"><label for="plN">NAME</label><input type="text" id="plN" placeholder="Unity docs"></div>
    <div class="field"><label for="plU">URL</label><input type="text" id="plU" placeholder="https://docs.unity3d.com"></div></div>`,
    `<div class="spacer"></div><button class="btn go" data-e="ok">PIN LINK</button>`);
  setTimeout(() => $('#plN').focus(), 30);
  $('#modal').onclick = (e) => {
    const b = e.target.closest('[data-e]'); if (!b) return;
    if (b.dataset.e === 'close') return closeModal();
    const url = $('#plU').value.trim(); if (!url) { toast('ADD A URL', true); return; }
    S.hub.links.push({ label: $('#plN').value.trim(), url }); save(); closeModal(); render();
  };
}

// ---------- task editor ----------
function openEditor(task) {
  const isNew = !task;
  const t = task ? JSON.parse(JSON.stringify(task)) : {
    id: uid(), title: '', kind: 'code', links: [{ label: '', url: '' }], apps: [], steps: [{ id: uid(), text: '' }],
    days: [new Date().getDay()], autoOpen: false, estimate: 30, chunk: 0, ifThen: { when: '', then: '' }, order: S.tasks.length, startTime: '',
  };
  t.ifThen ||= { when: '', then: '' }; t.startTime ||= '';
  const m = $('#modal');

  const draw = () => {
    m.innerHTML = `<div class="modal-head"><div class="mt">${isNew ? 'NEW OPERATION' : 'EDIT OPERATION'}</div><div class="spacer"></div>
      <button class="btn small ghost" style="color:#000;border-color:#000" data-e="close">CLOSE ✕</button></div>
    <div class="modal-body">
      <div class="two">
        <div class="field"><label for="eTitle">TASK NAME</label><input type="text" id="eTitle" value="${esc(t.title)}" placeholder="e.g. C# lesson, Drawing practice"></div>
        <div class="field"><label for="eKind">TYPE</label><select id="eKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${t.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="field"><span class="lbl">LINKS TO OPEN (UDEMY, YOUTUBE, ANY WEBSITE)</span>
        ${t.links.map((l, i) => `<div class="item-row link"><input type="text" data-l="label" data-i="${i}" value="${esc(l.label)}" placeholder="Name (optional)">
          <input type="text" data-l="url" data-i="${i}" value="${esc(l.url)}" placeholder="https://www.udemy.com/course/…"><button class="btn small ghost" data-e="rmlink" data-i="${i}">✕</button></div>`).join('')}
        <div><button class="btn small" data-e="addlink">+ ADD LINK</button></div></div>
      <div class="field"><span class="lbl">APPS TO OPEN</span>
        ${t.apps.map((a, i) => `<div class="item-row app"><div class="mono" style="color:var(--cyan)">◆ ${esc(a.name)}</div>
          <div class="row gap"><input type="text" data-a="arg" data-i="${i}" value="${esc(a.arg || '')}" placeholder="File or folder to open with it (optional)">
            <button class="btn small ghost" data-e="pickfile" data-i="${i}">FILE</button><button class="btn small ghost" data-e="pickfolder" data-i="${i}">FOLDER</button></div>
          <button class="btn small ghost" data-e="rmapp" data-i="${i}">✕</button></div>`).join('')}
        <div class="row gap"><input type="text" id="appSearch" placeholder="Search installed apps: unity, code, krita, blender…" autocomplete="off"><button class="btn small ghost" data-e="custom">CUSTOM COMMAND</button></div>
        <div class="app-picker hidden" id="appPicker"></div>
        <span class="hint">Tip: for Unity, add Unity Hub. For VS Code, pick FOLDER to open your project folder.</span></div>
      <div class="field"><span class="lbl">STEPS — SMALL, CONCRETE ACTIONS (FIRST ONE SHOULD TAKE UNDER 2 MINUTES)</span>
        ${t.steps.map((s, i) => `<div class="item-row step"><span class="num">${i + 1}.</span><input type="text" data-s="${i}" value="${esc(s.text)}" placeholder="e.g. Open lesson 4">
          <button class="btn small ghost" data-e="sup" data-i="${i}">▲</button><button class="btn small ghost" data-e="sdown" data-i="${i}">▼</button><button class="btn small ghost" data-e="rmstep" data-i="${i}">✕</button></div>`).join('')}
        <div><button class="btn small" data-e="addstep">+ ADD STEP</button></div></div>
      <div class="field"><span class="lbl">IF–THEN PLAN (WHEN WILL YOU START?)</span>
        <div class="two"><input type="text" id="eWhen" value="${esc(t.ifThen.when)}" placeholder="IF / WHEN… (e.g. I finish dinner)">
        <input type="text" id="eThen" value="${esc(t.ifThen.then)}" placeholder="THEN I… (e.g. press ENGAGE on this task)"></div></div>
      <div class="field"><span class="lbl">DAYS</span>
        <div class="day-picks">${DAYS.map((d, k) => `<button type="button" data-e="day" data-k="${k}" class="${t.days.includes(k) ? 'on' : ''}">${d}</button>`).join('')}
          <button type="button" class="btn small ghost" data-e="alldays">EVERY DAY</button><button type="button" class="btn small ghost" data-e="weekdays">WEEKDAYS</button></div></div>
      <div class="four-col">
        <div class="field"><label for="eEst">TIME GUESS (MIN)</label><input type="number" id="eEst" min="1" value="${t.estimate || 30}"></div>
        <div class="field"><label for="eChunk">CHUNK (0 = MY SPAN: ${S.settings.attentionSpan})</label><input type="number" id="eChunk" min="0" value="${t.chunk || 0}"></div>
        <div class="field"><label for="eStart">START TIME ALARM</label><input type="time" id="eStart" value="${esc(t.startTime)}"></div>
        <div class="field"><span class="lbl">STARTUP</span><label class="toggle"><input type="checkbox" id="eAuto" ${t.autoOpen ? 'checked' : ''}> AUTO-OPEN</label></div>
      </div>
    </div>
    <div class="modal-foot">${isNew ? '' : '<button class="btn ghost" data-e="test">TEST OPEN</button>'}<div class="spacer"></div>
      <button class="btn ghost" data-e="close">CANCEL</button><button class="btn go" data-e="save">SAVE OPERATION</button></div>`;
    bindEditor();
  };
  const sync = () => {
    t.title = $('#eTitle').value; t.kind = $('#eKind').value;
    $$('[data-l]', m).forEach(inp => t.links[+inp.dataset.i][inp.dataset.l] = inp.value);
    $$('[data-a]', m).forEach(inp => t.apps[+inp.dataset.i].arg = inp.value);
    $$('[data-s]', m).forEach(inp => t.steps[+inp.dataset.s].text = inp.value);
    t.ifThen = { when: $('#eWhen').value, then: $('#eThen').value };
    t.estimate = Math.max(1, +$('#eEst').value || 30); t.chunk = Math.max(0, +$('#eChunk').value || 0);
    t.startTime = $('#eStart').value; t.autoOpen = $('#eAuto').checked;
  };
  const bindEditor = () => {
    const search = $('#appSearch'), picker = $('#appPicker');
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      if (!q) { picker.classList.add('hidden'); return; }
      const hits = APPS.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.comment.toLowerCase().includes(q)).slice(0, 40);
      picker.innerHTML = hits.length ? hits.map(a => `<button data-pick="${esc(a.id)}">${esc(a.name)}<small>${esc(a.id)}</small></button>`).join('') : '<div class="micro" style="padding:8px">NO MATCH — USE CUSTOM COMMAND</div>';
      picker.classList.remove('hidden');
    };
    picker.onclick = (e) => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      const a = APPS.find(x => x.id === b.dataset.pick);
      sync(); t.apps.push({ name: a.name, exec: a.exec, id: a.id, arg: '' }); draw();
    };
    m.onclick = async (e) => {
      const b = e.target.closest('[data-e]'); if (!b) return;
      const i = +b.dataset.i;
      sync();
      switch (b.dataset.e) {
        case 'close': closeModal(); return;
        case 'addlink': t.links.push({ label: '', url: '' }); break;
        case 'rmlink': t.links.splice(i, 1); break;
        case 'rmapp': t.apps.splice(i, 1); break;
        case 'addstep': t.steps.push({ id: uid(), text: '' }); break;
        case 'rmstep': t.steps.splice(i, 1); break;
        case 'sup': if (i > 0) [t.steps[i - 1], t.steps[i]] = [t.steps[i], t.steps[i - 1]]; break;
        case 'sdown': if (i < t.steps.length - 1) [t.steps[i + 1], t.steps[i]] = [t.steps[i], t.steps[i + 1]]; break;
        case 'day': { const k = +b.dataset.k; t.days = t.days.includes(k) ? t.days.filter(x => x !== k) : [...t.days, k].sort(); break; }
        case 'alldays': t.days = [0, 1, 2, 3, 4, 5, 6]; break;
        case 'weekdays': t.days = [1, 2, 3, 4, 5]; break;
        case 'pickfile': case 'pickfolder': { const p = await window.ops.pick(b.dataset.e === 'pickfolder' ? 'folder' : 'file'); if (p) t.apps[i].arg = p; break; }
        case 'custom': {
          const cmd = $('#appSearch').value.trim();
          if (!cmd) { toast('TYPE THE COMMAND IN THE SEARCH BOX FIRST, THEN PRESS CUSTOM COMMAND', true); return; }
          t.apps.push({ name: cmd, exec: cmd, custom: true, arg: '' }); break;
        }
        case 'test': await openResources(cleanTask(t)); return;
        case 'save': {
          const c = cleanTask(t);
          if (!c.title.trim()) { toast('GIVE THE TASK A NAME', true); $('#eTitle').focus(); return; }
          if (!c.days.length) { toast('PICK AT LEAST ONE DAY', true); return; }
          const idx = S.tasks.findIndex(x => x.id === c.id);
          if (idx >= 0) S.tasks[idx] = c; else S.tasks.push(c);
          save(); closeModal(); render(); sfx.step(); toast('OPERATION SAVED'); return;
        }
      }
      draw();
    };
  };
  draw();
  $('#modalWrap').classList.remove('hidden');
  setTimeout(() => $('#eTitle')?.focus(), 30);
}
function cleanTask(t) {
  const c = JSON.parse(JSON.stringify(t));
  c.title = c.title.trim();
  c.links = c.links.filter(l => l.url.trim()).map(l => ({ label: l.label.trim(), url: l.url.trim() }));
  c.steps = c.steps.filter(s => s.text.trim());
  return c;
}
function closeModal() { $('#modalWrap').classList.add('hidden'); $('#modal').innerHTML = ''; $('#modal').onclick = null; }

// ---------- alerts ----------
function showAlert(html, calmStyle = false) {
  const a = $('#alert');
  a.className = 'alert' + (calmStyle ? ' calm-alert' : '');
  a.innerHTML = `<div class="hz hazard ${calmStyle ? 'teal' : ''}"></div><div class="a-body">${html}</div><div class="hz hazard ${calmStyle ? 'teal' : ''}"></div>`;
  const w = $('#alertWrap'); w.classList.remove('hidden'); w.classList.toggle('red', !calmStyle);
  a.classList.remove('in'); void a.offsetWidth; a.classList.add('in');
  return a;
}
function hideAlert() { $('#alertWrap').classList.add('hidden'); $('#alert').innerHTML = ''; }
function confirmAlert(kicker, text, okLabel, onOk) {
  const a = showAlert(`<div class="a-kicker">${esc(kicker)}</div><div class="a-text" style="margin:16px 0">${esc(text)}</div>
    <div class="a-btns"><button class="btn ghost" data-x="no">CANCEL</button><button class="btn danger" data-x="ok">${esc(okLabel)}</button></div>`);
  a.onclick = (e) => { const b = e.target.closest('[data-x]'); if (!b) return; hideAlert(); if (b.dataset.x === 'ok') onOk(); };
}

// =====================================================================
// FOCUS MODE
// =====================================================================
const F = { task: null, chunkLen: 0, left: 0, running: false, timer: null, chunkNo: 1, sinceCue: 0, phase: 'work', breakLeft: 0 };

function engage(t, tinyMin) {
  if (!t) return;
  if (F.task && F.task.id === t.id && (F.running || F.phase === 'break')) { $('#focus').classList.remove('hidden'); return; }
  if (F.task && F.running) stopTimer();
  hideAlert(); closeModal();
  // Warm-up recall quiz: retrieval practice on what you wrote last time
  const last = S.recall.filter(r => r.taskId === t.id && r.day !== dayKey()).slice(-1)[0];
  if (last && !tinyMin) {
    const a = showAlert(`<div class="a-kicker">WARM-UP RECALL</div><div class="a-title">What did you learn last time?</div>
      <div class="a-text">Try to remember it in your head first — no peeking. Then reveal your note from ${esc(last.day)}.</div>
      <div class="recall-reveal hidden" id="rv">${esc(last.text)}</div>
      <div class="a-btns"><button class="btn" data-x="reveal">REVEAL MY NOTE</button><button class="btn go" data-x="go">START OPERATION</button></div>`, true);
    a.onclick = (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'reveal') { $('#rv').classList.remove('hidden'); b.remove(); sfx.step(); }
      else { hideAlert(); startEngage(t); }
    };
    return;
  }
  startEngage(t, tinyMin);
}
function startEngage(t, tinyMin) {
  F.task = t; F.chunkLen = (tinyMin || t.chunk || S.settings.attentionSpan) * 60; F.left = F.chunkLen; F.chunkNo = 1; F.sinceCue = 0; F.phase = 'work'; F.tiny = !!tinyMin;
  sfx.engage(); flashRed();
  $('#focus').classList.remove('hidden');
  $('#focus').classList.remove('enter'); void $('#focus').offsetWidth; $('#focus').classList.add('enter');
  $('#fTitle').textContent = t.title; scramble($('#fTitle'), 600);
  $('#fIfThen').innerHTML = tinyMin ? '<b>5-MINUTE MODE</b> — just start. You can stop after 5 minutes, or keep going.'
    : t.ifThen?.when ? `IF <b>${esc(t.ifThen.when)}</b> → THEN <b>${esc(t.ifThen.then)}</b>` : '';
  $('#fEst').textContent = `EST ${t.estimate || '?'} MIN`;
  $('#noiseVol').value = S.settings.noiseVol;
  drawSteps(); drawTimer(); startTimer();
  setNoise(S.settings.noise);
  openResources(t, true);
}

function drawSteps() {
  const t = F.task, L = taskLog(t.id);
  const cur = t.steps.find(s => !L.steps.includes(s.id));
  const n = t.steps.filter(s => L.steps.includes(s.id)).length;
  $('#fStepCount').textContent = t.steps.length ? `${n}/${t.steps.length}` : '';
  $('#fCurrent').innerHTML = cur ? `<small>CURRENT STEP ${t.steps.indexOf(cur) + 1}</small>${esc(cur.text)}`
    : t.steps.length ? '<small>ALL STEPS DONE</small>Press END OPERATION to finish.' : '<small>NO STEPS</small>Work on it until the timer ends.';
  $('#fStepDone').classList.toggle('hidden', !cur);
  $('#fSteps').innerHTML = t.steps.map(s => `<li data-sid="${s.id}" class="${L.steps.includes(s.id) ? 'done' : ''} ${s === cur ? 'cur' : ''}">${esc(s.text)}</li>`).join('');
}
function drawTimer() {
  const el = $('#fTime');
  if (F.phase === 'work') {
    el.textContent = fmt(F.left);
    el.classList.toggle('warn', F.left <= 60);
    el.classList.toggle('paused', !F.running);
    $('#fChunkLabel').textContent = `CHUNK ${F.chunkNo} · ${Math.round(F.chunkLen / 60)} MIN`;
    const segs = Math.max(1, Math.round(F.chunkLen / 60));
    const leftSegs = Math.ceil(F.left / 60);
    $('#fSegs').innerHTML = Array.from({ length: segs }, (_, i) => `<i class="${i >= leftSegs ? 'gone' : (leftSegs <= 1 ? 'warn' : '')}"></i>`).join('');
  }
  $('#fElapsed').textContent = `TODAY ON THIS TASK ${fmt(taskLog(F.task.id).seconds)}`;
  $('#fPause').textContent = F.running ? 'PAUSE' : 'RESUME';
}
function startTimer() { F.running = true; clearInterval(F.timer); F.timer = setInterval(tick, 1000); drawTimer(); }
function stopTimer() { F.running = false; clearInterval(F.timer); if (F.task) drawTimer(); }
function tick() {
  if (F.phase !== 'work') return;
  F.left--; F.sinceCue++;
  const L = taskLog(F.task.id); L.seconds++;
  if (L.seconds % 15 === 0) { save(); refreshChrome(); }
  const cue = S.settings.cueEvery * 60;
  if (cue && F.sinceCue >= cue && F.left > 30) { F.sinceCue = 0; showCue(); }
  if (F.left <= 0) { chunkDone(); return; }
  drawTimer();
}
let cueHide;
function showCue() {
  sfx.cue();
  $('#cueBanner').classList.remove('hidden');
  clearTimeout(cueHide); cueHide = setTimeout(() => $('#cueBanner').classList.add('hidden'), 20000);
}
function chunkDone() {
  stopTimer(); save(); refreshChrome(); sfx.chime(); setNoise('off' === S.settings.noise ? 'off' : S.settings.noise);
  if (SND.noise) { try { SND.noise.src.stop(); } catch { } SND.noise = null; }
  addPoints(POINTS.chunk, 'chunk', $('#fTime'));
  window.ops.notify('Chunk complete', `${F.task.title}: time for a ${S.settings.breakMin}-minute movement break.`);
  const move = MOVES[Math.floor(Math.random() * MOVES.length)];
  const a = showAlert(`<div class="a-kicker">CHUNK ${F.chunkNo} COMPLETE · +${POINTS.chunk} PTS</div>
    <div class="a-title">Movement break.</div>
    <div class="a-text">${F.tiny ? 'You did the 5 minutes — starting was the hard part. Keep going or take a break.' : `You focused for ${Math.round(F.chunkLen / 60)} minutes. Get up and move before the next chunk.`}</div>
    <div class="move-card">${esc(move)}</div>
    <div class="a-btns"><button class="btn go big" data-x="break">START ${S.settings.breakMin}-MIN BREAK</button>
      <button class="btn" data-x="next">SKIP BREAK · NEXT CHUNK</button><button class="btn ghost" data-x="finish">FINISH OPERATION</button></div>`, true);
  a.onclick = (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'break') startBreak(move);
    if (b.dataset.x === 'next') { hideAlert(); nextChunk(); }
    if (b.dataset.x === 'finish') { hideAlert(); finishOp(); }
  };
}
function startBreak(move) {
  F.phase = 'break'; F.breakLeft = S.settings.breakMin * 60;
  const a = showAlert(`<div class="a-kicker">BREAK IN PROGRESS</div><div class="a-big" id="brk">${fmt(F.breakLeft)}</div>
    <div class="move-card">${esc(move)}</div>
    <div class="a-text" style="margin-top:12px;color:var(--muted)">Screens off if you can. Next up: <span style="color:var(--text)">${esc(currentStepText())}</span></div>
    <div class="a-btns"><button class="btn" data-x="back">I'M BACK — NEXT CHUNK</button></div>`, true);
  clearInterval(F.timer);
  F.timer = setInterval(() => {
    F.breakLeft--;
    const el = $('#brk'); if (el) el.textContent = fmt(F.breakLeft);
    if (F.breakLeft <= 0) {
      clearInterval(F.timer); sfx.alarm(); flashRed();
      window.ops.notify('Break over', `Back to ${F.task.title}.`);
      const a2 = showAlert(`<div class="a-kicker blink">WARNING · BREAK OVER</div><div class="a-title">Return to station.</div>
        <div class="a-text">Next step: ${esc(currentStepText())}</div>
        <div class="a-btns"><button class="btn go big" data-x="back">RESUME</button><button class="btn ghost" data-x="finish">FINISH FOR NOW</button></div>`);
      a2.onclick = (e) => { const b = e.target.closest('[data-x]'); if (!b) return; hideAlert(); b.dataset.x === 'back' ? nextChunk() : finishOp(); };
    }
  }, 1000);
  a.onclick = (e) => { if (e.target.closest('[data-x="back"]')) { clearInterval(F.timer); hideAlert(); nextChunk(); } };
}
function currentStepText() {
  const L = taskLog(F.task.id); const s = F.task.steps.find(x => !L.steps.includes(x.id));
  return s ? s.text : 'keep going on ' + F.task.title;
}
function nextChunk() {
  F.phase = 'work'; F.chunkNo++; F.left = (F.tiny ? (F.task.chunk || S.settings.attentionSpan) * 60 : F.chunkLen); F.chunkLen = F.left; F.tiny = false;
  F.sinceCue = 0; startTimer(); setNoise(S.settings.noise); sfx.engage();
}
function completeStep(sid) {
  const t = F.task, L = taskLog(t.id);
  const step = sid ? t.steps.find(s => s.id === sid) : t.steps.find(s => !L.steps.includes(s.id));
  if (!step) return;
  if (L.steps.includes(step.id)) { L.steps = L.steps.filter(x => x !== step.id); sfx.click(); }
  else {
    L.steps.push(step.id); sfx.step();
    addPoints(POINTS.step, 'step', $('#fStepDone'));
    const c = $('#fCurrent'); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
  }
  save(); drawSteps(); refreshChrome();
  if (t.steps.length && t.steps.every(s => L.steps.includes(s.id))) setTimeout(() => confirmFinish(), 450);
}
function confirmFinish() {
  stopTimer();
  const a = showAlert(`<div class="a-kicker">ALL STEPS COMPLETE</div><div class="a-title">Finish operation?</div>
    <div class="a-btns"><button class="btn go big" data-x="yes">YES, MARK DONE</button><button class="btn ghost" data-x="no">KEEP WORKING</button></div>`, true);
  a.onclick = (e) => { const b = e.target.closest('[data-x]'); if (!b) return; hideAlert(); b.dataset.x === 'yes' ? finishOp() : startTimer(); };
}
function finishOp() {
  stopTimer();
  if (SND.noise) { try { SND.noise.src.stop(); } catch { } SND.noise = null; }
  const t = F.task, L = taskLog(t.id);
  const first = !L.done;
  L.done = true; L.estimate = t.estimate;
  save();
  if (first) addPoints(POINTS.task, 'task done');
  // Recall check (retrieval practice): write what you learned without looking
  const a = showAlert(`<div class="a-kicker">RECALL CHECK · +${POINTS.recall} PTS</div><div class="a-title">What do you remember?</div>
    <div class="a-text">Without looking at the video or your code, write 1–3 things you learned. Testing yourself like this helps you remember.</div>
    <textarea id="recallText" class="recall-input" placeholder="e.g. A 'for' loop repeats code. 'int' stores whole numbers…"></textarea>
    <div class="a-btns"><button class="btn go" data-x="save">SAVE NOTE</button><button class="btn ghost" data-x="skip">SKIP</button></div>`, true);
  setTimeout(() => $('#recallText')?.focus(), 50);
  a.onclick = (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    const txt = ($('#recallText').value || '').trim();
    if (b.dataset.x === 'save' && txt) { S.recall.push({ id: uid(), taskId: t.id, day: dayKey(), text: txt }); addPoints(POINTS.recall, 'recall'); save(); }
    showComplete(t);
  };
}
function showComplete(t) {
  const L = taskLog(t.id);
  const min = Math.round(L.seconds / 60);
  const next = todaysTasks().find(x => !taskLog(x.id).done);
  sfx.complete(); flashRed();
  const a = showAlert(`<div class="a-kicker">OPERATION COMPLETE</div><div class="a-title">${esc(t.title)}</div>
    <div class="a-text">Time today: <b>${min} min</b> · your guess: <b>${t.estimate || '?'} min</b> · points: <b>${S.points}</b>${t.estimate && min > t.estimate * 1.2 ? '<br><span style="color:var(--orange)">Took longer than planned — useful info for next time, not a failure.</span>' : ''}</div>
    ${S.parked.filter(p => !p.done).length ? `<div class="a-text" style="color:var(--cyan);margin-top:10px">You have ${S.parked.filter(p => !p.done).length} parked thought(s) to look at.</div>` : ''}
    <div class="a-btns">${next ? `<button class="btn go" data-x="next">NEXT: ${esc(next.title)}</button>` : ''}<button class="btn" data-x="home">BACK TO HUB</button></div>`, true);
  a.onclick = (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return; hideAlert();
    $('#focus').classList.add('hidden'); F.task = null;
    if (b.dataset.x === 'next') { setView('today'); engage(next); } else setView('hub');
  };
}

function bindFocus() {
  $('#fStepDone').onclick = () => completeStep();
  $('#fSteps').onclick = (e) => { const li = e.target.closest('li'); if (li) completeStep(li.dataset.sid); };
  $('#fPause').onclick = () => { if (F.running) { stopTimer(); if (SND.noise) { SND.noise.src.stop(); SND.noise = null; } } else { startTimer(); setNoise(S.settings.noise); } };
  $('#fPlus').onclick = () => { F.left += 300; F.chunkLen += 300; drawTimer(); };
  $('#fReopen').onclick = () => openResources(F.task);
  $('#fMin').onclick = () => { $('#focus').classList.add('hidden'); render(); toast('FOCUS TIMER STILL RUNNING — PRESS ENGAGE ON THE TASK TO RETURN'); };
  $('#fEnd').onclick = () => {
    stopTimer();
    const a = showAlert(`<div class="a-kicker">END OPERATION</div><div class="a-text" style="margin:16px 0">Is this task done for today?</div>
      <div class="a-btns"><button class="btn go" data-x="done">YES, IT'S DONE</button><button class="btn" data-x="pause">STOP FOR NOW (NOT DONE)</button><button class="btn ghost" data-x="cancel">KEEP GOING</button></div>`);
    a.onclick = (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return; hideAlert();
      if (b.dataset.x === 'done') finishOp();
      else if (b.dataset.x === 'pause') { save(); if (SND.noise) { SND.noise.src.stop(); SND.noise = null; } $('#focus').classList.add('hidden'); F.task = null; render(); }
      else startTimer();
    };
  };
  const park = () => {
    const inp = $('#fPark');
    if (addParked(inp.value, F.task?.title)) {
      sfx.click();
      $('#fParkMsg').textContent = '✓ PARKED. BACK TO: ' + currentStepText().toUpperCase();
      setTimeout(() => $('#fParkMsg').textContent = '', 4000);
    }
    inp.value = '';
  };
  $('#fParkBtn').onclick = park;
  $('#fPark').onkeydown = (e) => { if (e.key === 'Enter') park(); };
  $('#cueYes').onclick = () => { $('#cueBanner').classList.add('hidden'); if (F.task) { taskLog(F.task.id).on++; addPoints(POINTS.ontask, 'on target', $('#cueBanner')); } };
  $('#cueBack').onclick = () => { $('#cueBanner').classList.add('hidden'); if (F.task) { taskLog(F.task.id).off++; save(); } toast('NO PROBLEM — NOTICING IS THE SKILL. NEXT: ' + currentStepText().toUpperCase()); };
  $$('.noise-btn').forEach(b => b.onclick = () => setNoise(b.dataset.noise));
  $('#noiseVol').oninput = (e) => { S.settings.noiseVol = +e.target.value; if (SND.noise) SND.noise.g.gain.value = S.settings.noiseVol; save(); };
  document.addEventListener('keydown', (e) => {
    if ($('#focus').classList.contains('hidden') || !$('#alertWrap').classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); completeStep(); }
  });
}

// ---------- attention span measurement ----------
function measureSpan() {
  let sec = 0, timer = null;
  const a = showAlert(`<div class="a-kicker">ATTENTION SPAN CHECK</div>
    <div class="a-text">Pick a slightly boring task (reading docs, copying code from a video). Press START, work on it,
      and press DRIFTED the moment you notice your mind wandered. Doing this 2–3 times on different days gives a better number.</div>
    <div class="a-big" id="spanT">00:00</div>
    <div class="a-btns"><button class="btn go" data-x="start">START</button><button class="btn danger hidden" data-x="drift">DRIFTED</button><button class="btn ghost" data-x="cancel">CANCEL</button></div>`, true);
  a.onclick = (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'start') {
      b.classList.add('hidden'); $('[data-x="drift"]', a).classList.remove('hidden');
      timer = setInterval(() => { sec++; $('#spanT').textContent = fmt(sec); }, 1000);
    } else if (b.dataset.x === 'drift') {
      clearInterval(timer);
      const min = Math.max(3, Math.round(sec / 60));
      S.settings.attentionSpan = min; save(); hideAlert(); render();
      toast(`ATTENTION SPAN SET TO ${min} MIN. CHUNKS WILL BE THIS LONG.`);
    } else { clearInterval(timer); hideAlert(); }
  };
}

// ---------- auto-open at startup ----------
function maybeAutoOpen() {
  const today = dayKey();
  if (S.autoOpened === today) return;
  const list = todaysTasks().filter(t => t.autoOpen && !taskLog(t.id).done);
  if (!list.length) return;
  let n = 10;
  sfx.alarm(); flashRed();
  const a = showAlert(`<div class="a-kicker blink">AUTO-LAUNCH SEQUENCE</div><div class="a-big" id="alN">${n}</div>
    <div class="a-text">Opening: ${list.map(t => esc(t.title)).join(', ')}</div>
    <div class="a-btns"><button class="btn go" data-x="now">LAUNCH NOW</button><button class="btn ghost" data-x="cancel">NOT NOW</button></div>`);
  let timer;
  const go = async () => {
    clearInterval(timer); hideAlert(); S.autoOpened = today; save(); sfx.engage();
    for (const t of list) await openResources(t, true);
    toast('AUTO-LAUNCH COMPLETE. PRESS ENGAGE TO START THE TIMER.');
  };
  timer = setInterval(() => { n--; const el = $('#alN'); if (el) el.textContent = n; if (n > 0) tone({ f: 1200, d: 0.03, v: 0.04 }); if (n <= 0) go(); }, 1000);
  a.onclick = (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'now') go(); else { clearInterval(timer); S.autoOpened = today; save(); hideAlert(); }
  };
}

// ---------- start-time reminders ----------
function checkReminders() {
  if (!S.settings.reminders || !$('#alertWrap').classList.contains('hidden')) return;
  const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const done = (S.reminded[dayKey()] ||= []);
  const due = todaysTasks().find(t => t.startTime && t.startTime <= hm && !done.includes(t.id) && !taskLog(t.id).done && !(F.task && F.task.id === t.id));
  if (!due) return;
  done.push(due.id); save();
  // only fire if within 30 minutes of the start time (avoid nagging for old ones on late app start)
  const [h, m] = due.startTime.split(':').map(Number);
  if ((now.getHours() * 60 + now.getMinutes()) - (h * 60 + m) > 30) return;
  sfx.alarm(); flashRed();
  window.ops.notify('Time to start: ' + due.title, due.ifThen?.then || 'Press ENGAGE in SyncOps.');
  const a = showAlert(`<div class="a-kicker blink">START TIME · ${esc(due.startTime)}</div><div class="a-title">${esc(due.title)}</div>
    ${due.ifThen?.then ? `<div class="a-text">Your plan: ${esc(due.ifThen.then)}</div>` : ''}
    <div class="a-btns"><button class="btn engage" data-x="go">ENGAGE</button><button class="btn" data-x="tiny">JUST 5 MINUTES</button><button class="btn ghost" data-x="later">NOT NOW</button></div>`);
  a.onclick = (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return; hideAlert();
    if (b.dataset.x === 'go') engage(due); else if (b.dataset.x === 'tiny') engage(due, 5);
  };
}

// ---------- global click sounds ----------
function bindGlobalSounds() {
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button, .app-tile, .link-row, input[type=checkbox]');
    if (!b || b.disabled) return;
    if (b.classList.contains('nav-btn') || b.dataset.act === 'engage' || b.dataset.act === 'hub-launch' || b.dataset.act === 'launch-all' || b.dataset.x === 'go' || b.id === 'fStepDone') return; // have their own sounds
    sfx.click();
  }, true);
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.nav-btn, .app-tile, .btn.engage');
    if (b && !b.contains(e.relatedTarget)) sfx.hover();
  });
}

// =====================================================================
// WALKMAN — local music folder + YouTube playlists (one deck controls both)
// =====================================================================
const AUD = new Audio(); AUD.crossOrigin = 'anonymous'; AUD.preload = 'metadata';
const W = { tracks: [], idx: -1, tab: 'local', filter: '', yt: null, yi: {}, ytHidden: false, an: null, scanned: false, scanErr: '' };
const trackUrl = (p) => 'syncmusic://track/' + encodeURIComponent(p);
function wk() { return (S.walkman ||= { dir: '', vol: 0.7, shuffle: false, repeat: 'all', lastPath: '', playlists: [] }); }

async function scanMusic() {
  if (!wk().dir) { wk().dir = await window.ops.musicDefault(); save(); }
  const r = await window.ops.musicScan(wk().dir);
  W.tracks = r.tracks || []; W.scanErr = r.ok ? '' : r.error; W.scanned = true;
  const cur = AUD.dataset.path;
  W.idx = cur ? W.tracks.findIndex(t => t.path === cur) : -1;
  if (W.idx < 0 && !cur && wk().lastPath) {
    const i = W.tracks.findIndex(t => t.path === wk().lastPath);
    if (i >= 0) { W.idx = i; AUD.src = trackUrl(W.tracks[i].path); AUD.dataset.path = W.tracks[i].path; }
  }
  updateMini();
}
function ensureAnalyser() {
  if (W.an) return;
  try {
    const c = audio(); const src = c.createMediaElementSource(AUD);
    W.an = c.createAnalyser(); W.an.fftSize = 64; W.an.smoothingTimeConstant = 0.75;
    src.connect(W.an); W.an.connect(c.destination);
  } catch { W.an = null; }
}
function playIndex(i) {
  if (!W.tracks.length) { toast('NO MUSIC FOUND — PUT FILES IN YOUR MUSIC FOLDER, THEN RESCAN', true); return; }
  i = ((i % W.tracks.length) + W.tracks.length) % W.tracks.length;
  if (W.yt) { closeYT(); toast('YOUTUBE STOPPED — PLAYING LOCAL TAPE'); }
  ensureAnalyser();
  W.idx = i; const t = W.tracks[i];
  AUD.src = trackUrl(t.path); AUD.dataset.path = t.path; AUD.volume = wk().vol;
  wk().lastPath = t.path; save();
  AUD.play().catch(e => toast('CANNOT PLAY THIS FILE: ' + e.message, true));
  tone({ f: 90, f2: 160, d: 0.18, type: 'sawtooth', v: 0.05, lp: 600 });
  if (view === 'walkman') render(); else updateMini();
}

// ---- transport (routes to YouTube when a YouTube tape is loaded) ----
function wToggle() {
  if (W.yt) { ytCmd(W.yi.playerState === 1 ? 'pauseVideo' : 'playVideo'); return; }
  if (!AUD.src || W.idx < 0) { playIndex(W.idx >= 0 ? W.idx : 0); return; }
  ensureAnalyser();
  if (AUD.paused) AUD.play().catch(() => { }); else AUD.pause();
}
function wNext(auto) {
  if (W.yt) { if (W.yt.list) ytCmd('nextVideo'); else ytSeek(0); return; }
  if (!W.tracks.length) return;
  if (auto && wk().repeat === 'one') { AUD.currentTime = 0; AUD.play(); return; }
  if (wk().shuffle && W.tracks.length > 1) { let j; do { j = Math.random() * W.tracks.length | 0; } while (j === W.idx); playIndex(j); return; }
  if (auto && wk().repeat === 'off' && W.idx === W.tracks.length - 1) { AUD.pause(); return; }
  playIndex(W.idx + 1);
}
function wPrev() {
  if (W.yt) { if ((W.yi.currentTime || 0) > 4 || !W.yt.list) ytSeek(0); else ytCmd('previousVideo'); return; }
  if (AUD.currentTime > 4) { AUD.currentTime = 0; return; } playIndex(W.idx - 1);
}
function wStop() {
  if (W.yt) { ytCmd('pauseVideo'); ytSeek(0); return; }
  AUD.pause(); AUD.currentTime = 0; updateMini();
}
function wSetVol(v) {
  wk().vol = v; AUD.volume = v; save();
  if (W.yt) ytCmd('setVolume', [Math.round(v * 100)]);
}
function wSeekFrac(f) {
  if (W.yt) { if (W.yi.duration) ytSeek(f * W.yi.duration); return; }
  if (AUD.duration) AUD.currentTime = f * AUD.duration;
}

AUD.addEventListener('ended', () => wNext(true));
AUD.addEventListener('play', () => { document.body.classList.add('walk-playing'); updateMini(); vuLoop(); });
AUD.addEventListener('pause', () => { if (!W.yt) document.body.classList.remove('walk-playing'); updateMini(); });
AUD.addEventListener('error', () => { if (AUD.dataset.path && !W.yt) toast('COULD NOT PLAY: ' + AUD.dataset.path.split(/[\\/]/).pop(), true); });
AUD.addEventListener('timeupdate', () => { if (!W.yt) updateTimes(); });

// ---- what the deck shows ----
function deckInfo() {
  if (W.yt) {
    const i = W.yi, pl = Array.isArray(i.playlist) ? i.playlist : null;
    return {
      yt: true, name: (i.videoData && i.videoData.title) || W.yt.name || 'YOUTUBE',
      sub: 'YOUTUBE' + (pl ? ` · ${(i.playlistIndex || 0) + 1}/${pl.length}` : ' · LOOP'),
      track: pl ? pad((i.playlistIndex || 0) + 1) : 'YT', cur: i.currentTime || 0, dur: i.duration || 0, playing: i.playerState === 1,
    };
  }
  const t = W.tracks[W.idx];
  return { yt: false, name: t ? t.name : '', sub: t ? (t.folder || 'ROOT') : 'PRESS PLAY', track: W.idx >= 0 ? pad(W.idx + 1) : '--',
    cur: AUD.currentTime || 0, dur: AUD.duration || 0, playing: !AUD.paused };
}
function lcdTime(c) {
  c = c ?? deckInfo().cur;
  return `${pad(Math.floor(c / 60))}:${pad(Math.floor(c % 60))}.${Math.floor((c * 10) % 10)}`;
}
function curName() { const d = deckInfo(); return d.yt ? 'YT · ' + d.name : d.name; }
function updateTimes() {
  const d = deckInfo(), p = d.dur ? d.cur / d.dur : 0;
  const mp = $('#miniProg'); if (mp) mp.style.width = (p * 100) + '%';
  const s = $('#wSeek'); if (s && !s.matches(':active')) s.value = p * 1000;
  const a = $('#wCur'); if (a) a.textContent = fmt(d.cur);
  const b = $('#wDur'); if (b) b.textContent = fmt(d.dur);
  const lt = $('#lcdTime'); if (lt) lt.textContent = lcdTime(d.cur);
  const mt = $('#miniTime'); if (mt) mt.textContent = lcdTime(d.cur).slice(0, 5);
}
function updateMini() {
  const d = deckInfo(), name = curName(), has = !!d.name;
  $('#mini').classList.toggle('hidden', !has);
  document.body.classList.toggle('has-mini', has);
  document.body.classList.toggle('walk-playing', d.playing);
  $('#miniName').textContent = name || '—';
  $('#miniPlay').textContent = d.playing ? '❚❚' : '▶';
  $('#fwName').textContent = name || 'NO TAPE LOADED — OPEN WALKMAN';
  $('#fwPlay').textContent = d.playing ? '❚❚' : '▶';
  const big = $('#wPlay'); if (big) big.textContent = d.playing ? '❚❚' : '▶';
  $$('.deck-led').forEach(l => l.classList.toggle('on', d.playing));
  const n = $('#lcdName'); if (n && n.textContent !== (d.name || 'NO TAPE')) n.textContent = d.name || 'NO TAPE';
  const cl = $('#casName'); if (cl) cl.textContent = d.name || 'SIDE A';
  const tr = $('#lcdTrack'); if (tr) tr.textContent = d.track;
  const sb = $('#lcdSub'); if (sb) sb.textContent = d.sub;
  updateTimes();
  if (d.playing) vuLoop();
}

// VU meter: real spectrum for local files; animated levels for YouTube (its audio can't be read)
let vuRunning = false;
function vuLoop() {
  if (vuRunning) return; vuRunning = true;
  const frame = () => {
    const d = deckInfo();
    if (!d.playing) { vuRunning = false; return; }
    requestAnimationFrame(frame);
    const cv = $('#vu'); if (!cv) return;
    const g = cv.getContext('2d');
    if (cv.width !== cv.clientWidth) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
    const n = 28, bw = cv.width / n, H = cv.height, rows = 8;
    let data = null;
    if (!d.yt && W.an) { data = new Uint8Array(W.an.frequencyBinCount); W.an.getByteFrequencyData(data); }
    const t = performance.now() / 1000;
    g.clearRect(0, 0, cv.width, H);
    for (let i = 0; i < n; i++) {
      const v = data ? data[Math.floor(i * data.length / n * 0.85)] / 255
        : Math.max(0, 0.55 + 0.35 * Math.sin(t * 6 + i * 0.7) * Math.sin(t * 2.3 + i * 0.31) - i * 0.012 + (Math.random() - 0.5) * 0.15);
      const segs = Math.round(v * rows);
      for (let s = 0; s < rows; s++) {
        g.fillStyle = s < segs ? (s >= rows - 2 ? '#ff6a3a' : '#7dffb6') : 'rgba(125,255,182,0.07)';
        g.fillRect(i * bw + 1.5, H - (s + 1) * (H / rows) + 1, bw - 3, H / rows - 2);
      }
    }
    if (!d.yt) { const lt = $('#lcdTime'); if (lt) lt.textContent = lcdTime(d.cur); }
  };
  requestAnimationFrame(frame);
}

// ---------- YouTube (official embedded player, controlled with its postMessage API) ----------
function parseYT(input) {
  input = (input || '').trim(); if (!input) return null;
  if (/^(PL|OL|RD|UU|FL|LL)[\w-]{10,}$/.test(input)) input = 'https://www.youtube.com/playlist?list=' + input;
  let u; try { u = new URL(input); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$/.test(u.hostname)) return null;
  let v = u.searchParams.get('v'); const list = u.searchParams.get('list');
  if (u.hostname === 'youtu.be') v = u.pathname.slice(1);
  const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/); if (m && m[2] !== 'videoseries') v = m[2];
  if (!v && !list) return null;
  // loop=1: playlists start again from the first song; single videos repeat (needs playlist=<same id>)
  const q = 'autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&loop=1';
  const embed = v
    ? `https://www.youtube-nocookie.com/embed/${v}?${list ? 'list=' + list : 'playlist=' + v}&${q}`
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&${q}`;
  const watch = v ? `https://www.youtube.com/watch?v=${v}${list ? '&list=' + list : ''}` : `https://www.youtube.com/playlist?list=${list}`;
  return { v, list, embed, watch };
}
function ytFrame() { return $('#ytFrameBox iframe'); }
function ytPost(obj) { const f = ytFrame(); if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify(obj), '*'); }
function ytCmd(func, args = []) { ytPost({ event: 'command', func, args, id: 'syncops', channel: 'widget' }); }
function ytSeek(sec) { ytCmd('seekTo', [sec, true]); W.yi.currentTime = sec; updateTimes(); }
let ytHandshake = null;
function playYT(item) {
  const p = parseYT(item.url); if (!p) { toast('THAT DOES NOT LOOK LIKE A YOUTUBE LINK', true); return; }
  AUD.pause();
  W.yt = { ...p, name: item.name || (p.list ? 'PLAYLIST' : 'VIDEO') }; W.yi = {}; W.ytHidden = false;
  const box = $('#ytFrameBox');
  box.innerHTML = `<iframe src="${esc(p.embed)}" title="YouTube player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  const f = ytFrame();
  // tell the player we want state updates (repeat until it answers)
  clearInterval(ytHandshake);
  const hello = () => ytPost({ event: 'listening', id: 'syncops', channel: 'widget' });
  f.addEventListener('load', () => { hello(); ytHandshake = setInterval(() => { if (W.yi.ready) clearInterval(ytHandshake); else hello(); }, 1000); });
  $('#ytDock').classList.remove('hidden');
  sfx.engage(); updateMini(); placeDock();
}
function closeYT() {
  clearInterval(ytHandshake);
  W.yt = null; W.yi = {}; $('#ytFrameBox').innerHTML = ''; $('#ytDock').classList.add('hidden'); updateMini();
}
addEventListener('message', (e) => {
  if (!W.yt || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin || 'http://x').hostname)) return;
  let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
  if (!d || !d.event) return;
  if (d.event === 'onReady' || d.event === 'initialDelivery') {
    W.yi.ready = true; ytCmd('setLoop', [true]); ytCmd('setVolume', [Math.round(wk().vol * 100)]);
  }
  if ((d.event === 'infoDelivery' || d.event === 'initialDelivery') && d.info) { Object.assign(W.yi, d.info); W.yi.ready = true; }
  if (d.event === 'onStateChange') W.yi.playerState = d.info;
  // Ended (0): restart — playlist goes back to song 1, single video repeats.
  if (W.yi.playerState === 0 && !W.yi._restarting) {
    W.yi._restarting = true;
    const pl = Array.isArray(W.yi.playlist) ? W.yi.playlist : null;
    if (pl && (W.yi.playlistIndex || 0) < pl.length - 1) ytCmd('nextVideo');
    else if (pl) ytCmd('playVideoAt', [0]);
    else { ytCmd('seekTo', [0, true]); ytCmd('playVideo'); }
    setTimeout(() => { W.yi._restarting = false; }, 3000);
  }
  updateMini();
});
function placeDock() {
  const d = $('#ytDock'); if (!W.yt) { d.classList.add('hidden'); return; }
  d.classList.remove('hidden');
  const slot = $('#ytSlot');
  const focusOpen = !$('#focus').classList.contains('hidden');
  if (slot && view === 'walkman' && !focusOpen && W.tab === 'yt') {
    const r = slot.getBoundingClientRect();
    d.className = 'yt-dock in-slot';
    Object.assign(d.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  } else {
    d.className = 'yt-dock float' + (W.ytHidden ? ' tucked' : '');
    Object.assign(d.style, { left: '', top: '', width: '', height: '' });
  }
}
setInterval(() => { if (W.yt) { placeDock(); updateTimes(); } }, 400);

// ---------- view ----------
function deckHTML() {
  const w = wk(), d = deckInfo();
  return `<div class="wm-stage"><div class="wm">
    <div class="wm-top"><span class="wm-led deck-led ${d.playing ? 'on' : ''}"></span><span class="wm-tiny">POWER</span>
      <span class="wm-hold"></span><span class="spacer"></span><span class="wm-src ${d.yt ? 'yt' : ''}">${d.yt ? 'YOUTUBE' : 'TAPE'}</span><span class="wm-grille"></span><span class="wm-jack"></span></div>
    <div class="wm-body"><div class="wm-main">
      <div class="wm-lcd">
        <div class="lcd-row"><span class="lcd-lbl">TR</span><span class="seg" id="lcdTrack">${d.track}</span>
          <span class="seg big" id="lcdTime">${lcdTime(d.cur)}</span>
          <span class="lcd-flags"><i class="${w.shuffle && !d.yt ? 'on' : ''}">SHUF</i><i class="${d.yt || w.repeat !== 'off' ? 'on' : ''}">${!d.yt && w.repeat === 'one' ? 'RPT 1' : 'RPT'}</i></span></div>
        <canvas id="vu" class="lcd-vu"></canvas>
        <div class="lcd-name"><span id="lcdName">${esc(d.name || 'NO TAPE')}</span></div>
        <div class="lcd-sub mono" id="lcdSub">${esc(d.sub)}</div>
      </div>
      <div class="wm-window"><div class="cassette">
        <div class="cas-label"><span id="casName">${esc(d.name || 'SIDE A')}</span><b>A</b></div>
        <div class="cas-mid"><div class="reel"><i></i></div><div class="cas-tape"></div><div class="reel"><i></i></div></div>
        <div class="cas-foot"></div></div></div>
      <div class="wm-seek"><input type="range" id="wSeek" min="0" max="1000" value="${d.dur ? d.cur / d.dur * 1000 : 0}" aria-label="Seek">
        <div class="wm-times"><span id="wCur">${fmt(d.cur)}</span><span id="wDur">${fmt(d.dur)}</span></div></div>
    </div>
    <div class="wm-side">
      <button class="wkey" data-w="prev" title="Previous">⏮</button>
      <button class="wkey play" data-w="toggle" id="wPlay" title="Play / Pause">${d.playing ? '❚❚' : '▶'}</button>
      <button class="wkey" data-w="next" title="Next">⏭</button>
      <button class="wkey stop" data-w="stop" title="Stop">■</button>
      <span class="wm-gap"></span>
      <button class="wkey sm ${w.shuffle ? 'on' : ''}" data-wk="shuffle" title="Shuffle (music folder)">⤮</button>
      <button class="wkey sm ${w.repeat !== 'off' ? 'on' : ''}" data-wk="repeat" title="Repeat (music folder)">${w.repeat === 'one' ? '↻1' : '↻'}</button>
    </div></div>
    <div class="wm-bottom"><span class="wm-badge">SYNC<br>TAPE</span>
      <div class="wm-model"><b>SYNC-TAPE</b><span>PORTABLE CASSETTE · TYPE II</span></div>
      <label class="wm-vol"><span>VOL</span><input type="range" id="wVol" min="0" max="1" step="0.02" value="${w.vol}" aria-label="Volume"></label></div>
  </div></div>`;
}
function viewWalkman() {
  const w = wk();
  const tabs = `<button class="btn ${W.tab === 'local' ? '' : 'ghost'}" data-wk="tab" data-t="local">MUSIC FOLDER</button><button class="btn ${W.tab === 'yt' ? '' : 'ghost'}" data-wk="tab" data-t="yt">YOUTUBE</button>`;
  let html = head('PORTABLE AUDIO UNIT // SIDE A', 'WALKMAN', tabs);
  let right;
  if (W.tab === 'yt') {
    right = `<div class="panel tracks yt-panel"><div class="panel-label">YOUTUBE</div>
      <div id="ytSlot" class="yt-slot">${W.yt ? '' : '<div class="yt-empty mono">PASTE A PLAYLIST OR VIDEO LINK BELOW</div>'}</div>
      ${W.yt ? `<div class="row gap" style="margin-top:8px"><span class="spacer"></span><button class="btn small ghost" data-wk="yt-pop">POP-OUT WINDOW</button><button class="btn small danger" data-wk="yt-stop">EJECT</button></div>` : ''}
      <div class="row gap" style="margin-top:12px"><input type="text" id="ytUrl" placeholder="https://www.youtube.com/playlist?list=…"><input type="text" id="ytName" placeholder="Name" style="max-width:170px"></div>
      <div class="row gap" style="margin-top:8px"><button class="btn small go" data-wk="yt-add">SAVE + PLAY</button><button class="btn small ghost" data-wk="yt-once">JUST PLAY</button></div>
      <div class="panel-label" style="margin-top:16px">SAVED PLAYLISTS</div>
      ${w.playlists.length ? w.playlists.map((p, i) => `<div class="pl-row"><span class="mono" style="color:#9a90ff">${pad(i + 1)}</span><span class="pl-name">${esc(p.name || p.url)}</span>
        <button class="btn small" data-wk="yt-play" data-i="${i}">PLAY</button><button class="btn small ghost" data-wk="yt-popi" data-i="${i}">POP-OUT</button><button class="btn small ghost" data-wk="yt-del" data-i="${i}">✕</button></div>`).join('')
        : '<div class="micro">NONE YET</div>'}
      <p class="micro" style="line-height:1.6">THE WALKMAN BUTTONS CONTROL YOUTUBE TOO. VIDEOS REPEAT AND PLAYLISTS START OVER WHEN THEY END. IF THE PLAYER SHOWS AN ERROR, USE POP-OUT.</p>
    </div>`;
  } else {
    const q = W.filter.toLowerCase();
    const list = W.tracks.map((x, i) => ({ x, i })).filter(({ x }) => !q || x.name.toLowerCase().includes(q) || x.folder.toLowerCase().includes(q));
    right = `<div class="panel tracks">
      <div class="row gap"><div class="panel-label" style="margin:0">TRACKS</div><span class="spacer"></span><input type="text" id="wFilter" placeholder="Search…" value="${esc(W.filter)}" style="max-width:240px"></div>
      <div class="track-list">${!W.scanned ? '<div class="micro" style="padding:10px">SCANNING…</div>' : list.length ? list.map(({ x, i }) => `<button class="trk ${i === W.idx && !W.yt ? 'cur' : ''}" data-wk="play" data-i="${i}"><span class="mono tn">${i === W.idx && !AUD.paused ? '▶' : pad(i + 1)}</span><span class="tt">${esc(x.name)}</span><span class="micro">${esc(x.folder)}</span></button>`).join('')
        : `<div class="empty"><div class="title-card sm" style="transform-origin:center">No tapes found.</div><p class="mono" style="color:var(--muted)">Put MP3, FLAC, OGG, WAV or M4A files in your tape folder, then press RESCAN.</p><button class="btn" data-wk="open-dir">OPEN TAPE FOLDER</button></div>`}</div>
    </div>`;
  }
  html += `<div class="folder-bar"><span class="micro">TAPE FOLDER</span><span class="mono fb-path">${esc(w.dir || '…')}</span><span class="spacer"></span>
      <button class="btn small" data-wk="open-dir">OPEN FOLDER</button><button class="btn small ghost" data-wk="pick-dir">CHANGE</button><button class="btn small ghost" data-wk="rescan">RESCAN</button></div>
    <div class="walk-grid">${deckHTML()}${right}</div>`;
  return html;
}

function bindWalkman(el) {
  if (!el._wkBound) el._wkBound = true, el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-wk]'); if (!b || view !== 'walkman') return;
    e.stopPropagation();
    const w = wk(), i = +b.dataset.i;
    switch (b.dataset.wk) {
      case 'tab': W.tab = b.dataset.t; render(); break;
      case 'play': playIndex(i); break;
      case 'shuffle': w.shuffle = !w.shuffle; save(); render(); break;
      case 'repeat': w.repeat = { all: 'one', one: 'off', off: 'all' }[w.repeat]; save(); render(); toast('REPEAT: ' + w.repeat.toUpperCase()); break;
      case 'open-dir': window.ops.openPath(w.dir); break;
      case 'pick-dir': { const p = await window.ops.pick('folder'); if (p) { w.dir = p; save(); W.scanned = false; render(); await scanMusic(); render(); } break; }
      case 'rescan': W.scanned = false; render(); await scanMusic(); render(); toast(`FOUND ${W.tracks.length} TRACK(S)`); break;
      case 'yt-add': case 'yt-once': {
        const url = $('#ytUrl').value.trim(), name = $('#ytName').value.trim();
        if (!parseYT(url)) { toast('PASTE A YOUTUBE PLAYLIST OR VIDEO LINK', true); return; }
        if (b.dataset.wk === 'yt-add') { w.playlists.push({ name, url }); save(); }
        playYT({ name, url }); render(); break;
      }
      case 'yt-play': playYT(w.playlists[i]); render(); break;
      case 'yt-popi': { const p = parseYT(w.playlists[i].url); if (p) window.ops.ytPopout(p.watch); break; }
      case 'yt-pop': if (W.yt) { const url = W.yt.watch; closeYT(); window.ops.ytPopout(url); render(); } break;
      case 'yt-stop': closeYT(); render(); break;
      case 'yt-del': w.playlists.splice(i, 1); save(); render(); break;
    }
  });
  const seek = $('#wSeek', el); if (seek) seek.onchange = seek.oninput = () => wSeekFrac(seek.value / 1000);
  const vol = $('#wVol', el); if (vol) vol.oninput = () => wSetVol(+vol.value);
  const f = $('#wFilter', el);
  if (f) f.oninput = () => { W.filter = f.value; const pos = f.selectionStart; render(); const nf = $('#wFilter'); nf.focus(); nf.setSelectionRange(pos, pos); };
  if (!W.scanned) scanMusic().then(() => { if (view === 'walkman') render(); });
  updateMini();
  setTimeout(placeDock, 0);
}

// Shared transport buttons (deck, mini remote, focus row)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-w]'); if (b) {
    e.stopPropagation();
    ({ prev: wPrev, next: () => wNext(false), toggle: wToggle, stop: wStop, open: () => setView('walkman') })[b.dataset.w]();
    return;
  }
  const y = e.target.closest('[data-y]'); if (y) {
    if (y.dataset.y === 'close') { closeYT(); if (view === 'walkman') render(); }
    if (y.dataset.y === 'hide') { W.ytHidden = !W.ytHidden; placeDock(); }
  }
});

// =====================================================================
// BACKGROUND HUD — random flashing terminal popups (original designs)
// Flashing stays at or below ~2 per second (safe for photosensitivity guidelines).
// =====================================================================
const HUD = { timer: null, live: 0 };
const HUD_WORDS = {
  warn: ['WARNING', 'ALERT', 'CAUTION', 'EMERGENCY', 'OVERRIDE', 'LOCKDOWN', 'UNKNOWN SIGNAL'],
  sys: ['LINK', 'CORE', 'GRID', 'RELAY', 'SECTOR', 'BUFFER', 'SIGNAL', 'UNIT', 'NODE', 'ARRAY'],
  stat: ['NOMINAL', 'ONLINE', 'STANDBY', 'SYNCING', 'ENGAGED', 'OFFLINE', 'CRITICAL'],
};
const rnd = (a) => a[Math.random() * a.length | 0];
const rint = (a, b) => a + (Math.random() * (b - a + 1) | 0);
function hudItem() {
  const type = rnd(['warn', 'warn', 'data', 'hex', 'target', 'cols', 'wave', 'radar', 'bars', 'code']);
  const el = document.createElement('div');
  el.className = 'hud-item hud-' + type;
  let w = 200, h = 120;
  switch (type) {
    case 'warn': {
      const word = rnd(HUD_WORDS.warn);
      el.innerHTML = `<div class="hz"></div><div class="hw">${word}</div><div class="hs mono">${rnd(HUD_WORDS.sys)}-${rint(1, 99)} · ${rnd(HUD_WORDS.stat)}</div><div class="hz"></div>`;
      w = rint(180, 320); h = 0; break;
    }
    case 'data': {
      const lines = [`${rnd(HUD_WORDS.sys)} : ${rint(100, 999)}`, `FILE : ${rnd(HUD_WORDS.sys)}_${hex(3)}.DAT`, `STATE : ${rnd(HUD_WORDS.stat)}`, `LOAD : ${rint(10, 99)}.${rint(0, 9)}%`, `REF : 0x${hex(6)}`];
      el.innerHTML = `<div class="hd-head">${rnd(HUD_WORDS.sys)}-${hex(2)}</div>` + lines.map(l => `<div>${l}</div>`).join('');
      w = 210; h = 0; break;
    }
    case 'hex': {
      el.innerHTML = Array.from({ length: rint(3, 6) }, (_, i) => `<i style="--x:${(i % 3) * 58 + (Math.floor(i / 3) % 2) * 29}px;--y:${Math.floor(i / 3) * 50}px;--d:${i * 0.12}s"><b>${rint(1, 9)}</b></i>`).join('');
      w = 200; h = 110; break;
    }
    case 'target': {
      el.innerHTML = `<span class="tc tl"></span><span class="tc tr"></span><span class="tc bl"></span><span class="tc br"></span><span class="tx"></span><span class="ty"></span>
        <div class="tlbl mono">TARGET ${hex(2)} · ${rint(100, 999)}.${rint(10, 99)}</div>`;
      w = h = rint(110, 190); break;
    }
    case 'cols': {
      const c = ['#4cff8a', '#ff8a1c', '#45d6ff', '#ff1a2a', '#9b6bff'];
      el.innerHTML = Array.from({ length: rint(3, 5) }, () => `<div style="color:${rnd(c)}">${Array.from({ length: rint(6, 11) }, () => `${rnd(HUD_WORDS.sys)}-${hex(2)}`).join('<br>')}</div>`).join('');
      w = 300; h = 0; break;
    }
    case 'wave': {
      const pts = Array.from({ length: 41 }, (_, i) => `${i * 5},${30 + Math.sin(i * 0.5 + Math.random()) * rint(8, 24)}`).join(' ');
      el.innerHTML = `<svg viewBox="0 0 200 60" width="220" height="66"><polyline points="${pts}" fill="none" stroke="#4cff8a" stroke-width="1.5"/></svg><div class="mono wl">${rnd(HUD_WORDS.sys)} WAVEFORM</div>`;
      w = 220; h = 90; break;
    }
    case 'radar': {
      el.innerHTML = `<div class="rd"><i></i></div><div class="mono wl">SCAN ${rint(10, 99)}°</div>`;
      w = h = 130; break;
    }
    case 'bars': {
      el.innerHTML = Array.from({ length: 12 }, () => `<i style="height:${rint(10, 100)}%"></i>`).join('');
      w = 160; h = 70; break;
    }
    case 'code': {
      el.innerHTML = `<div class="big mono">${rint(0, 9)}${rint(0, 9)}${rint(0, 9)}</div><div class="mono wl">${rnd(HUD_WORDS.sys)} CODE</div>`;
      w = 140; h = 90; break;
    }
  }
  const W0 = innerWidth, H0 = innerHeight;
  el.style.left = rint(0, Math.max(0, W0 - w - 10)) + 'px';
  el.style.top = rint(70, Math.max(80, H0 - (h || 140) - 30)) + 'px';
  if (type !== 'hex' && type !== 'radar' && Math.random() < 0.3) el.classList.add('red');
  return el;
}
function hudTick() {
  const lvl = S.settings.hud;
  if (calm() || lvl === 'off' || document.hidden) return;
  const max = lvl === 'high' ? 9 : 4;
  if (HUD.live >= max) return;
  const el = hudItem();
  $('#hudfx').appendChild(el); HUD.live++;
  const life = rint(1400, 3200);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); HUD.live--; }, 260); }, life);
  if (Math.random() < 0.08 && lvl === 'high') { // occasional full-width alert sweep
    const s = document.createElement('div'); s.className = 'hud-sweep';
    s.innerHTML = `<span>${rnd(HUD_WORDS.warn)}</span>`.repeat(6);
    $('#hudfx').appendChild(s); setTimeout(() => s.remove(), 1600);
  }
}
function setHud() {
  clearInterval(HUD.timer);
  const lvl = S.settings.hud;
  $('#hudfx').classList.toggle('low', lvl === 'low');
  if (calm() || lvl === 'off') { $('#hudfx').innerHTML = ''; HUD.live = 0; return; }
  HUD.timer = setInterval(hudTick, lvl === 'high' ? 420 : 1100);
}

// ---------- text size ----------
// Effective zoom = your text-size choice × an automatic factor so big / full screens are filled properly.
let curZoom = 1;
function autoFactor() {
  const physW = innerWidth * curZoom, physH = innerHeight * curZoom;
  return Math.min(2.2, Math.max(1, Math.min(physW / 1380, physH / 860)));
}
function applyZoom() {
  const z = Math.round((S.settings.zoom || 1) * autoFactor() * 100) / 100;
  if (Math.abs(z - curZoom) < 0.01) return;
  curZoom = z; window.ops.setZoom(z);
}
function setZoom(z) {
  z = Math.min(1.6, Math.max(0.8, Math.round(z * 100) / 100));
  S.settings.zoom = z; save(); applyZoom();
}
let zoomT;
addEventListener('resize', () => { clearTimeout(zoomT); zoomT = setTimeout(() => S && applyZoom(), 120); });
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || !S) return;
  if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(S.settings.zoom + 0.05); }
  if (e.key === '-') { e.preventDefault(); setZoom(S.settings.zoom - 0.05); }
  if (e.key === '0') { e.preventDefault(); setZoom(1); }
});

// ---------- boot ----------
async function boot() {
  [ENV, APPS] = await Promise.all([window.ops.envInfo(), window.ops.listApps()]);
  S = await window.ops.load();
  const fresh = !S;
  if (fresh) { S = defaults(); S.tasks = seedTasks(); S.rewards = seedRewards(); }
  const d = defaults();
  S = Object.assign(d, S);
  S.settings = Object.assign(defaults().settings, S.settings);
  S.settings.custom = Object.assign({ click: '', alarm: '', complete: '' }, S.settings.custom);
  S.hub = Object.assign({ apps: [], links: [] }, S.hub);
  S.walkman = Object.assign({ dir: '', vol: 0.7, shuffle: false, repeat: 'all', lastPath: '', playlists: [] }, S.walkman);
  if (!fresh && S.version < 2) { S.rewards = S.rewards.length ? S.rewards : seedRewards(); S.version = 2; }
  await window.ops.save(S);
  applyZoom();
  document.body.classList.toggle('calm', S.settings.calm);

  $$('.nav-btn').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#calmBtn').onclick = () => { S.settings.calm = !S.settings.calm; save(); refreshChrome(); setBg(); setHud(); if (view === 'system') render(); };
  $('#modalWrap').onclick = (e) => { if (e.target.id === 'modalWrap') closeModal(); };
  bindFocus(); bindGlobalSounds();
  tickClock(); setInterval(tickClock, 1000);
  updateTicker(); setInterval(updateTicker, 8000);
  updateSideCode(); setInterval(() => { if (!calm()) updateSideCode(); }, 1500);
  setInterval(checkReminders, 20000);
  let lastDay = dayKey();
  setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); if ($('#focus').classList.contains('hidden')) render(); } }, 30000);
  loadCustomSounds();
  scanMusic();
  render(); setBg(); setHud();

  const bootEl = $('#boot');
  if (S.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches) { bootEl.remove(); maybeAutoOpen(); checkReminders(); return; }
  try { sfx.boot(); } catch { }
  const lines = ['> INITIALIZING OPERATIONS TERMINAL', `> LOADING ${S.tasks.length} OPERATION FILE(S) ........ OK`, `> SCANNING INSTALLED APPS ........ ${APPS.length} FOUND`,
    `> TODAY: ${todaysTasks().length} OPERATION(S) SCHEDULED`, `> REWARD BANK: ${S.points} PTS`, '> SYNC SYSTEMS NOMINAL'];
  let i = 0;
  const bl = $('#bootLines');
  const iv = setInterval(() => {
    bl.textContent += lines[i++] + '\n';
    $('#bootFill').style.width = (i / lines.length * 100) + '%';
    if (i >= lines.length) {
      clearInterval(iv);
      $('#bootTitle').classList.add('lock');
      setTimeout(() => { bootEl.classList.add('done'); setTimeout(() => { bootEl.remove(); maybeAutoOpen(); checkReminders(); }, 450); }, 550);
    }
  }, 140);
}

boot();
