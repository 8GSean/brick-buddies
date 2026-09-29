(() => {
'use strict';
// ============================================================ basics
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
let seed = 4242;
const srand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const PAL = { red: 0xe4002b, blue: 0x0055bf, yellow: 0xffd500, green: 0x2a9d4a, orange: 0xff7e14, purple: 0x8b2fc9, pink: 0xff69b4, white: 0xf4f4f4, lime: 0xa5ca18, cyan: 0x00b5e2, brown: 0x8a5a2b, gray: 0x9ba19d, dark: 0x3a3f45, tan: 0xe8d3a8 };
const RAINBOW = [PAL.red, PAL.orange, PAL.yellow, PAL.lime, PAL.cyan, PAL.blue, PAL.purple, PAL.pink];
const HALF = 50; // world half size

// ============================================================ renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const DAY = new THREE.Color(0x8fd3ff), NIGHT = new THREE.Color(0x0d1442);
scene.background = DAY.clone();
scene.fog = new THREE.Fog(0x8fd3ff, 90, 220);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 500);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa88, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 160 });
sun.shadow.bias = -0.0005;
scene.add(sun); scene.add(sun.target);

// ============================================================ helpers
const matCache = {};
function mat(c) { return matCache[c] || (matCache[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); }
const BOXG = new THREE.BoxGeometry(1, 1, 1);
function box(w, h, d, c, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(BOXG, c && c.isMaterial ? c : mat(c));
  m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const STUD_G = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 10); STUD_G.translate(0, 0.175, 0);
const studInst = new THREE.InstancedMesh(STUD_G, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 5000);
studInst.count = 0; studInst.castShadow = true; studInst.frustumCulled = false; scene.add(studInst);
const _c = new THREE.Color(), _o = new THREE.Object3D();
function studStatic(x, y, z, color) {
  if (studInst.count >= 5000) return;
  _o.position.set(x, y, z); _o.updateMatrix();
  studInst.setMatrixAt(studInst.count, _o.matrix); studInst.setColorAt(studInst.count, _c.set(color)); studInst.count++;
  studInst.instanceMatrix.needsUpdate = true; studInst.instanceColor.needsUpdate = true;
}
const solids = [];
function addSolid(x0, x1, z0, z1, top, bot = 0) { const c = { x0, x1, z0, z1, top, bot, on: true }; solids.push(c); return c; }
// static brick, centred on x/z, sitting on y0
function brick(cx, cz, w, d, h, color, y0 = 0, solid = true) {
  box(w, h, d, color, cx, y0 + h / 2, cz);
  for (let i = 0; i < w / 2; i++) for (let j = 0; j < d / 2; j++) studStatic(cx - w / 2 + 1 + i * 2, y0 + h, cz - d / 2 + 1 + j * 2, color);
  return solid ? addSolid(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y0 + h, y0) : null;
}
// dynamic brick (child of a group)
function dbrick(g, lx, lz, w, d, h, color, ly = 0, studs = true) {
  box(w, h, d, color, lx, ly + h / 2, lz, g);
  if (studs) for (let i = 0; i < w / 2; i++) for (let j = 0; j < d / 2; j++) {
    const s = new THREE.Mesh(STUD_G, mat(color)); s.position.set(lx - w / 2 + 1 + i * 2, ly + h, lz - d / 2 + 1 + j * 2); s.castShadow = true; g.add(s);
  }
}
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(1, 'rgba(255,240,170,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function emojiSprite(ch, size = 2) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.font = '96px "Segoe UI Emoji","Apple Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 72);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ============================================================ ground
(function ground() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#4fb84e'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.arc(34, 35, 19, 0, TAU); x.fill();
  x.fillStyle = '#6fd66c'; x.beginPath(); x.arc(32, 32, 19, 0, TAU); x.fill();
  x.fillStyle = '#86e883'; x.beginPath(); x.arc(28, 28, 8, 0, TAU); x.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(HALF, HALF); t.anisotropy = 8;
  const side = new THREE.MeshStandardMaterial({ color: 0x2f8a3a });
  const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  const g = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 4, HALF * 2), [side, side, top, side, side, side]);
  g.position.y = -2; g.receiveShadow = true; scene.add(g);
  // sea of clouds far below
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: 0xdff4ff }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -30; scene.add(sea);
  // plaza checker
  const pc = document.createElement('canvas'); pc.width = pc.height = 128; const px = pc.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { px.fillStyle = (i + j) % 2 ? '#e9ecef' : '#c9d0d6'; px.fillRect(i * 16, j * 16, 16, 16); }
  const pt = new THREE.CanvasTexture(pc); pt.magFilter = THREE.NearestFilter;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshStandardMaterial({ map: pt }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true; scene.add(plaza);
  // border wall
  const cols = RAINBOW;
  for (let i = 0; i < HALF * 2; i += 4) {
    const c1 = cols[(i / 4) % 8];
    brick(-HALF + i + 2, -HALF + 1, 4, 2, 2, c1, 0, false); brick(-HALF + i + 2, HALF - 1, 4, 2, 2, c1, 0, false);
    brick(-HALF + 1, -HALF + i + 2, 2, 4, 2, c1, 0, false); brick(HALF - 1, -HALF + i + 2, 2, 4, 2, c1, 0, false);
  }
  addSolid(-HALF - 5, HALF + 5, -HALF - 5, -HALF + 2, 50); addSolid(-HALF - 5, HALF + 5, HALF - 2, HALF + 5, 50);
  addSolid(-HALF - 5, -HALF + 2, -HALF - 5, HALF + 5, 50); addSolid(HALF - 2, HALF + 5, -HALF - 5, HALF + 5, 50);
})();

// ============================================================ audio
let AC = null, master = null, noiseBuf = null, musicOn = true, discoT = 0;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    musicLoop();
  } catch (e) { AC = null; }
}
function tone(f, d = 0.15, type = 'square', vol = 0.12, slide = 0, delay = 0) {
  if (!AC) return; const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
}
function noise(d = 0.2, vol = 0.2, freq = 1200, delay = 0) {
  if (!AC) return; const t = AC.currentTime + delay;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.05);
}
const mf = semi => 261.63 * Math.pow(2, semi / 12);
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
let combo = 0, comboT = 0;
const sfx = {
  coin() { const k = PENT[Math.min(combo, 9)]; tone(mf(k + 12), 0.12, 'square', 0.07); tone(mf(k + 24), 0.2, 'triangle', 0.06, 0, 0.05); combo++; comboT = 0.7; },
  jump() { tone(300, 0.18, 'square', 0.08, 2.2); },
  dbl() { tone(450, 0.2, 'square', 0.08, 2.5); },
  land() { noise(0.08, 0.1, 300); },
  smash() { noise(0.25, 0.3, 900); tone(160, 0.2, 'sawtooth', 0.1, 0.4); },
  swoosh() { noise(0.25, 0.12, 2500); },
  honk() { tone(392, 0.16, 'sawtooth', 0.1); tone(330, 0.3, 'sawtooth', 0.1, 0, 0.14); },
  quack() { tone(520, 0.12, 'sawtooth', 0.07, 0.6); },
  boing() { tone(160, 0.5, 'sine', 0.22, 5); },
  pop(i = 0) { tone(mf(PENT[i % 10] + 12), 0.1, 'sine', 0.15); },
  note(i) { const f = mf([0, 2, 4, 5, 7, 9, 11, 12][i]); tone(f, 0.7, 'sine', 0.2); tone(f * 2, 0.4, 'triangle', 0.08); },
  btn() { tone(200, 0.1, 'square', 0.1); tone(400, 0.15, 'square', 0.1, 0, 0.08); },
  splash() { noise(0.3, 0.18, 1800); },
  boom() { noise(0.6, 0.35, 250); tone(90, 0.5, 'sine', 0.3, 0.3); },
  sparkle() { for (let i = 0; i < 5; i++) tone(mf(24 + i * 3 + rand(0, 3)), 0.3, 'sine', 0.05, 0, i * 0.05); },
  fanfare() { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(mf(n + 12), 0.25, 'square', 0.1, 0, i * 0.11)); tone(mf(28), 0.7, 'triangle', 0.12, 0, 0.8); },
  tada() { [0, 4, 7].forEach((n, i) => tone(mf(n + 12), 0.4, 'triangle', 0.14, 0, i * 0.06)); },
  whoosh() { noise(0.9, 0.2, 500); tone(100, 0.9, 'sawtooth', 0.06, 6); },
  toot() { tone(240, 0.5, 'sawtooth', 0.1); tone(300, 0.5, 'sawtooth', 0.1); }
};
const MEL = [12,16,19,16,21,19,16,14, 12,16,21,16,19,16,14,12, 21,19,16,19,14,16,12,-99, 14,16,19,16,14,12,14,-99];
const BASS = [0, -3, -7, -5];
let mStep = 0;
function musicLoop() {
  if (!AC) return;
  const disco = discoT > 0, dt = disco ? 0.15 : 0.2;
  if (musicOn) {
    const n = MEL[mStep % 32];
    if (n > -50) tone(mf(n), 0.18, 'triangle', disco ? 0.07 : 0.045);
    if (mStep % 4 === 0) tone(mf(BASS[Math.floor(mStep / 8) % 4] - 12), 0.3, 'sine', 0.1);
    if (disco) { if (mStep % 2 === 0) tone(60, 0.15, 'sine', 0.3, 0.3); noise(0.04, 0.05, 6000); if (mStep % 4 === 2) noise(0.1, 0.08, 2500); }
  }
  mStep++; setTimeout(musicLoop, dt * 1000);
}

