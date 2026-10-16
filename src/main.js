import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import './style.css';
import { LEVELS, coinPositions } from './levels.js';
import { createPlayer, stepPlayer, jump, platformAt, inside, clamp } from './physics.js';
import { TEXT } from './i18n.js';

const $ = s => document.querySelector(s);
const show = (s, visible) => $(s).classList.toggle('hidden', !visible);
let lang = 'ca', save = { unlocked: 0, results: {}, sound: true }, storageAvailable = true;
try {
  const data = JSON.parse(localStorage.getItem('d3oiram-v1') || 'null');
  if (data && typeof data === 'object') {
    save.unlocked = clamp(Number(data.unlocked) || 0, 0, 2);
    save.results = data.results && typeof data.results === 'object' ? data.results : {};
    save.sound = data.sound !== false;
    if (TEXT[data.lang]) lang = data.lang;
  }
} catch { storageAvailable = false; }
const t = key => TEXT[lang][key] || key;
function persist() {
  try { localStorage.setItem('d3oiram-v1', JSON.stringify({ ...save, lang })); }
  catch { storageAvailable = false; }
}
let selected = save.unlocked, levelIndex = selected, mode = 'menu', modalMode = '', gameTime = 0, sceneTime = 0;
let p, health = 3, invincible = 0, coins = 0, shards = 0, checkpoint = false, checkpointPos;
let platforms = [], islandMeshes = [], collectibles = [], enemies = [], decorative = [], particles = [], springs = [];
let ownedGeometry = [];
let world, portal, checkpointMesh, portalLight, playerMesh, playerShadow;
let jumpQueued = false, jumpBuffer = 0, cameraYaw = .52, targetYaw = .52, drag = null, toastUntil = 0, lastPortalMessage = 0;
const keys = new Set(), touchInput = { x: 0, z: 0 }, camInput = { left: false, right: false };
const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  $('#error-message').textContent = 'Aquest navegador no té WebGL 2 disponible. Prova amb una versió actual de Chrome, Firefox, Edge o Safari amb acceleració gràfica.';
  show('#error', true); show('#loading', false);
  throw new Error('WebGL 2 unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 220);
const ambient = new THREE.HemisphereLight(0xfff8e1, 0x5c7e87, 2.4); scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffe5b2, 3.4); sun.position.set(-20, 35, 15); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24; sun.shadow.camera.near = .5; sun.shadow.camera.far = 90;
sun.shadow.normalBias = .04; scene.add(sun, sun.target);
const materials = new Map();
function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra }));
  return materials.get(key);
}
const GEO = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  lowSphere: new THREE.IcosahedronGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  coin: new THREE.CylinderGeometry(.28, .28, .1, 16),
  crystal: new THREE.OctahedronGeometry(.5),
  ring: new THREE.TorusGeometry(1, .08, 8, 48)
};
function mesh(geo, color, scale, position, parent = world, extra = {}) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  if (scale) m.scale.set(...scale); if (position) m.position.set(...position);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function orb(color, scale, position, parent, extra) { return mesh(GEO.sphere, color, scale, position, parent, extra); }
function box(color, scale, position, parent) { return mesh(GEO.box, color, scale, position, parent); }
// Repeatable decoration keeps saved runs consistent and avoids changing the route.
function random(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tree(x, y, z, size, color, parent) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  mesh(GEO.cylinder, '#a47d59', [.18 * size, 1.5 * size, .18 * size], [0, .75 * size, 0], g);
  mesh(GEO.lowSphere, color, [1.05 * size, 1.3 * size, 1.05 * size], [0, 2 * size, 0], g);
  mesh(GEO.lowSphere, color, [.8 * size, .9 * size, .8 * size], [.45 * size, 2.4 * size, .1], g);
}
function flower(x, y, z, color, parent) {
  mesh(GEO.cylinder, '#6b9760', [.025, .35, .025], [x, y + .16, z], parent);
  mesh(GEO.lowSphere, color, [.13, .08, .13], [x, y + .37, z], parent);
}
function batchStatic(group, exclusions = new Set()) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), batches = new Map(), removed = [];
  group.traverse(m => {
    if (!m.isMesh || exclusions.has(m)) return;
    const geometry = m.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
    if (!batches.has(m.material)) batches.set(m.material, []);
    batches.get(m.material).push(geometry); removed.push(m);
  });
  removed.forEach(m => m.removeFromParent());
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) throw new Error('Could not batch island geometry');
    ownedGeometry.push(geometry);
    const m = new THREE.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
}
function makeIsland(b, i, level, rng) {
  const group = new THREE.Group(); group.position.set(b.x, b.y, b.z); world.add(group);
  box(level.earth, [b.w, 1.2, b.d], [0, -.7, 0], group);
  box(level.grass, [b.w + .08, .3, b.d + .08], [0, -.15, 0], group);
  const rock = mesh(GEO.cone, level.earth, [b.w * .59, 3.7 + rng() * 2, b.d * .59], [0, -3.2, 0], group);
  rock.rotation.z = Math.PI; rock.rotation.y = .5;
  // Light stone strata along exposed edges.
  for (let k = 0; k < 3; k++) box('#e9d1a0', [.7 + rng() * 1.2, .12, .08], [(rng() - .5) * b.w * .7, -.5 - k * .23, b.d / 2 + .01], group);
  if (i % 3 === 0 || i === 0) {
    tree(-b.w * .34, 0, -b.d * .29, i === 0 ? 1.55 : .9, levelIndex === 2 ? '#7399ae' : i % 2 ? '#94b96b' : '#689d70', group);
    if (b.w > 9) tree(b.w * .33, 0, b.d * .26, 1.05, levelIndex === 1 ? '#d1935e' : '#a9c872', group);
  }
  for (let k = 0; k < 9; k++) {
    // Decorations stay near edges, never in the centre of a landing area.
    const x = (rng() - .5) * (b.w - .7), z = (rng() > .5 ? 1 : -1) * (b.d / 2 - .4 - rng() * .5);
    flower(x, 0, z, ['#faf0c8', '#e8b0a0', '#f4d06f'][k % 3], group);
  }
  if (i === 0 || i === 5 || i === 11) {
    const waterfall = box('#96d7d9', [.7, 8, .15], [b.w * .27, -4.2, b.d / 2 + .1], group);
    waterfall.material = mat('#a6e9e4', { transparent: true, opacity: .48, roughness: .3 });
    decorative.push({ kind: 'water', mesh: waterfall, base: -4.2 });
  }
  return group;
}
function makePlayer() {
  const g = new THREE.Group(); world.add(g);
  const body = orb('#4a9b96', [.42, .49, .32], [0, .71, 0], g);
  const head = orb('#8bcac0', [.49, .43, .4], [0, 1.25, 0], g);
  orb('#b6ded0', [.22, .25, .12], [0, .79, .28], g);
  for (const s of [-1, 1]) {
    orb('#80beb1', [.14, .26, .16], [s * .28, 1.63, -.03], g);
    orb('#ebf3d7', [.145, .18, .065], [s * .19, 1.3, .36], g);
    orb('#183c37', [.067, .1, .042], [s * .19, 1.29, .414], g);
    const foot = orb('#234d4c', [.18, .13, .27], [s * .23, .14, .06], g);
    const arm = orb('#79bdb0', [.13, .32, .13], [s * .48, .75, .02], g);
    g.userData[s < 0 ? 'leftFoot' : 'rightFoot'] = foot;
    g.userData[s < 0 ? 'leftArm' : 'rightArm'] = arm;
  }
  const scarf = mesh(GEO.cylinder, '#ec8a61', [.34, .14, .34], [0, 1, 0], g);
  box('#ec8a61', [.18, .48, .07], [-.22, .78, -.36], g).rotation.z = -.28;
  const backpack = box('#d8ae65', [.48, .5, .21], [0, .73, -.32], g); backpack.rotation.x = -.1;
  g.userData.body = body; g.userData.head = head; g.userData.scarf = scarf;
  return g;
}
function makeGuardian(config, level) {
  const island = platforms[config.island];
  const g = new THREE.Group(); world.add(g);
  mesh(GEO.lowSphere, levelIndex === 2 ? '#b995ce' : '#d28a68', [.57, .49, .57], [0, .5, 0], g);
  for (const s of [-1, 1]) {
    orb('#fff2ce', [.12, .15, .09], [s * .2, .59, .5], g);
    orb('#443f47', [.055, .08, .04], [s * .2, .59, .58], g);
    box('#68605a', [.25, .12, .35], [s * .28, .12, .05], g);
  }
  const crown = mesh(GEO.cone, level.accent, [.32, .25, .32], [0, 1, 0], g);
  g.position.set(island.x, island.y, island.z);
  return { ...config, mesh: g, alive: true, phase: config.island * 1.2 };
}
function disposeWorld() {
  if (!world) return;
  world.userData.dispose?.();
  ownedGeometry.forEach(g => g.dispose()); ownedGeometry = [];
  scene.remove(world);
  // Geometry/material caches are shared across levels. Dispose only owned particle materials.
  particles.forEach(a => a.mesh.material.dispose()); particles = [];
}
function loadLevel(index) {
  disposeWorld(); levelIndex = index;
  const l = LEVELS[index]; world = new THREE.Group(); scene.add(world);
  scene.background = new THREE.Color(l.sky); scene.fog = new THREE.Fog(l.fog, 45, 150);
  ambient.intensity = index === 2 ? 1.7 : 2.4; sun.intensity = index === 2 ? 1.7 : 3.4;
  sun.color.set(index === 2 ? '#c8d5ff' : '#ffe5b2');
  const rng = random(701 + index);
  decorative = []; springs = []; collectibles = []; enemies = [];
  sceneTime = 0; gameTime = 0; coins = 0; shards = 0; health = 3; invincible = 0; checkpoint = false; lastPortalMessage = -10;
  checkpointPos = l.spawn.slice(); p = createPlayer(l.spawn); jumpBuffer = 0;
  platforms = l.islands.map(b => platformAt(b, 0));
  islandMeshes = l.islands.map((b, i) => makeIsland(b, i, l, rng));
  // Distant islands and clouds give depth without adding invisible collision surfaces.
  for (let i = 0; i < 22; i++) {
    const cloud = new THREE.Group(); cloud.position.set((rng() - .5) * 130, -5 - rng() * 15, 25 - rng() * 150);
    for (let j = 0; j < 4; j++) {
      const m = orb(index === 2 ? '#7d83a5' : '#f6f5df', [3 + rng() * 4, .9 + rng(), 2 + rng() * 3], [j * 3, rng(), rng()], cloud);
      m.castShadow = false; m.receiveShadow = false;
    }
    world.add(cloud); batchStatic(cloud); cloud.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } }); decorative.push({ kind: 'cloud', mesh: cloud, phase: rng() * 6, base: cloud.position.x });
  }
  if (index === 2) {
    for (let i = 0; i < 85; i++) orb('#ffffd1', [.06, .06, .06], [(rng() - .5) * 170, 20 + rng() * 65, -20 - rng() * 125], world, { emissive: '#ffffcf', emissiveIntensity: 1 });
    orb('#ecead5', [5, 5, 5], [-32, 45, -95], world, { emissive: '#eeebcd', emissiveIntensity: .5 });
  } else orb('#fff3cb', [6, 6, 6], [-42, 45, -105], world, { emissive: '#fff3cb', emissiveIntensity: .8 });
  // Broken arches are decorative and sit behind safe landing zones.
  [3, 7, 11].forEach(i => {
    const b = platforms[i], g = islandMeshes[i];
    for (const s of [-1, 1]) {
      box(index === 2 ? '#adabc3' : '#e8d1a4', [.6, 2.4, .6], [s * (b.w / 2 - .6), 1.2, -b.d / 2 + .7], g);
      box('#f3dfb6', [.95, .22, .9], [s * (b.w / 2 - .6), 2.4, -b.d / 2 + .7], g);
    }
  });
  const animated = new Set(decorative.filter(a => a.kind === 'water').map(a => a.mesh));
  islandMeshes.forEach(group => batchStatic(group, animated));
  coinPositions(l).forEach((pos, i) => {
    const m = mesh(GEO.coin, '#efc24f', null, pos, world, { metalness: .6, roughness: .25, emissive: '#9e6f12', emissiveIntensity: .15 });
    m.rotation.x = Math.PI / 2; collectibles.push({ kind: 'coin', mesh: m, pos, collected: false, phase: i * .7 });
  });
  l.shards.forEach((pos, i) => {
    const g = new THREE.Group(); g.position.set(...pos); world.add(g);
    mesh(GEO.crystal, index === 2 ? '#e7c4fc' : '#b5f3e5', [1, 1.35, 1], [0, 0, 0], g, { metalness: .35, roughness: .15, emissive: '#5ac7bb', emissiveIntensity: .35 });
    const ring = mesh(GEO.ring, '#f6e9a3', [.78, .78, .78], [0, 0, 0], g); ring.rotation.x = Math.PI / 2;
    collectibles.push({ kind: 'shard', mesh: g, pos, collected: false, phase: i });
  });
  const cp = platforms[l.checkpoint];
  checkpointMesh = mesh(GEO.ring, '#54bcb1', [.85, .85, .85], [cp.x + 1.6, cp.y + .1, cp.z + 1.6], world, { emissive: '#4fd2ba', emissiveIntensity: .5 });
  checkpointMesh.rotation.x = -Math.PI / 2;
  for (const i of l.springs) {
    const b = platforms[i]; const m = mesh(GEO.cylinder, '#f1cb66', [.65, .18, .65], [b.x, b.y + .09, b.z], world);
    const r = mesh(GEO.ring, '#fff5c7', [.48, .48, .48], [0, .53, 0], m); r.rotation.x = Math.PI / 2;
    springs.push({ mesh: m, island: i, cooldown: 0 });
  }
  enemies = l.enemies.map(c => makeGuardian(c, l));
  const goal = l.goal; portal = new THREE.Group(); portal.position.set(...goal); world.add(portal);
  mesh(GEO.cylinder, '#e2d5af', [1.6, .3, 1.6], [0, .15, 0], portal);
  const ring = mesh(GEO.ring, '#7eaba1', [1.35, 1.35, 1.35], [0, 1.8, 0], portal);
  portal.userData.ring = ring;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), mat('#b3e6c2', { transparent: true, opacity: .17, side: THREE.DoubleSide, emissive: '#8be2bb', emissiveIntensity: 1 }));
  disc.position.y = 1.8; portal.add(disc); portal.userData.disc = disc;
  portalLight = mesh(GEO.cylinder, '#f6eead', [.15, 30, .15], [0, 15, 0], portal, { transparent: true, opacity: .16, emissive: '#fff1a0', emissiveIntensity: .5 });
  playerMesh = makePlayer(); playerMesh.position.set(p.x, p.y, p.z);
  playerShadow = new THREE.Mesh(new THREE.CircleGeometry(.5, 24), new THREE.MeshBasicMaterial({ color: '#2e514b', transparent: true, opacity: .23, depthWrite: false }));
  playerShadow.rotation.x = -Math.PI / 2; world.add(playerShadow);
  // This one unshared material belongs to the scene and is explicitly disposed on next load.
  const shadowMaterial = playerShadow.material;
  const shadowGeometry = playerShadow.geometry;
  const discGeometry = disc.geometry;
  world.userData.dispose = () => { shadowMaterial.dispose(); shadowGeometry.dispose(); discGeometry.dispose(); };
  cameraYaw = targetYaw = .52;
  camera.position.set(p.x + 11, p.y + 12, p.z + 17); camera.lookAt(p.x, p.y, p.z - 3);
  updateHUD();
}
function updateHUD() {
  $('#world-name').textContent = LEVELS[levelIndex].name[lang];
  $('#world-number').textContent = `${t('world')} 0${levelIndex + 1}`;
  $('#coins').textContent = coins;
  $('#shards').textContent = `${shards} / 3`;
  $('#hearts').textContent = '♥'.repeat(health) + '♡'.repeat(3 - health);
  $('#objective').textContent = t(shards === 3 ? 'portalOpen' : 'objective');
  $('#desktop-help').innerText = t('help');
}
function translate() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(e => { e.innerHTML = t(e.dataset.i18n); });
  $('#language').value = lang;
  $('#play span:first-child').textContent = t(save.unlocked ? 'continue' : 'play');
  $('#sound').textContent = save.sound ? '♫' : '♪̸';
  updateLevelSelect(); if (p) updateHUD();
}
function updateLevelSelect() {
  const el = $('#level-select'); el.replaceChildren();
  LEVELS.forEach((l, i) => {
    const b = document.createElement('button'); b.textContent = `${i > save.unlocked ? '⌑ ' : ''}0${i + 1} · ${l.name[lang]}`;
    b.disabled = i > save.unlocked; b.classList.toggle('selected', i === selected);
    b.onclick = () => { selected = i; loadLevel(i); updateLevelSelect(); };
    el.append(b);
  });
}
let audio, master, nextNote = 0, noteIndex = 0;
function initAudio() {
  if (!save.sound) return;
  try {
    if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); master = audio.createGain(); master.gain.value = .18; master.connect(audio.destination); }
    audio.resume().catch(() => {});
  } catch { /* Gameplay remains available without an audio device. */ }
}
function tone(freq, duration = .14, type = 'sine', volume = .24, when = 0) {
  if (!save.sound || !audio || audio.state !== 'running') return;
  const start = audio.currentTime + when, osc = audio.createOscillator(), amp = audio.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, start); amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + .012); amp.gain.exponentialRampToValueAtTime(.001, start + duration);
  osc.connect(amp); amp.connect(master); osc.start(start); osc.stop(start + duration + .02);
}
function sound(kind) {
  initAudio();
  if (kind === 'jump') tone(p.jumps === 2 ? 620 : 420, .14, 'triangle');
  if (kind === 'coin') { tone(880, .1); tone(1174, .14, 'sine', .2, .07); }
  if (kind === 'shard' || kind === 'win') [523, 659, 784, 1046].forEach((f, i) => tone(f, .38, 'triangle', .22, i * .09));
  if (kind === 'hurt') { tone(170, .22, 'triangle'); tone(120, .3, 'sine', .25, .1); }
  if (kind === 'spring') [450, 700, 1000].forEach((f, i) => tone(f, .16, 'sine', .2, i * .06));
}
function music() {
  if (mode !== 'playing' || !audio || audio.state !== 'running' || !save.sound) return;
  if (audio.currentTime > nextNote) {
    const melodies = [[261.63,329.63,392,523.25,440,392,329.63,293.66],[293.66,349.23,440,587.33,523.25,440,349.23,329.63],[220,261.63,329.63,440,392,329.63,293.66,261.63]];
    tone(melodies[levelIndex][noteIndex++ % 8], .65, 'sine', .07);
    nextNote = audio.currentTime + .48;
  }
}
function toast(key) { $('#toast').textContent = t(key); $('#toast').classList.add('visible'); toastUntil = performance.now() + 2600; }
function burst(x, y, z, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(GEO.lowSphere, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    m.scale.setScalar(.05 + Math.random() * .07); m.position.set(x, y, z); world.add(m);
    particles.push({ mesh: m, vx: (Math.random() - .5) * 5, vy: 2 + Math.random() * 4, vz: (Math.random() - .5) * 5, life: .6 + Math.random() * .5 });
  }
}
function clearInput() { keys.clear(); touchInput.x = touchInput.z = 0; jumpQueued = false; jumpBuffer = 0; drag = null; camInput.left = camInput.right = false; resetStick(); }
function start(index = selected) {
  clearInput(); loadLevel(index); mode = 'playing'; show('#menu', false); show('#modal', false); show('#hud', true); show('#touch', coarse);
  initAudio(); nextNote = 0; canvas.focus();
}
function menu() {
  clearInput(); mode = 'menu'; show('#menu', true); show('#modal', false); show('#hud', false); show('#touch', false);
  selected = Math.min(levelIndex, save.unlocked); loadLevel(selected); translate();
}
function modal(tag, title, body, primary, action, secondary = t('menu'), secondaryAction = menu) {
  clearInput(); mode = 'modal'; show('#modal', true); show('#touch', false);
  $('#modal-tag').textContent = tag; $('#modal-title').textContent = title; $('#modal-body').innerHTML = body;
  $('#modal-primary').textContent = primary; $('#modal-primary').onclick = action;
  $('#modal-secondary').textContent = secondary; $('#modal-secondary').onclick = secondaryAction;
  $('#modal-primary').focus();
}
function resume() { mode = 'playing'; show('#modal', false); show('#touch', coarse); canvas.focus(); }
function pause() {
  if (mode !== 'playing') return;
  modalMode = 'pause';
  modal(`${t('world')} 0${levelIndex + 1}`, t('paused'), `<p>${t('pauseBody')}</p><button class="text-btn" id="restart">${t('restart')}</button>`, t('resume'), resume);
  $('#restart').onclick = () => start(levelIndex);
}
function help() {
  modalMode = 'help';
  const controls = [['move','moveKeys'],['jump','jumpKeys'],['double','doubleKeys'],['camera','cameraKeys'],['check','checkKeys'],['paused','pauseKeys']];
  modal('D3oiraM · 01', t('helpTitle'), `<p>${t('helpBody')}</p><div class="control-list">${controls.map(([a,b]) => `<p><b>${t(a)}</b>${t(b)}</p>`).join('')}</div>`, t('ready'), () => start(selected));
}
function respawn() {
  p = createPlayer(checkpointPos); p.grounded = true; p.platform = checkpoint ? LEVELS[levelIndex].checkpoint : 0;
  invincible = 2; playerMesh.visible = true;
  camera.position.set(p.x + Math.sin(cameraYaw) * 15, p.y + 10, p.z + Math.cos(cameraYaw) * 15);
}
function damage(fell = false) {
  if (invincible > 0 && !fell) return;
  health--; invincible = 2; sound('hurt'); updateHUD();
  if (health <= 0) {
    health = 3; respawn(); updateHUD(); modalMode = 'lost';
    modal('↻', t('lost'), `<p>${t('lostBody')}</p>`, t('resume'), resume);
  } else { toast(fell ? 'fall' : 'hurt'); respawn(); }
}
const formatTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function complete() {
  if (mode !== 'playing') return;
  const prev = save.results[levelIndex];
  save.results[levelIndex] = { time: Math.min(Number(prev?.time) || Infinity, gameTime), coins: Math.max(Number(prev?.coins) || 0, coins) };
  save.unlocked = Math.max(save.unlocked, Math.min(2, levelIndex + 1)); persist(); sound('win');
  const end = levelIndex === 2; modalMode = 'win';
  modal('✦ ✦ ✦', t(end ? 'finished' : 'win'), `<p>${t(end ? 'finishedBody' : 'winBody')}</p><div class="stat-row"><span>◈ ${coins}<small>${t('coins')}</small></span><span>${formatTime(gameTime)}<small>${t('time')}</small></span><span>${formatTime(save.results[levelIndex].time)}<small>${t('best')}</small></span></div>${storageAvailable ? `<p>${t('saved')}</p>` : ''}`, t(end ? 'again' : 'next'), () => { selected = end ? 0 : levelIndex + 1; start(selected); });
}
function update(dt) {
  const l = LEVELS[levelIndex], previousTime = sceneTime; sceneTime += dt;
  platforms = l.islands.map((b, i) => {
    const platform = platformAt(b, sceneTime, previousTime);
    islandMeshes[i].position.set(platform.x, platform.y, platform.z); return platform;
  });
  if (mode === 'playing') {
    gameTime += dt; invincible = Math.max(0, invincible - dt);
    const keyX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const keyZ = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    const inputX = keyX + touchInput.x, inputZ = keyZ + touchInput.z;
    targetYaw += ((keys.has('KeyE') || camInput.right ? 1 : 0) - (keys.has('KeyQ') || camInput.left ? 1 : 0)) * dt * 1.9;
    cameraYaw += (targetYaw - cameraYaw) * (1 - Math.exp(-10 * dt));
    const c = Math.cos(cameraYaw), s = Math.sin(cameraYaw);
    if (jumpQueued) { jumpBuffer = .13; jumpQueued = false; }
    if (jumpBuffer > 0) { if (jump(p)) { sound('jump'); burst(p.x, p.y + .2, p.z, '#eaf8d4', 6); jumpBuffer = 0; } else jumpBuffer -= dt; }
    const wasGrounded = p.grounded;
    stepPlayer(p, { x: inputX * c + inputZ * s, z: -inputX * s + inputZ * c }, platforms, dt);
    if (!wasGrounded && p.grounded) burst(p.x, p.y + .06, p.z, '#d9e7b8', 5);
    if (p.y < -18) { damage(true); return; }
    if (!checkpoint && p.grounded && p.platform === l.checkpoint) {
      checkpoint = true; const b = platforms[l.checkpoint]; checkpointPos = [b.x, b.y, b.z + 1.6];
      checkpointMesh.material = mat('#e8f79b', { emissive: '#b8ed6f', emissiveIntensity: .65 }); toast('checkpoint'); sound('shard');
    }
    for (const item of collectibles) {
      if (item.collected) continue;
      const dist = Math.hypot(p.x - item.mesh.position.x, p.y + .8 - item.mesh.position.y, p.z - item.mesh.position.z);
      if (dist < (item.kind === 'shard' ? 1.15 : .88)) {
        item.collected = true; item.mesh.visible = false;
        if (item.kind === 'coin') { coins++; sound('coin'); } else { shards++; sound('shard'); toast(shards === 3 ? 'portalOpen' : 'crystal'); }
        burst(item.mesh.position.x, item.mesh.position.y, item.mesh.position.z, item.kind === 'coin' ? '#ffe093' : '#b6fae2', 15); updateHUD();
      }
    }
    for (const spring of springs) {
      spring.cooldown = Math.max(0, spring.cooldown - dt);
      const b = platforms[spring.island];
      if (spring.cooldown === 0 && p.grounded && p.platform === spring.island && Math.hypot(p.x - b.x, p.z - b.z) < .85) {
        p.vy = 16; p.grounded = false; p.coyote = 0; p.jumps = 1; p.platform = -1;
        spring.cooldown = .7; sound('spring'); toast('spring'); burst(p.x, p.y, p.z, '#fff3a3', 15);
      }
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      const b = platforms[e.island];
      e.mesh.position.set(b.x, b.y + Math.sin(sceneTime * 6 + e.phase) * .035, b.z);
      e.mesh.position[e.axis] += Math.sin(sceneTime * 1.2 + e.phase) * e.range;
      e.mesh.rotation.y = e.axis === 'x' ? Math.cos(sceneTime * 1.2 + e.phase) > 0 ? Math.PI / 2 : -Math.PI / 2 : Math.cos(sceneTime * 1.2 + e.phase) > 0 ? 0 : Math.PI;
      const distance = Math.hypot(p.x - e.mesh.position.x, p.z - e.mesh.position.z);
      if (distance < .86 && p.y < b.y + 1.15 && p.y + 1.2 > b.y + .2) {
        if (p.vy < -1 && p.y > b.y + .55) {
          e.alive = false; e.mesh.visible = false; p.vy = 9; p.jumps = 1;
          sound('coin'); burst(e.mesh.position.x, b.y + .8, e.mesh.position.z, '#f4c69a', 18);
        } else if (invincible <= 0) { damage(); return; }
      }
    }
    if (Math.hypot(p.x - l.goal[0], p.z - l.goal[2]) < 1.5 && Math.abs(p.y - l.goal[1]) < 1.2) {
      if (shards === 3) { complete(); return; }
      if (gameTime - lastPortalMessage > 3) { toast('locked'); lastPortalMessage = gameTime; }
    }
  }
  animateScene(dt);
}
function animateScene(dt) {
  const time = sceneTime;
  for (const item of collectibles) {
    if (item.collected) continue;
    item.mesh.rotation.y += dt * 1.6; item.mesh.position.y = item.pos[1] + Math.sin(time * 2.5 + item.phase) * .14;
    // Coins on moving platforms move with their island.
    if (item.kind === 'coin') {
      const config = LEVELS[levelIndex].islands.find(b => b.motion && Math.abs(item.pos[0] - b.x) < b.w / 2 && Math.abs(item.pos[2] - b.z) < b.d / 2);
      if (config) item.mesh.position[config.motion.axis] = item.pos[config.motion.axis === 'x' ? 0 : 2] + Math.sin(time * config.motion.speed) * config.motion.range;
    }
  }
  decorative.forEach(a => {
    if (a.kind === 'cloud') a.mesh.position.x = a.base + Math.sin(time * .08 + a.phase) * 3;
    if (a.kind === 'water') a.mesh.scale.y = 8 + Math.sin(time * 2) * .25;
  });
  for (let i = particles.length - 1; i >= 0; i--) {
    const a = particles[i]; a.life -= dt; a.vy -= dt * 7;
    a.mesh.position.x += a.vx * dt; a.mesh.position.y += a.vy * dt; a.mesh.position.z += a.vz * dt;
    a.mesh.material.opacity = Math.max(0, a.life);
    if (a.life <= 0) { world.remove(a.mesh); a.mesh.material.dispose(); particles.splice(i, 1); }
  }
  portal.userData.ring.rotation.z = Math.sin(time) * .08;
  portal.userData.ring.material = mat(shards === 3 ? '#f2e59b' : '#7eaba1', { emissive: shards === 3 ? '#d9c85e' : '#325d52', emissiveIntensity: shards === 3 ? .65 : .15 });
  portalLight.visible = shards === 3; portal.userData.disc.material.opacity = shards === 3 ? .4 + Math.sin(time * 3) * .1 : .14;
  checkpointMesh.rotation.z = time;
  playerMesh.position.set(p.x, p.y, p.z);
  const speed = Math.hypot(p.vx, p.vz);
  if (speed > .3) {
    const desired = Math.atan2(p.vx, p.vz), current = playerMesh.rotation.y;
    const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
    playerMesh.rotation.y += diff * (1 - Math.exp(-14 * dt));
  }
  const walk = p.grounded ? Math.sin(time * 16) * Math.min(1, speed / 6) : .25;
  playerMesh.userData.leftFoot.position.y = .14 + Math.max(0, walk) * .15;
  playerMesh.userData.rightFoot.position.y = .14 + Math.max(0, -walk) * .15;
  playerMesh.userData.leftArm.rotation.x = walk * .7; playerMesh.userData.rightArm.rotation.x = -walk * .7;
  playerMesh.userData.body.scale.y = p.grounded ? .49 + Math.abs(walk) * .025 : .53;
  playerMesh.visible = invincible <= 0 || Math.floor(time * 12) % 2 === 0;
  let surface = -Infinity;
  for (const b of platforms) if (inside(p, b, 0) && b.y <= p.y + .1) surface = Math.max(surface, b.y);
  playerShadow.visible = surface > -Infinity;
  if (playerShadow.visible) {
    playerShadow.position.set(p.x, surface + .025, p.z);
    playerShadow.scale.setScalar(1 + Math.min(3, p.y - surface) * .15);
    playerShadow.material.opacity = .25 / (1 + Math.max(0, p.y - surface) * .25);
  }
  const camTarget = new THREE.Vector3();
  if (mode === 'menu') {
    camTarget.set(17 + Math.sin(time * .1) * 2, 18, 23);
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 2)); camera.lookAt(1, 1, -8);
    playerMesh.userData.leftArm.rotation.z = Math.sin(time * 2) * .2;
  } else {
    const distance = innerWidth < 650 && innerHeight > innerWidth ? 18 : 15;
    camTarget.set(p.x + Math.sin(cameraYaw) * distance, p.y + 10.7, p.z + Math.cos(cameraYaw) * distance);
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 5));
    // Keep camera out of high islands: shortest safe upward correction.
    for (const b of platforms) if (inside(camera.position, b, .5) && camera.position.y < b.y + 2) camera.position.y = b.y + 2;
    camera.lookAt(p.x, p.y + .8, p.z);
  }
  sun.position.set(p.x - 20, p.y + 35, p.z + 15); sun.target.position.set(p.x, p.y, p.z); sun.target.updateMatrixWorld();
}
// Fixed simulation steps keep collisions and jump height stable at 30/60/120 Hz.
let last = performance.now(), accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min((now - last) / 1000, .1); last = now;
  if (mode === 'playing' || mode === 'menu') {
    accumulator += delta;
    while (accumulator >= 1 / 120) { update(1 / 120); accumulator -= 1 / 120; if (mode === 'modal') { accumulator = 0; break; } }
  } else accumulator = 0;
  music(); if (toastUntil && now > toastUntil) { $('#toast').classList.remove('visible'); toastUntil = 0; }
  renderer.render(scene, camera);
}
const gameKeys = new Set(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE']);
addEventListener('keydown', e => {
  if (mode === 'playing' && gameKeys.has(e.code)) { e.preventDefault(); keys.add(e.code); }
  if (e.code === 'Space' && !e.repeat && mode === 'playing') jumpQueued = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    if (mode === 'playing') pause(); else if (mode === 'modal' && modalMode === 'pause') resume();
  }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { clearInput(); if (mode === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (mode === 'playing') pause(); } last = performance.now(); });
canvas.addEventListener('pointerdown', e => { if (mode === 'playing') { drag = { id: e.pointerId, x: e.clientX }; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointermove', e => { if (drag?.id === e.pointerId) { targetYaw -= (e.clientX - drag.x) * .007; drag.x = e.clientX; } });
canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
const joystick = $('#joystick'), stick = $('#stick'); let stickPointer = null;
function resetStick() { stickPointer = null; stick.style.transform = ''; }
function moveStick(e) {
  if (e.pointerId !== stickPointer) return;
  const b = joystick.getBoundingClientRect(), r = b.width / 2 - 23;
  let x = (e.clientX - b.left - b.width / 2) / r, z = (e.clientY - b.top - b.height / 2) / r;
  const m = Math.hypot(x, z); if (m > 1) { x /= m; z /= m; }
  touchInput.x = Math.abs(x) < .12 ? 0 : x; touchInput.z = Math.abs(z) < .12 ? 0 : z;
  stick.style.transform = `translate(${x * r}px,${z * r}px)`;
}
joystick.addEventListener('pointerdown', e => { stickPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); moveStick(e); initAudio(); });
joystick.addEventListener('pointermove', moveStick);
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(event, e => { if (e.pointerId === stickPointer) { touchInput.x = touchInput.z = 0; resetStick(); } });
$('#touch-jump').addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'playing') jumpQueued = true; initAudio(); });
for (const side of ['left','right']) {
  const el = $(`#cam-${side}`);
  el.addEventListener('pointerdown', e => { e.preventDefault(); camInput[side] = true; el.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup','pointercancel','lostpointercapture']) el.addEventListener(ev, () => { camInput[side] = false; });
}
$('#play').onclick = () => start(); $('#how').onclick = help; $('#pause').onclick = pause;
$('#camera').onclick = () => { targetYaw = .52; };
$('#language').onchange = e => { lang = e.target.value; persist(); translate(); };
$('#sound').onclick = () => { save.sound = !save.sound; persist(); if (save.sound) initAudio(); if (master) master.gain.value = save.sound ? .18 : 0; translate(); toast(save.sound ? 'soundOn' : 'soundOff'); };
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize(); loadLevel(selected); translate(); show('#loading', false); show('#menu', true); requestAnimationFrame(frame);
// Read-only diagnostics for manual QA. No hidden gameplay shortcuts.
Object.defineProperty(window, 'd3oiram', { value: Object.freeze({
  snapshot: () => ({ mode, level: levelIndex + 1, player: { x: p.x, y: p.y, z: p.z, grounded: p.grounded }, coins, shards, health, checkpoint, gameTime, storageAvailable, drawCalls: renderer.info.render.calls })
}) });