// ============================================================ HUD
let studs = 0, goldN = 0, duckN = 0, buildN = 0;
function hud() {
  $('#cStuds').textContent = studs; $('#cDucks').textContent = duckN; $('#cBuilds').textContent = buildN;
  [...$('#cGold').children].forEach((e, i) => e.classList.toggle('on', i < goldN));
}
let toastTimer = 0;
function toast(e) { const t = $('#toast'); t.textContent = e; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function rumble(a = 0.5, d = 120) {
  try { for (const gp of navigator.getGamepads()) if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: d, strongMagnitude: a, weakMagnitude: a }); } catch (e) {}
}
let shake = 0;

// ============================================================ particles
const PN = 1000;
const pMesh = new THREE.InstancedMesh(BOXG, new THREE.MeshBasicMaterial({ color: 0xffffff }), PN);
pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
const prt = [];
function spawn(x, y, z, vx, vy, vz, color, size = 0.5, life = 1, grav = 25, bounce = true) {
  if (prt.length >= PN) prt.shift();
  prt.push({ x, y, z, vx, vy, vz, c: new THREE.Color(color), size, life, grav, bounce, rx: rand(0, 6), ry: rand(0, 6), sx: rand(-8, 8), sy: rand(-8, 8) });
}
function updateParticles(dt) {
  let n = 0;
  for (let i = prt.length - 1; i >= 0; i--) {
    const p = prt[i]; p.life -= dt;
    if (p.life <= 0) { prt[i] = prt[prt.length - 1]; prt.pop(); continue; }
    p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.bounce && p.y < p.size / 2) { p.y = p.size / 2; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
    p.rx += p.sx * dt; p.ry += p.sy * dt;
  }
  for (let i = 0; i < prt.length; i++) {
    const p = prt[i]; _o.position.set(p.x, p.y, p.z); _o.rotation.set(p.rx, p.ry, 0);
    _o.scale.setScalar(p.size * Math.min(1, p.life / 0.4)); _o.updateMatrix();
    pMesh.setMatrixAt(i, _o.matrix); pMesh.setColorAt(i, p.c);
  }
  pMesh.count = prt.length; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
}
_o.rotation.order = 'XYZ';
function burst(x, y, z, colors, n = 12, spd = 9, size = 0.5, life = 1) {
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(spd * 0.3, spd); spawn(x, y, z, Math.cos(a) * s, rand(4, spd + 4), Math.sin(a) * s, colors[i % colors.length], size * rand(0.7, 1.2), life * rand(0.7, 1.2)); }
}
function firework(x, y, z, color) {
  const cols = color ? [color] : [RAINBOW[Math.floor(rand(0, 8))]];
  for (let i = 0; i < 60; i++) {
    const a = rand(0, TAU), b = rand(-1, 1), r = Math.sqrt(1 - b * b), s = rand(10, 16);
    spawn(x, y, z, Math.cos(a) * r * s, b * s, Math.sin(a) * r * s, cols[0], 0.6, rand(1.2, 1.9), 9, false);
  }
  sfx.boom(); sfx.sparkle();
}
function confetti(cx, cz, n = 60, h = 22) {
  for (let i = 0; i < n; i++) spawn(cx + rand(-22, 22), h + rand(0, 6), cz + rand(-22, 22), rand(-2, 2), rand(-2, 0), rand(-2, 2), RAINBOW[i % 8], 0.5, rand(3, 5), 4, false);
}

// ============================================================ coins
const COINT = { s: { c: 0xdde3e8, v: 1, size: 1 }, g: { c: 0xffc400, v: 10, size: 1.35 }, b: { c: 0x2f7dff, v: 50, size: 1.8 } };
const coinGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.25, 14); coinGeo.rotateX(Math.PI / 2);
const coinMats = {}; for (const k in COINT) coinMats[k] = new THREE.MeshStandardMaterial({ color: COINT[k].c, emissive: COINT[k].c, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.5 });
const coins = [];
function addCoin(x, y, z, t = 's', pop = false) {
  const m = new THREE.Mesh(coinGeo, coinMats[t]); m.scale.setScalar(COINT[t].size); m.position.set(x, y, z); m.castShadow = true; scene.add(m);
  const c = { m, x, y, z, vx: 0, vy: 0, vz: 0, t, pop, age: 0, ph: rand(0, 6), ground: y };
  if (pop) { const a = rand(0, TAU), s = rand(3, 8); c.vx = Math.cos(a) * s; c.vz = Math.sin(a) * s; c.vy = rand(9, 15); }
  coins.push(c); return c;
}
function coinArc(x0, z0, x1, z1, y0, y1, n, peak = 0, t = 's') { for (let i = 0; i < n; i++) { const u = i / (n - 1); addCoin(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * peak + 0.8, z0 + (z1 - z0) * u, t); } }
function coinRing(cx, cz, r, n, y = 0.9, t = 's') { for (let i = 0; i < n; i++) addCoin(cx + Math.cos(i / n * TAU) * r, y, cz + Math.sin(i / n * TAU) * r, t); }
function rainCoins(x, y, z, n, t = 's') { for (let i = 0; i < n; i++) addCoin(x, y, z, t, true); }
function addStuds(v) {
  const before = studs; studs += v; hud();
  if (Math.floor(studs / 100) > Math.floor(before / 100)) { toast('🎉'); sfx.tada(); confetti(player.x, player.z, 40, 14); }
  if (studs >= 300 && !goldEvents.studs) { goldEvents.studs = true; spawnGold(4, 4, 6); }
}
function updateCoins(dt) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]; c.age += dt;
    if (c.pop && !c.settled) {
      c.vy -= 32 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      const gy = groundAt(c.x, c.z, c.y + 1, 0.1) + 0.8;
      if (c.y < gy) { c.y = gy; c.vy *= -0.45; c.vx *= 0.7; c.vz *= 0.7; if (Math.abs(c.vy) < 2) { c.settled = true; c.ground = gy; } }
    } else c.ground = c.y;
    const bob = c.pop ? 0 : Math.sin(c.age * 3 + c.ph) * 0.15;
    c.m.rotation.y = c.age * 3 + c.ph; c.m.position.set(c.x, c.y + bob, c.z);
    const d = Math.hypot(c.x - player.x, c.z - player.z), dy = Math.abs(c.y - (player.y + 1.3));
    if (c.age > 0.45 && d < 5 && dy < 4.5) { const k = (1 - d / 5) * 20 + 5; c.x += (player.x - c.x) / (d + 0.01) * k * dt; c.z += (player.z - c.z) / (d + 0.01) * k * dt; c.y += (player.y + 1.3 - c.y) * Math.min(1, 8 * dt); c.settled = true; c.pop = false; }
    if (d < 1.3 && dy < 2) {
      scene.remove(c.m); coins[i] = coins[coins.length - 1]; coins.pop(); sfx.coin(); addStuds(COINT[c.t].v);
      if (c.t !== 's') { burst(c.x, c.y, c.z, [COINT[c.t].c], 8, 6, 0.3, 0.6); rumble(0.4, 100); }
    }
  }
}

// ============================================================ collision
const STEP = 0.65, PR = 0.6;
function groundAt(x, z, y, rad = 0.3) {
  let g = 0;
  for (const c of solids) if (c.on && x + rad > c.x0 && x - rad < c.x1 && z + rad > c.z0 && z - rad < c.z1 && c.top <= y + STEP && c.top > g) g = c.top;
  return g;
}
function hits(c, x, z, y) { return c.on && x + PR > c.x0 && x - PR < c.x1 && z + PR > c.z0 && z - PR < c.z1 && c.top > y + STEP && c.bot < y + 2; }
function blocked(x, z, y) { for (const c of solids) if (hits(c, x, z, y) && !hits(c, player.x, player.z, y)) return true; return false; }

// ============================================================ player
const player = { x: 0, y: 0, z: 8, vx: 0, vz: 0, vy: 0, face: 0, grounded: true, coyote: 0, dbl: false, smashT: 0, smashCd: 0, honkT: 0, squash: 0, hat: 0, shirt: 0, spinFlip: 0, gliding: false, step: 0, wet: false, stepT: 0, air: 0 };
const pg = new THREE.Group(); scene.add(pg);
const P = {};
(function buildPlayer() {
  const skin = PAL.yellow;
  P.body = new THREE.Group(); pg.add(P.body);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.45, 0.95, 0); P.body.add(leg);
    box(0.8, 0.95, 0.9, PAL.blue, 0, -0.47, 0, leg); box(0.8, 0.25, 1.1, PAL.dark, 0, -0.85, 0.1, leg);
    P[s < 0 ? 'legL' : 'legR'] = leg;
  }
  P.torso = box(1.8, 1.3, 1.0, RAINBOW[0], 0, 1.6, 0, P.body);
  box(1.9, 0.15, 1.05, PAL.dark, 0, 1.0, 0, P.body);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 1.15, 2.1, 0); P.body.add(arm);
    const sl = box(0.55, 0.9, 0.6, RAINBOW[0], 0, -0.4, 0, arm); P['sleeve' + (s < 0 ? 'L' : 'R')] = sl;
    box(0.5, 0.4, 0.5, skin, 0, -1.05, 0, arm);
    P[s < 0 ? 'armL' : 'armR'] = arm;
  }
  P.headG = new THREE.Group(); P.headG.position.y = 2.25; P.body.add(P.headG);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.85, 16), mat(skin)); head.position.y = 0.45; head.castShadow = true; P.headG.add(head);
  const stud = new THREE.Mesh(STUD_G, mat(skin)); stud.position.y = 0.87; P.headG.add(stud);
  box(0.13, 0.2, 0.06, 0x111111, -0.22, 0.55, 0.6, P.headG); box(0.13, 0.2, 0.06, 0x111111, 0.22, 0.55, 0.6, P.headG);
  box(0.45, 0.07, 0.06, 0x111111, 0, 0.25, 0.6, P.headG); box(0.07, 0.1, 0.06, 0x111111, -0.26, 0.3, 0.6, P.headG); box(0.07, 0.1, 0.06, 0x111111, 0.26, 0.3, 0.6, P.headG);
  P.hatSlot = new THREE.Group(); P.hatSlot.position.y = 1.0; P.headG.add(P.hatSlot);
  P.cape = box(1.5, 1.8, 0.1, PAL.red, 0, 1.5, -0.6, P.body);
})();
const HATS = 7;
function setHat(i) {
  player.hat = i; while (P.hatSlot.children.length) P.hatSlot.remove(P.hatSlot.children[0]); P.prop = null;
  const s = P.hatSlot;
  if (i === 1) { box(1.3, 0.35, 1.3, 0xffc400, 0, 0.17, 0, s); for (const [x, z] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5], [0, 0]]) box(0.25, 0.35, 0.25, 0xffc400, x, 0.5, z, s); }
  if (i === 2) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 12), mat(PAL.purple)); m.position.y = 0.9; m.castShadow = true; s.add(m); const st = emojiSprite('⭐', 0.7); st.position.y = 1.5; s.add(st); }
  if (i === 3) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 16), mat(0x222222)); a.position.y = 0.05; s.add(a); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 16), mat(0x222222)); b.position.y = 0.6; b.castShadow = true; s.add(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.2, 16), mat(PAL.red)); r.position.y = 0.3; s.add(r); }
  if (i === 4) { box(1.0, 0.3, 1.0, PAL.red, 0, 0.15, 0, s); P.prop = new THREE.Group(); P.prop.position.y = 0.4; s.add(P.prop); box(2.2, 0.06, 0.35, PAL.yellow, 0, 0, 0, P.prop); box(0.35, 0.06, 2.2, PAL.cyan, 0, 0, 0, P.prop); }
  if (i === 5) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.9, 14), mat(PAL.white)); b.position.y = 0.45; b.castShadow = true; s.add(b); const t = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), mat(PAL.white)); t.position.y = 1.1; t.castShadow = true; s.add(t); }
  if (i === 6) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 10), mat(PAL.pink)); m.position.y = 0.7; s.add(m); const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mat(PAL.yellow)); p.position.y = 1.45; s.add(p); }
}
function setShirt(i) { player.shirt = i; const c = mat(RAINBOW[i % 8]); P.torso.material = c; P.sleeveL.material = c; P.sleeveR.material = c; }
setShirt(0);

// ============================================================ input
const keys = {}; let mouseDrag = null, clickSmash = false, camYawVel = 0;
let started = false;
function startGame() { if (started) return; started = true; initAudio(); $('#start').style.opacity = 0; setTimeout(() => $('#start').remove(), 600); setTimeout(() => $('#hint').style.opacity = 0, 14000); sfx.tada(); }
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM' && AC) { musicOn = !musicOn; }
  startGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('pointerdown', e => { startGame(); mouseDrag = { x: e.clientX, y: e.clientY, moved: 0 }; });
addEventListener('pointermove', e => { if (mouseDrag) { const dx = e.clientX - mouseDrag.x; mouseDrag.moved += Math.abs(dx); mouseDrag.x = e.clientX; camYaw -= dx * 0.008; } });
addEventListener('pointerup', () => { if (mouseDrag && mouseDrag.moved < 6) clickSmash = true; mouseDrag = null; });
const prevBtn = { jump: false, smash: false, honk: false };
function readInput() {
  let mx = 0, my = 0, cam = 0, jump = false, smash = false, honk = false;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyQ) cam -= 1; if (keys.KeyE) cam += 1;
  jump = !!keys.Space; smash = !!(keys.KeyX || keys.KeyJ || keys.Enter || keys.ShiftLeft || keys.ShiftRight || keys.KeyZ); honk = !!(keys.KeyF || keys.KeyC || keys.KeyK);
  try {
    for (const gp of navigator.getGamepads()) {
      if (!gp) continue;
      const dz = v => Math.abs(v) < 0.18 ? 0 : v;
      const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0);
      if (ax || ay) { mx += ax; my += ay; }
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      if (b(14)) mx -= 1; if (b(15)) mx += 1; if (b(12)) my -= 1; if (b(13)) my += 1;
      cam += dz(gp.axes[2] || 0) * 1.6; if (b(4)) cam -= 1; if (b(5)) cam += 1;
      if (b(0)) jump = true; if (b(2) || b(1) || b(7)) smash = true; if (b(3) || b(6)) honk = true;
      if (Object.keys(prevBtn).length && gp.buttons.some(x => x.pressed)) startGame();
    }
  } catch (e) {}
  const out = { mx, my, cam, jump, jumpP: jump && !prevBtn.jump, smashP: (smash && !prevBtn.smash) || clickSmash, honkP: honk && !prevBtn.honk };
  prevBtn.jump = jump; prevBtn.smash = smash; prevBtn.honk = honk; clickSmash = false;
  return out;
}

// ============================================================ world objects: pads, bounce, etc.
const pads = [];
function addPad(x, z, color, icon, onPress, big = false) {
  const r = big ? 2.4 : 1.7;
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.4, r + 0.5, 0.25, 20), mat(PAL.dark)); base.position.y = 0.12; base.receiveShadow = true; g.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.35, 20), m); top.position.y = 0.3; top.castShadow = true; top.receiveShadow = true; g.add(top);
  let spr = null; if (icon) { spr = emojiSprite(icon, big ? 2.6 : 2); spr.position.y = big ? 3.4 : 2.8; g.add(spr); }
  const pad = { x, z, r: r + 0.1, g, top, m, spr, on: false, glow: 0, onPress, baseY: spr ? spr.position.y : 0, ph: rand(0, 6) };
  pads.push(pad); return pad;
}
function updatePads(dt, t) {
  for (const p of pads) {
    const on = dist2(player.x, player.z, p.x, p.z) < p.r && player.y < 1.2;
    if (on && !p.on) { p.glow = 1; p.top.position.y = 0.12; sfx.btn(); rumble(0.3, 80); burst(p.x, 0.6, p.z, [p.m.color.getHex(), 0xffffff], 10, 6, 0.35, 0.7); p.onPress && p.onPress(p); }
    p.on = on;
    p.glow = Math.max(0, p.glow - dt * 1.5);
    p.m.emissiveIntensity = 0.15 + p.glow * 1.2 + (p.on ? 0.3 : 0);
    p.top.position.y += ((p.on ? 0.12 : 0.3) - p.top.position.y) * Math.min(1, dt * 14);
    if (p.spr) p.spr.position.y = p.baseY + Math.sin(t * 3 + p.ph) * 0.25;
  }
}
// bounce pads + vents
const bouncers = [];
function addBouncer(x, z, power = 27, color = PAL.red) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.4, 18), mat(PAL.dark)); base.position.y = 0.2; base.receiveShadow = true; g.add(base);
  const spring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.18, 8, 16), mat(PAL.gray)); spring.rotation.x = Math.PI / 2; spring.position.y = 0.7; g.add(spring);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 18), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25 })); top.position.y = 1.1; top.castShadow = true; g.add(top);
  const arrow = emojiSprite('⏫', 1.6); arrow.position.y = 3.2; g.add(arrow);
  bouncers.push({ x, z, power, top, spring, arrow, sq: 0, cd: 0 });
}
const vents = [];
function addVent(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.5, 16), mat(PAL.dark)); b.position.y = 0.25; g.add(b);
  const fan = new THREE.Group(); fan.position.y = 0.55; g.add(fan);
  for (let i = 0; i < 4; i++) { const bl = box(2.2, 0.08, 0.5, PAL.cyan, 0, 0, 0, fan); bl.rotation.y = i * Math.PI / 4; }
  vents.push({ x, z, fan });
  for (let k = 1; k <= 3; k++) coinRing(x, z, 1.3, 6, k * 4 + 1);
  addCoin(x, 15.5, z, 'g');
}
// lamps (day/night)
const lampMats = [], halos = [];
function addLamp(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(0.4, 4.5, 0.4, PAL.dark, 0, 2.25, 0, g); box(1.2, 0.3, 1.2, PAL.dark, 0, 0.15, 0, g);
  const m = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe27a, emissiveIntensity: 0.2 }); lampMats.push(m);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), m); bulb.position.y = 5; g.add(bulb);
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.set(7, 7, 1); h.position.y = 5; g.add(h); halos.push(h);
  addSolid(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 5);
}
let night = 0, nightTarget = 0;
const stars = (() => { const n = 400, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rand(0, TAU), b = rand(0.1, 1), r = 300; p[i * 3] = Math.cos(a) * r * Math.sqrt(1 - b * b); p[i * 3 + 1] = b * r; p[i * 3 + 2] = Math.sin(a) * r * Math.sqrt(1 - b * b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(s); return s; })();

// ============================================================ gold bricks
const golds = [];
const goldEvents = { pads: false, builds: false, studs: false };
function addGold(x, y, z, falling = false) {
  const g = new THREE.Group(); g.position.set(x, falling ? y + 26 : y, z); scene.add(g);
  const gm = new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0xffa000, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.6 });
  const b = new THREE.Mesh(BOXG, gm); b.scale.set(2.4, 1.4, 1.6); b.castShadow = true; g.add(b);
  for (const sx of [-0.6, 0.6]) { const s = new THREE.Mesh(STUD_G, gm); s.position.set(sx, 0.7, 0); g.add(s); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  beam.position.y = 30; g.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.set(8, 8, 1); g.add(halo);
  golds.push({ g, y, falling, t: 0, got: false });
}
function spawnGold(x, z, y) { addGold(x, y, z, true); sfx.whoosh(); toast('✨'); }
function collectGold(o) {
  o.got = true; scene.remove(o.g); goldN++; hud(); toast('⭐'); sfx.fanfare(); rumble(0.9, 400);
  const p = o.g.position;
  for (let i = 0; i < 3; i++) setTimeout(() => firework(p.x + rand(-4, 4), p.y + rand(5, 10), p.z + rand(-4, 4)), i * 250);
  rainCoins(p.x, p.y + 1, p.z, 20, 'g'); confetti(p.x, p.z, 50, 20);
  player.honkT = 1.6;
  if (goldN === 6) finale();
}
function finale() {
  setHat(1); toast('👑');
  for (let i = 0; i < 16; i++) setTimeout(() => firework(player.x + rand(-25, 25), rand(18, 30), player.z + rand(-25, 25)), i * 350);
  for (let i = 0; i < 12; i++) setTimeout(() => confetti(player.x, player.z, 60, 24), i * 700);
  rainCoins(player.x, 10, player.z, 40, 'g'); discoT = 25;
}
function updateGolds(dt, t) {
  for (const o of golds) {
    if (o.got) continue; o.t += dt;
    if (o.falling) { o.g.position.y += (o.y - o.g.position.y) * Math.min(1, 3 * dt); if (Math.abs(o.g.position.y - o.y) < 0.15) { o.falling = false; sfx.boom(); burst(o.g.position.x, o.y, o.g.position.z, [0xffc400, 0xffffff], 20, 10, 0.5, 1); } }
    else o.g.position.y = o.y + Math.sin(o.t * 2) * 0.4;
    o.g.rotation.y = o.t * 1.6;
    if (Math.hypot(player.x - o.g.position.x, player.z - o.g.position.z) < 2.6 && Math.abs(player.y + 1 - o.g.position.y) < 3.5) collectGold(o);
  }
}

// ============================================================ breakables
const breakables = [];
const BK = [
  () => { const g = new THREE.Group(); dbrick(g, 0, 0, 2, 2, 2, PAL.orange); return { g, c: PAL.orange, hw: 1, hd: 1 }; },
  () => { const g = new THREE.Group(); dbrick(g, 0, 0, 2, 2, 1.2, PAL.red); dbrick(g, 0, 0, 2, 2, 1.2, PAL.yellow, 1.2); dbrick(g, 0, 0, 2, 2, 1.2, PAL.blue, 2.4); return { g, c: PAL.yellow, hw: 1, hd: 1 }; },
  () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2, 14), mat(PAL.red)); b.position.y = 1; b.castShadow = true; g.add(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 14), mat(PAL.yellow)); r.position.y = 1; g.add(r); return { g, c: PAL.red, hw: 1, hd: 1 }; },
  () => { const g = new THREE.Group(); const col = RAINBOW[Math.floor(rand(0, 8))]; dbrick(g, 0, 0, 4, 2, 1, col, 0.5); dbrick(g, -0.2, 0, 2, 2, 1, PAL.white, 1.5, false); for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), mat(0x222222)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, z * 1.05); g.add(w); } return { g, c: col, hw: 2, hd: 1 }; },
  () => { const g = new THREE.Group(); box(0.25, 1.6, 0.25, PAL.green, 0, 0.8, 0, g); const col = RAINBOW[Math.floor(rand(0, 8))]; for (let i = 0; i < 5; i++) box(0.7, 0.3, 0.7, col, Math.cos(i * TAU / 5) * 0.7, 1.7, Math.sin(i * TAU / 5) * 0.7, g).rotation.y = i; box(0.7, 0.4, 0.7, PAL.yellow, 0, 1.75, 0, g); dbrick(g, 0, 0, 2, 2, 0.8, PAL.brown, 0, false); return { g, c: col, hw: 1, hd: 1 }; },
  () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 12), mat(PAL.pink)); s.position.y = 1.1; s.castShadow = true; g.add(s); const c2 = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.35, 14), mat(PAL.white)); c2.position.y = 1.1; g.add(c2); return { g, c: PAL.pink, hw: 1, hd: 1 }; }
];
function addBreakable(x, z, kind) {
  const o = BK[kind === undefined ? Math.floor(rand(0, BK.length)) : kind](); o.g.position.set(x, 0, z); scene.add(o.g);
  const rot = Math.floor(rand(0, 4)) * Math.PI / 2; if (o.hw === o.hd) o.g.rotation.y = rot;
  o.x = x; o.z = z; o.col = addSolid(x - o.hw, x + o.hw, z - o.hd, z + o.hd, 2); o.alive = true; o.t = 0; o.pop = 1;
  breakables.push(o); return o;
}
function smashObj(o) {
  o.alive = false; o.g.visible = false; o.col.on = false; o.t = 16 + rand(0, 6);
  const cols = [o.c, PAL.white, o.c, PAL.yellow];
  for (let i = 0; i < 12; i++) spawn(o.x + rand(-1, 1), rand(0.5, 2), o.z + rand(-1, 1), rand(-9, 9), rand(6, 16), rand(-9, 9), cols[i % 4], rand(0.4, 0.8), rand(1.2, 2));
  const n = 3 + Math.floor(rand(0, 3)); for (let i = 0; i < n; i++) addCoin(o.x, 1.5, o.z, 's', true);
  if (Math.random() < 0.35) addCoin(o.x, 1.5, o.z, 'g', true);
  sfx.smash(); rumble(0.6, 150); shake = Math.max(shake, 0.25);
}
function updateBreakables(dt) {
  for (const o of breakables) {
    if (o.alive) { if (o.pop < 1) { o.pop = Math.min(1, o.pop + dt * 3); const s = 1 + Math.sin(o.pop * Math.PI) * 0.25; o.g.scale.setScalar(o.pop * s); } continue; }
    o.t -= dt;
    if (o.t <= 0 && dist2(player.x, player.z, o.x, o.z) > 3.5) { o.alive = true; o.g.visible = true; o.col.on = true; o.pop = 0; o.g.scale.setScalar(0.01); sfx.pop(2); burst(o.x, 1, o.z, [0xffffff], 5, 4, 0.25, 0.5); }
  }
}

// ============================================================ ducks
function duckModel(s = 1) {
  const g = new THREE.Group();
  box(1.6, 1.2, 2, PAL.yellow, 0, 0.9, 0, g); box(1.1, 1.1, 1.1, PAL.yellow, 0, 1.9, 0.8, g); box(0.7, 0.3, 0.6, PAL.orange, 0, 1.75, 1.55, g);
  box(0.15, 0.2, 0.1, 0x111111, 0.35, 2.1, 1.36, g); box(0.15, 0.2, 0.1, 0x111111, -0.35, 2.1, 1.36, g);
  box(0.3, 0.7, 1.2, 0xffc000, 0.9, 1.0, -0.1, g); box(0.3, 0.7, 1.2, 0xffc000, -0.9, 1.0, -0.1, g); box(0.6, 0.6, 0.6, PAL.yellow, 0, 1.3, -1.1, g);
  g.scale.setScalar(s); return g;
}
const ducks = [];
function addDuck(x, z) {
  const m = duckModel(1); m.position.set(x, 0, z); scene.add(m);
  ducks.push({ m, x, z, hx: x, hz: z, tx: x, tz: z, y: 0, vy: 0, t: rand(0, 3), friend: false, heart: null, dance: 0, idx: 0 });
}
function duckHop(d, v = 9) { if (d.y <= 0.05) { d.vy = v; } }
function befriend(d) {
  d.friend = true; d.idx = duckN; duckN++; hud(); d.heart = emojiSprite('💗', 1.5); d.heart.position.y = 3.4; d.m.add(d.heart);
  duckHop(d, 12); sfx.quack(); sfx.pop(4); burst(d.x, 2, d.z, [PAL.pink, 0xffffff], 8, 5, 0.35, 0.8); addCoin(d.x, 2, d.z, 'g', true); addCoin(d.x, 2, d.z, 'g', true); toast('💗');
}
function updateDucks(dt, t) {
  for (const d of ducks) {
    d.t -= dt;
    let speed = 2.2, tx = d.tx, tz = d.tz;
    if (d.friend) {
      const a = player.face + Math.PI, off = 3 + d.idx * 2.2; // conga line behind the player
      tx = player.x + Math.sin(a) * off * 0.9 + Math.sin(t * 0.8 + d.idx) * 1.2; tz = player.z + Math.cos(a) * off * 0.9 + Math.cos(t * 0.8 + d.idx) * 1.2;
      const dd = dist2(d.x, d.z, tx, tz); speed = Math.min(11, 2 + dd * 1.5); if (dd < 1) speed = 0;
    } else if (d.t <= 0) { d.tx = d.hx + rand(-7, 7); d.tz = d.hz + rand(-7, 7); d.t = rand(2, 5); }
    if (d.dance > 0) { d.dance -= dt; speed = 0; d.m.rotation.y += dt * 9; if (d.y <= 0.05) d.vy = 7; }
    const dx = tx - d.x, dz = tz - d.z, dd = Math.hypot(dx, dz);
    if (dd > 0.4 && speed > 0) {
      d.x += dx / dd * speed * dt; d.z += dz / dd * speed * dt;
      d.m.rotation.y += ((Math.atan2(dx, dz) - d.m.rotation.y + Math.PI * 3) % TAU - Math.PI) * Math.min(1, dt * 8);
      if (d.y <= 0.05) d.vy = 3.5 + speed * 0.3;
    }
    d.x = Math.max(-46, Math.min(46, d.x)); d.z = Math.max(-46, Math.min(46, d.z));
    d.vy -= 30 * dt; d.y += d.vy * dt; const g = groundAt(d.x, d.z, d.y, 0.2); if (d.y < g) { d.y = g; d.vy = 0; }
    d.m.position.set(d.x, d.y, d.z); d.m.scale.y = 1 + Math.max(0, d.vy) * 0.01;
    if (d.heart) d.heart.position.y = 3.4 + Math.sin(t * 4 + d.idx) * 0.2;
    if (!d.friend && dist2(d.x, d.z, player.x, player.z) < 2.6 && Math.abs(player.y - d.y) < 3) befriend(d);
  }
}
function honkAt(x, z) {
  sfx.honk();
  for (const d of ducks) if (dist2(d.x, d.z, x, z) < 14) { d.dance = 1.4; duckHop(d, 10); if (!d.friend && dist2(d.x, d.z, x, z) < 6) befriend(d); }
  burst(x, 3.5, z, RAINBOW, 16, 8, 0.4, 0.9);
  // trains toot back
  if (Math.random() < 0.5) setTimeout(() => sfx.toot(), 500);
}

// ============================================================ build spots
const MODELS = {
  house: { parts: [[0, 0, 0, 8, 3, 8, PAL.white], [0, 3, 0, 10, 1, 10, PAL.red], [0, 4, 0, 8, 1, 8, PAL.red], [0, 5, 0, 6, 1, 6, PAL.red], [0, 6, 0, 4, 1, 4, PAL.red], [0, 7, 0, 2, 1, 2, PAL.red], [-2.5, 5.3, 1.5, 1, 2, 1, PAL.orange], [0, 0, 4.1, 2, 2.4, 0.3, PAL.brown, 0], [-2.5, 1.2, 4.1, 1.4, 1.2, 0.3, PAL.cyan, 0], [2.5, 1.2, 4.1, 1.4, 1.2, 0.3, PAL.cyan, 0]] },
  tree: { parts: [[0, 0, 0, 2, 5, 2, PAL.brown], [0, 5, 0, 8, 2, 8, PAL.green], [0, 7, 0, 6, 2, 6, PAL.lime], [0, 9, 0, 4, 2, 4, PAL.green], [0, 11, 0, 2, 2, 2, PAL.lime], [2.4, 5.6, 4.2, 1, 1, 1, PAL.red, 0], [-2.4, 7.6, 3.2, 1, 1, 1, PAL.red, 0]] },
  dino: { parts: [[-2, 0, -3, 2, 2, 2, PAL.lime], [2, 0, -3, 2, 2, 2, PAL.lime], [-2, 0, 3, 2, 2, 2, PAL.lime], [2, 0, 3, 2, 2, 2, PAL.lime], [0, 2, 0, 6, 3, 8, PAL.green], [0, 5, 3, 2, 3, 2, PAL.lime], [0, 8, 3, 2, 2, 2, PAL.lime], [0, 9.5, 4.5, 2, 2, 4, PAL.lime], [0, 2, -5, 2, 2, 4, PAL.green], [0, 2, -9, 2, 1, 4, PAL.green], [0, 5, -2, 2, 1, 2, PAL.orange], [0, 5, 1, 2, 1, 2, PAL.orange], [-1.05, 10.8, 5.5, 0.2, 0.6, 0.6, PAL.white, 0], [1.05, 10.8, 5.5, 0.2, 0.6, 0.6, PAL.white, 0]] },
  castle: { parts: [[-5, 0, -5, 4, 8, 4, PAL.gray], [5, 0, -5, 4, 8, 4, PAL.gray], [-5, 0, 5, 4, 8, 4, PAL.gray], [5, 0, 5, 4, 8, 4, PAL.gray], [0, 0, -5, 6, 4, 2, PAL.tan], [-5, 0, 0, 2, 4, 6, PAL.tan], [5, 0, 0, 2, 4, 6, PAL.tan], [-3, 0, 5, 4, 4, 2, PAL.tan], [3, 0, 5, 4, 4, 2, PAL.tan], [-5, 8, -5, 4, 2, 4, PAL.red], [5, 8, -5, 4, 2, 4, PAL.blue], [-5, 8, 5, 4, 2, 4, PAL.blue], [5, 8, 5, 4, 2, 4, PAL.red], [0, 0, 0, 2, 2, 2, PAL.yellow]] }
};
const buildSpots = [];
function addBuildSpot(x, z, key) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.2, 28), new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const pile = new THREE.Group(); g.add(pile);
  for (let i = 0; i < 6; i++) { const b = new THREE.Group(); dbrick(b, 0, 0, 2, 2, 1, RAINBOW[i], 0); b.position.set(rand(-1.6, 1.6), i * 0.9, rand(-1.6, 1.6)); b.rotation.y = rand(0, 3); pile.add(b); }
  const spr = emojiSprite('🏗️', 2.6); spr.position.y = 5; g.add(spr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x66e0ff })); glow.scale.set(9, 9, 1); glow.position.y = 2; g.add(glow);
  buildSpots.push({ x, z, key, g, ring, pile, spr, glow, state: 0, pieces: [], t: 0 });
}
function startBuild(b) {
  b.state = 1; b.t = 0; sfx.btn(); rumble(0.4, 200); b.pile.visible = false; b.spr.visible = false; b.glow.visible = false;
  MODELS[b.key].parts.forEach((p, i) => {
    const [px, py, pz, w, h, d, col, studs] = p; const g = new THREE.Group();
    box(w, h, d, col, 0, h / 2, 0, g);
    if (studs !== 0) for (let i2 = 0; i2 < w / 2; i2++) for (let j = 0; j < d / 2; j++) { const s = new THREE.Mesh(STUD_G, mat(col)); s.position.set(-w / 2 + 1 + i2 * 2, h, -d / 2 + 1 + j * 2); g.add(s); }
    const ang = rand(0, TAU), rr = rand(10, 16);
    b.pieces.push({ g, from: new THREE.Vector3(Math.cos(ang) * rr, rand(12, 22), Math.sin(ang) * rr), to: new THREE.Vector3(px, py, pz), delay: 0.2 + i * 0.16, done: false, w, h, d, studs, part: p });
    g.visible = false; b.g.add(g);
  });
}
function updateBuilds(dt, t) {
  for (const b of buildSpots) {
    if (b.state === 0) {
      b.ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.3; b.ring.rotation.z = t; b.spr.position.y = 5 + Math.sin(t * 3) * 0.4; b.glow.material.opacity = 0.6 + Math.sin(t * 5) * 0.3;
      b.pile.rotation.y = t * 0.5;
      if (dist2(player.x, player.z, b.x, b.z) < 4.2 && player.y < 1.5) startBuild(b);
    } else if (b.state === 1) {
      b.t += dt; let all = true;
      b.pieces.forEach((p, i) => {
        if (p.done) return; const u = (b.t - p.delay) / 0.8;
        if (u < 0) { all = false; return; } p.g.visible = true;
        if (u >= 1) { p.done = true; p.g.position.copy(p.to); const [px, py, pz, w, h, d, , st] = p.part; if (st !== 0) addSolid(b.x + px - w / 2, b.x + px + w / 2, b.z + pz - d / 2, b.z + pz + d / 2, py + h, py); sfx.pop(i); burst(b.x + p.to.x, p.to.y + p.h, b.z + p.to.z, [0xffffff, 0xffe066], 4, 5, 0.3, 0.5); shake = Math.max(shake, 0.08); return; }
        all = false; const e = u * u * (3 - 2 * u); p.g.position.lerpVectors(p.from, p.to, e); p.g.position.y += Math.sin(u * Math.PI) * 4; p.g.rotation.y = (1 - e) * 6;
      });
      if (all) { b.state = 2; buildN++; hud(); toast('🏗️'); sfx.fanfare(); rumble(0.8, 300); const cx = b.x, cz = b.z; for (let i = 0; i < 4; i++) setTimeout(() => firework(cx + rand(-6, 6), rand(14, 20), cz + rand(-6, 6)), i * 220); rainCoins(cx, 10, cz, 16, 'g'); ring2(b); if (buildN === 3 && !goldEvents.builds) { goldEvents.builds = true; spawnGold(-4, 4, 6); } }
    } else b.ring.material.opacity = 0.25;
  }
}
function ring2(b) { b.ring.visible = false; }

// ============================================================ set pieces: rocket, bridge, disco, duck, train
const rocket = { g: new THREE.Group(), state: 0, t: 0, vy: 0 };
(function () {
  const g = rocket.g; g.position.set(0, 0, -17); scene.add(g);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 6, 14), mat(PAL.white)); b.position.y = 3.5; b.castShadow = true; g.add(b);
  const n = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 14), mat(PAL.red)); n.position.y = 7.7; n.castShadow = true; g.add(n);
  const w = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), mat(PAL.cyan)); w.position.set(0, 4.5, 1.05); g.add(w);
  for (let i = 0; i < 3; i++) { const f = box(0.3, 2.2, 1.6, PAL.red, 0, 1.5, 0); f.position.set(Math.cos(i * TAU / 3) * 1.6, 1.4, Math.sin(i * TAU / 3) * 1.6); f.rotation.y = -i * TAU / 3; g.add(f); }
  rocket.flame = new THREE.Mesh(new THREE.ConeGeometry(1, 3.5, 10), new THREE.MeshBasicMaterial({ color: 0xffa020 })); rocket.flame.rotation.x = Math.PI; rocket.flame.position.y = -0.2; rocket.flame.visible = false; g.add(rocket.flame);
  box(4, 0.4, 4, PAL.dark, 0, 0.2, 0, scene).position.set(0, 0.2, -17);
  rocket.solid = addSolid(-1.7, 1.7, -18.7, -15.3, 6.2);
})();
function launchRocket() {
  if (rocket.state !== 0) return; rocket.state = 1; rocket.t = 0; rocket.vy = 0; rocket.flame.visible = true; sfx.whoosh(); shake = 0.5; rocket.solid.on = false;
}
function updateRocket(dt) {
  const r = rocket, g = r.g;
  if (r.state === 1) {
    r.t += dt; if (r.t > 1.2) r.vy += 40 * dt; g.position.x = Math.sin(r.t * 50) * 0.05 * (r.t < 1.2 ? 1 : 0);
    g.position.y += r.vy * dt; r.flame.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.6, 1);
    for (let i = 0; i < 3; i++) spawn(g.position.x + rand(-0.5, 0.5), g.position.y, g.position.z + rand(-0.5, 0.5), rand(-2, 2), rand(-8, -3), rand(-2, 2), Math.random() < 0.5 ? 0xffffff : 0xffb040, rand(0.6, 1.4), rand(0.6, 1.1), 0, false);
    if (g.position.y > 75) { g.visible = false; r.state = 2; r.t = 0; r.flame.visible = false; for (let i = 0; i < 10; i++) setTimeout(() => firework(rand(-14, 14), rand(45, 65), rand(-34, -10)), i * 140); rainCoins(0, 25, -17, 25, 's'); rainCoins(0, 25, -17, 6, 'g'); toast('🎆'); }
  } else if (r.state === 2) { r.t += dt; if (r.t > 6) { g.position.set(0, 0, -17); g.visible = true; g.scale.setScalar(0.01); r.state = 3; r.t = 0; sfx.pop(5); } }
  else if (r.state === 3) { r.t += dt * 3; const s = Math.min(1, r.t); g.scale.setScalar(s * (1 + Math.sin(s * Math.PI) * 0.2)); if (s >= 1) { r.state = 0; r.solid.on = true; } }
}

const stairs = [];
let bridgeUp = false;
(function () {
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group(); const x = -15 - i * 2, top = 0.6 * (i + 1);
    box(2, 6.6, 4, RAINBOW[i % 8], 0, -3.3, 0, g); for (let j = 0; j < 2; j++) { const s = new THREE.Mesh(STUD_G, mat(RAINBOW[i % 8])); s.position.set(0, 0, -1 + j * 2); g.add(s); }
    g.position.set(x, -3.2, -14); scene.add(g);
    stairs.push({ g, top, cur: -3.2, c: addSolid(x - 1, x + 1, -16, -12, -3.2), delay: i * 0.12 });
  }
  // island
  for (let i = 0; i < 4; i++) brick(-38, -14, 8, 8, 1.5, RAINBOW[(i + 3) % 8], i * 1.5, i === 3);
  addGold(-38, 7.6, -14);
  for (let i = 0; i < 8; i++) addCoin(-38 + Math.cos(i * TAU / 8) * 3, 7, -14 + Math.sin(i * TAU / 8) * 3, 's');
})();
let bridgeT = 0;
function raiseBridge() { if (bridgeUp) { sfx.pop(3); return; } bridgeUp = true; bridgeT = 0; toast('🌉'); sfx.whoosh(); shake = 0.3; }
function updateBridge(dt) {
  if (!bridgeUp) return; bridgeT += dt;
  for (const s of stairs) { if (bridgeT < s.delay) continue; const prev = s.cur; s.cur += (s.top - s.cur) * Math.min(1, dt * 8); s.g.position.y = s.cur; s.c.top = s.cur; if (Math.abs(s.top - prev) > 0.1 && Math.abs(s.top - s.cur) <= 0.1 + 0.001 && !s.done) { s.done = true; sfx.pop(Math.floor(s.top / 0.6)); burst(s.g.position.x, s.top, -14, [0xffffff], 4, 4, 0.3, 0.4); } }
}

const tiles = [];
(function () {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const m = new THREE.MeshStandardMaterial({ color: RAINBOW[(i + j * 3) % 8], emissive: RAINBOW[(i + j * 3) % 8], emissiveIntensity: 0.05 });
    const x = -30 + (i - 1.5) * 3, z = 16 + (j - 1.5) * 3;
    const t = new THREE.Mesh(BOXG, m); t.scale.set(2.8, 0.3, 2.8); t.position.set(x, 0.15, z); t.receiveShadow = true; scene.add(t);
    tiles.push({ x, z, m, glow: 0, on: false, note: (i + j * 4) % 8, col: RAINBOW[(i + j * 3) % 8] });
  }
})();
function updateTiles(dt) {
  if (discoT > 0) { discoT -= dt; for (const t of tiles) if (Math.random() < dt * 3) { t.glow = 1; t.m.emissive.setHex(RAINBOW[Math.floor(rand(0, 8))]); } if (Math.random() < dt * 4) confetti(-30, 16, 4, 10); }
  for (const t of tiles) {
    const on = Math.abs(player.x - t.x) < 1.4 && Math.abs(player.z - t.z) < 1.4 && player.y < 1;
    if (on && !t.on) { t.glow = 1; t.m.emissive.setHex(t.col); sfx.note(t.note); }
    t.on = on; t.glow = Math.max(0, t.glow - dt * 0.9); t.m.emissiveIntensity = 0.05 + t.glow * 1.1 + (on ? 0.3 : 0);
  }
}
function startDisco() { discoT = 22; toast('🪩'); for (const d of ducks) d.dance = 6; }

// pond
const pond = { x: 28, z: 12, r: 9 };
const pondMesh = new THREE.Mesh(new THREE.CircleGeometry(pond.r, 32), new THREE.MeshStandardMaterial({ color: 0x27b6ff, transparent: true, opacity: 0.78, roughness: 0.1 }));
pondMesh.rotation.x = -Math.PI / 2; pondMesh.position.set(pond.x, 0.07, pond.z); scene.add(pondMesh);
const bigDuck = duckModel(2.6); bigDuck.position.set(pond.x, -9, pond.z); scene.add(bigDuck);
const bd = { state: 0, t: 0 };
function summonDuck() { if (bd.state) return; bd.state = 1; bd.t = 0; toast('🦆'); sfx.whoosh(); }
function updateBigDuck(dt, t) {
  if (!bd.state) return; bd.t += dt;
  const T = bd.t; let y;
  if (T < 1.2) y = -9 + (T / 1.2) * 9.5; else if (T < 6) y = 0.5 + Math.sin(T * 2) * 0.4; else y = 0.5 - (T - 6) * 6;
  bigDuck.position.y = y; bigDuck.rotation.y = T * 1.5;
  if (T < 1.4 && Math.random() < 0.7) for (let i = 0; i < 3; i++) spawn(pond.x + rand(-3, 3), 1, pond.z + rand(-3, 3), rand(-3, 3), rand(12, 20), rand(-3, 3), 0x7fd6ff, 0.5, 1.4, 25, false);
  if (T > 1.3 && !bd.honked) { bd.honked = true; sfx.honk(); sfx.honk(); rainCoins(pond.x, 8, pond.z, 24, 's'); rainCoins(pond.x, 8, pond.z, 4, 'g'); shake = 0.4; }
  if (T > 3 && !bd.b) { bd.b = true; addCoin(pond.x + 5, 1.2, pond.z, 'b'); }
  if (T > 9) { bd.state = 0; bd.honked = false; bd.b = false; bigDuck.position.y = -9; }
}
for (let i = 0; i < 5; i++) { const d = duckModel(0.6); d.userData = { a: rand(0, TAU), r: rand(2, 7), s: rand(0.2, 0.5) }; d.position.set(pond.x, 0.3, pond.z); scene.add(d); (window._rd = window._rd || []).push(d); }

// train
const TR = 45, trainCars = [];
(function () {
  for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; const s = box(4.3, 0.15, 2.8, PAL.dark, Math.cos(a) * TR, 0.08, Math.sin(a) * TR, scene, false); s.rotation.y = -(a + Math.PI / 2); s.receiveShadow = true }
  const cols = [PAL.red, PAL.blue, PAL.yellow, PAL.green, PAL.purple];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group(); scene.add(g);
    if (i === 0) { dbrick(g, 0, 0, 4, 2, 2, PAL.red, 0.5); dbrick(g, -1, 0, 2, 2, 2, PAL.dark, 2.5, false); box(0.9, 1.4, 0.9, PAL.dark, 1, 3.3, 0, g); box(0.5, 0.6, 2.4, 0xffe27a, 2.05, 1.6, 0, g); }
    else dbrick(g, 0, 0, 4, 2, 1.6, cols[i], 0.6);
    for (const x of [-1.2, 1.2]) for (const z of [-1.05, 1.05]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), mat(0x222222)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); }
    trainCars.push(g);
  }
})();
let trainA = 0, trainToot = 0;
function updateTrain(dt) {
  trainA += dt * 0.2; trainToot -= dt;
  trainCars.forEach((g, i) => { const a = trainA - i * 4.8 / TR; g.position.set(Math.cos(a) * TR, 0, Math.sin(a) * TR); g.rotation.y = -(a + Math.PI / 2); });
  const h = trainCars[0].position;
  if (trainToot <= 0 && dist2(h.x, h.z, player.x, player.z) < 14) { trainToot = 10; sfx.toot(); burst(h.x, 5, h.z, [0xffffff], 6, 3, 0.8, 1.2); }
  if (Math.random() < dt * 8) spawn(h.x, 4.5, h.z, rand(-1, 1), rand(2, 4), rand(-1, 1), 0xffffff, rand(0.5, 1), 1, -2, false);
}
// clouds
const clouds = [];
for (let i = 0; i < 14; i++) { const g = new THREE.Group(); const n = 3 + Math.floor(rand(0, 3)); for (let k = 0; k < n; k++) box(rand(8, 14), rand(3, 5), rand(6, 10), 0xffffff, k * 6 - n * 3, rand(-1, 1), rand(-2, 2), g, false); g.position.set(rand(-150, 150), rand(38, 60), rand(-150, 150)); scene.add(g); clouds.push(g); }

// ============================================================ populate the world
// pads
addPad(0, -6, PAL.red, '🎆', () => { for (let i = 0; i < 6; i++) setTimeout(() => firework(rand(-14, 14), rand(16, 26), rand(-14, 4)), i * 160); rainCoins(0, 12, -6, 16, 's'); toast('🎆'); }, true);
addPad(-6, -6, PAL.blue, '🌙', () => { nightTarget = nightTarget ? 0 : 1; toast(nightTarget ? '🌙' : '☀️'); sfx.sparkle(); });
addPad(6, -6, PAL.green, '🚀', launchRocket);
addPad(-9, -14, PAL.orange, '🌉', raiseBridge);
addPad(-30, 7, PAL.purple, '🪩', startDisco);
addPad(28, 25, PAL.yellow, '🦆', summonDuck);
addPad(8, 5, PAL.pink, '🎩', () => { setHat((player.hat + 1) % HATS); setShirt((player.shirt + 1) % 8); sfx.tada(); burst(player.x, 3, player.z, RAINBOW, 20, 8, 0.4, 1); toast('🎩'); });
const musicPressed = new Set();
for (let i = 0; i < 8; i++) addPad(-14 + i * 4, 17, RAINBOW[i], null, p => {
  sfx.note(i); musicPressed.add(i); for (const d of ducks) if (dist2(d.x, d.z, p.x, p.z) < 12) { d.dance = 1; duckHop(d, 9); }
  for (let k = 0; k < 8; k++) spawn(p.x, 1, p.z, rand(-1, 1), rand(10, 18), rand(-1, 1), RAINBOW[i], 0.5, 1.2, 20, false);
  if (musicPressed.size === 8 && !goldEvents.pads) { goldEvents.pads = true; spawnGold(0, 20, 6); sfx.fanfare(); }
});
// bounce pads + vent
addBouncer(24, -16, 31, PAL.red); addBouncer(14, 10, 25, PAL.blue); addBouncer(-14, 8, 25, PAL.green); addBouncer(-6, -26, 25, PAL.purple);
addVent(12, -32);
coinArc(24, -16, 24, -26, 2, 10, 12, 6);
// tower + vent platform (with gold)
for (let i = 0; i < 6; i++) brick(24, -26, 8, 8, 1.5, RAINBOW[(i + 1) % 8], i * 1.5, false);
addSolid(20, 28, -30, -22, 9); addGold(24, 10.6, -26);
for (let i = 0; i < 8; i++) brick(12, -38, 6, 6, 1.5, RAINBOW[(i + 4) % 8], i * 1.5, false);
addSolid(9, 15, -41, -35, 12); addGold(12, 13.6, -38);
// lamps around plaza
for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11], [-11, 0], [11, 0], [0, 11]]) addLamp(x, z);
for (let i = 0; i < 6; i++) addLamp(-14 + (i + 0.5) * 4.7, 21);
// build spots
addBuildSpot(36, -8, 'house'); addBuildSpot(-6, 34, 'dino'); addBuildSpot(10, 34, 'castle');
// ducks
for (const [x, z] of [[6, 12], [-6, 12], [22, 20], [34, 16], [-16, -4], [16, -6], [-24, 26], [4, 26]]) addDuck(x, z);
// breakables: intro ring, then scattered
for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.3; addBreakable(Math.cos(a) * 12, Math.sin(a) * 10 - 1, i % BK.length); }
const zones = [[0, 0, 14], [0, 17, 20], [-30, 16, 12], [28, 12, 12], [24, -22, 12], [-26, -14, 18], [12, -36, 10], [36, -8, 10], [-6, 34, 8], [10, 34, 8], [0, -16, 7], [-30, 7, 4], [28, 25, 4], [-6, -26, 5], [14, 10, 4], [-14, 8, 4]];
const freeSpot = (m = 0) => { for (let k = 0; k < 60; k++) { const x = (srand() - 0.5) * 84, z = (srand() - 0.5) * 84; if (zones.every(([zx, zz, zr]) => dist2(x, z, zx, zz) > zr + m)) return [x, z]; } return [40, 40]; };
for (let i = 0; i < 46; i++) { const [x, z] = freeSpot(1); addBreakable(x, z); }
// trees (solid trunk) & flowers
for (let i = 0; i < 34; i++) {
  const [x, z] = freeSpot(2); const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(1.2, 3.5, 1.2, PAL.brown, 0, 1.75, 0, g); const c1 = srand() < 0.5 ? PAL.green : PAL.lime;
  box(5, 2, 5, c1, 0, 4.5, 0, g); box(3.4, 2, 3.4, c1, 0, 6.5, 0, g); box(1.6, 1.4, 1.6, c1, 0, 8.2, 0, g);
  addSolid(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 4);
}
for (let i = 0; i < 70; i++) { const [x, z] = freeSpot(0); const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); box(0.15, 0.9, 0.15, PAL.green, 0, 0.45, 0, g, false); const c = RAINBOW[i % 8]; box(0.6, 0.3, 0.6, c, 0, 1, 0, g, false); box(0.3, 0.35, 0.3, PAL.yellow, 0, 1.15, 0, g, false); }
// coins
coinArc(0, 8, 24, -14, 0, 0, 14, 0); coinRing(0, 0, 15, 20); coinRing(pond.x, pond.z, 11.5, 22);
coinArc(-14, 8, 14, 10, 0, 0, 10, 0);
for (let i = 0; i < 70; i++) { const [x, z] = freeSpot(-4); addCoin(x, 0.9, z, 's'); }
for (const [x, z] of [[-44, 44], [44, 44], [44, -44], [-44, -44], [-44, 0], [0, 44]]) addCoin(x, 1, z, 'b');
for (let i = 0; i < 12; i++) { const [x, z] = freeSpot(0); addCoin(x, 1, z, 'g'); }
for (let i = 0; i < 4; i++) coinArc(-12 + i * 2, -22, -12 + i * 2, -6, 0, 0, 6, 0);
// chest of studs on the dino build reveal etc handled by events

// ============================================================ main loop
let camYaw = 0, camPos = new THREE.Vector3(0, 20, 30), camLook = new THREE.Vector3(0, 2, 8);
let last = performance.now(), time = 0, dustT = 0;
const smashRing = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
smashRing.rotation.x = -Math.PI / 2; scene.add(smashRing);

function doSmash() {
  const p = player; if (p.smashCd > 0) return;
  p.smashT = 0.4; p.smashCd = 0.45; sfx.swoosh();
  let hit = 0;
  for (const o of breakables) if (o.alive && dist2(o.x, o.z, p.x, p.z) < 4 && Math.abs(p.y - 1) < 4) { smashObj(o); hit++; }
  for (const d of ducks) if (dist2(d.x, d.z, p.x, p.z) < 4) { duckHop(d, 12); sfx.quack(); }
  for (const b of bouncers) if (dist2(b.x, b.z, p.x, p.z) < 4) b.sq = 1;
  if (hit === 0) burst(p.x, 0.8, p.z, [0xffffff], 6, 5, 0.3, 0.4);
}

function updatePlayer(dt, inp) {
  const p = player;
  let mx = inp.mx, my = inp.my; const mag = Math.hypot(mx, my); if (mag > 1) { mx /= mag; my /= mag; }
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const dx = rx * mx + fx * -my, dz = rz * mx + fz * -my;
  const inWater = dist2(p.x, p.z, pond.x, pond.z) < pond.r && p.y < 0.8;
  if (inWater !== p.wet) { p.wet = inWater; sfx.splash(); burst(p.x, 0.5, p.z, [0x7fd6ff, 0xffffff], 14, 7, 0.35, 0.8); }
  const speed = (p.smashT > 0 ? 9 : 10.5) * (inWater ? 0.55 : 1);
  const k = 1 - Math.exp(-(mag > 0.05 ? 16 : 10) * dt);
  p.vx += (dx * speed - p.vx) * k; p.vz += (dz * speed - p.vz) * k;
  const nx = p.x + p.vx * dt; if (!blocked(nx, p.z, p.y)) p.x = nx; else p.vx = 0;
  const nz = p.z + p.vz * dt; if (!blocked(p.x, nz, p.y)) p.z = nz; else p.vz = 0;
  if (mag > 0.1 && p.smashT <= 0) { const target = Math.atan2(dx, dz); p.face += (((target - p.face + Math.PI * 3) % TAU) - Math.PI) * Math.min(1, dt * 16); }
  // vertical
  const g = groundAt(p.x, p.z, p.y);
  p.coyote -= dt;
  if (inp.jumpP) p.jumpBuf = 0.14; p.jumpBuf = (p.jumpBuf || 0) - dt;
  if (p.jumpBuf > 0) {
    if (p.grounded || p.coyote > 0) { p.vy = 17; p.grounded = false; p.coyote = 0; p.jumpBuf = 0; sfx.jump(); }
    else if (!p.dbl) { p.vy = 16; p.dbl = true; p.spinFlip = 1; p.jumpBuf = 0; sfx.dbl(); burst(p.x, p.y, p.z, [0xffffff], 6, 4, 0.3, 0.5); }
  }
  p.gliding = false;
  for (const v of vents) if (dist2(p.x, p.z, v.x, v.z) < 2.6 && p.y < 16) { p.vy += 95 * dt; if (p.vy > 13) p.vy = 13; p.dbl = false; p.grounded = false; p.gliding = true; }
  if (!p.gliding) {
    if (inp.jump && p.vy < -3 && !p.grounded && p.dbl) { p.vy = -3; p.gliding = true; }
    p.vy -= 45 * dt; if (!inp.jump && p.vy > 6) p.vy -= 20 * dt; // variable jump height
  }
  p.y += p.vy * dt;
  if (p.y <= g && p.vy <= 0) {
    if (!p.grounded && p.vy < -8) { sfx.land(); p.squash = 1; burst(p.x, 0.2, p.z, [0xffffff], 5, 4, 0.3, 0.4); }
    p.y = g; p.vy = 0; p.grounded = true; p.dbl = false; p.coyote = 0.1;
  } else if (p.y > g + 0.05) { if (p.grounded) p.coyote = 0.1; p.grounded = false; }
  for (const b of bouncers) if (dist2(p.x, p.z, b.x, b.z) < 1.8 && p.y < 1.4 && b.cd <= 0 && p.vy <= 0) { p.vy = b.power; p.grounded = false; p.dbl = false; b.sq = 1; b.cd = 0.4; sfx.boing(); rumble(0.7, 200); burst(b.x, 1.2, b.z, RAINBOW, 10, 6, 0.35, 0.7); }
  // actions
  p.smashCd -= dt; p.smashT -= dt; p.honkT -= dt;
  if (inp.smashP) doSmash();
  if (inp.honkP && p.honkT <= 0) { p.honkT = 1.3; honkAt(p.x, p.z); }
  // dust when running
  dustT -= dt; if (p.grounded && mag > 0.5 && dustT <= 0) { dustT = 0.13; spawn(p.x, 0.2, p.z, rand(-1, 1), rand(1, 3), rand(-1, 1), inWater ? 0x9fdcff : 0xffffff, 0.3, 0.4, 5, false); }
  p.squash = Math.max(0, p.squash - dt * 5);
  // ---------- animate model
  pg.position.set(p.x, p.y - (inWater ? 0.6 : 0), p.z);
  const b = P.body; const sp = Math.hypot(p.vx, p.vz); p.step += sp * dt * 1.3;
  let ry = p.face, la = 0, ra = 0, lx = 0, rxr = 0, bob = 0, sc = 1 + Math.sin(time * 2.5) * 0.008;
  if (!p.grounded && !p.gliding) { la = -2.4; ra = -2.4; lx = 0.3; rxr = -0.3; }
  else if (p.gliding) { la = -1.4; ra = -1.4; b.rotation.z = 0; }
  else if (sp > 0.5) { const s = Math.sin(p.step); lx = s * 0.9; rxr = -s * 0.9; la = -s * 0.9; ra = s * 0.9; bob = Math.abs(Math.cos(p.step)) * 0.18; }
  if (p.honkT > 0.3) { ry += p.honkT * 9; la = -2.8 + Math.sin(time * 20) * 0.4; ra = -2.8 - Math.sin(time * 20) * 0.4; bob = Math.abs(Math.sin(time * 12)) * 0.4; }
  if (p.smashT > 0) { ry += (1 - p.smashT / 0.4) * TAU * 2; la = -1.57; ra = -1.57; }
  if (p.spinFlip > 0) { p.spinFlip -= dt * 2.6; b.rotation.x = (1 - Math.max(0, p.spinFlip)) * TAU * -1; } else b.rotation.x = p.gliding ? 0.25 : 0;
  pg.rotation.y = ry;
  P.legL.rotation.x = lx; P.legR.rotation.x = rxr; P.armL.rotation.x = la; P.armR.rotation.x = ra;
  if (p.gliding) { P.armL.rotation.z = -1.2; P.armR.rotation.z = 1.2; } else { P.armL.rotation.z = 0.05; P.armR.rotation.z = -0.05; }
  b.position.y = bob; const sq = p.squash; pg.scale.set(1 + sq * 0.25, 1 - sq * 0.25, 1 + sq * 0.25);
  P.cape.rotation.x = -Math.min(0.9, sp * 0.06 + (p.grounded ? 0 : 0.5)); P.cape.position.z = -0.6;
  if (P.prop) P.prop.rotation.y += dt * (p.grounded ? 8 : 30);
  if (p.gliding && p.vy > 5) for (let i = 0; i < 1; i++) spawn(p.x + rand(-1, 1), p.y, p.z + rand(-1, 1), 0, -3, 0, 0xffffff, 0.3, 0.5, 0, false);
  if (smashRing) { if (p.smashT > 0) { const u = 1 - p.smashT / 0.4; smashRing.position.set(p.x, p.y + 0.5, p.z); smashRing.scale.setScalar(0.6 + u * 1.3); smashRing.material.opacity = (1 - u) * 0.8; } else smashRing.material.opacity = 0; }
}

function tick(now) {
  if (!window.__manual) requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  const inp = readInput();
  if (started) {
    comboT -= dt; if (comboT <= 0) combo = 0;
    camYaw += inp.cam * 2 * dt;
    updatePlayer(dt, inp);
    updatePads(dt, time); updateTiles(dt); updateCoins(dt); updateGolds(dt, time); updateBreakables(dt); updateDucks(dt, time); updateBuilds(dt, time);
    updateRocket(dt); updateBridge(dt); updateBigDuck(dt, time); updateTrain(dt);
    for (const b of bouncers) { b.cd -= dt; b.sq = Math.max(0, b.sq - dt * 4); b.top.position.y = 1.1 - b.sq * 0.5; b.spring.scale.y = 1 - b.sq * 0.6; b.arrow.position.y = 3.2 + Math.sin(time * 5) * 0.3; }
    for (const v of vents) { v.fan.rotation.y += dt * 12; if (Math.random() < dt * 30) spawn(v.x + rand(-1.5, 1.5), 0.8, v.z + rand(-1.5, 1.5), 0, rand(8, 12), 0, 0xd8f6ff, 0.35, 1.2, 0, false); }
    (window._rd || []).forEach(d => { const u = d.userData; u.a += u.s * dt; d.position.set(pond.x + Math.cos(u.a) * u.r, 0.2 + Math.sin(time * 2 + u.a * 5) * 0.15, pond.z + Math.sin(u.a) * u.r); d.rotation.y = -u.a; });
    if (pondMesh) pondMesh.material.opacity = 0.72 + Math.sin(time * 2) * 0.05;
  } else { camYaw += dt * 0.15; }
  updateParticles(dt);
  // day/night
  night += (nightTarget - night) * Math.min(1, dt * 1.5);
  scene.background.lerpColors(DAY, NIGHT, night); scene.fog.color.copy(scene.background);
  hemi.intensity = 0.95 - 0.55 * night; sun.intensity = 0.9 - 0.7 * night;
  lampMats.forEach(m => m.emissiveIntensity = 0.2 + night * 2.2); halos.forEach(h => h.material.opacity = night * 0.9);
  stars.material.opacity = night; stars.position.copy(camera.position);
  clouds.forEach(c => { c.position.x += dt * 2; if (c.position.x > 160) c.position.x = -160; });
  // camera
  const p = player, dist = 21, h = 15.5;
  const tp = new THREE.Vector3(p.x + Math.sin(camYaw) * dist, p.y * 0.6 + h, p.z + Math.cos(camYaw) * dist);
  camPos.lerp(tp, 1 - Math.exp(-6 * dt)); camLook.lerp(new THREE.Vector3(p.x, p.y * 0.7 + 1.5, p.z), 1 - Math.exp(-9 * dt));
  shake = Math.max(0, shake - dt * 1.2);
  camera.position.copy(camPos).add(new THREE.Vector3(rand(-1, 1) * shake, rand(-1, 1) * shake, rand(-1, 1) * shake));
  camera.lookAt(camLook);
  sun.position.set(p.x + 30, 55, p.z + 22); sun.target.position.set(p.x, 0, p.z); sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
}
hud(); setHat(0);
camPos.set(0, 20, 30);
requestAnimationFrame(tick);
window.__game = { tick, keys, player, startGame, coins, golds, breakables, ducks, scene, camera };
})();
