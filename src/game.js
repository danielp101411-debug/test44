(() => {
const $ = id => document.getElementById(id);
const stage = $('stage');
const { clamp, collideCircle: collideIn, groundAt: groundIn, pointInSolid, waveComposition, enemyHp, generateLayout } = window.DuskLogic;
const isTouch = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

/* ---------- renderer & scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const canvas = renderer.domElement;

const SKY = 0x2b2a4a;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 16, 72);

const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 220);
const yawObj = new THREE.Object3D();
yawObj.add(camera);
camera.position.y = 1.65;
scene.add(yawObj);

scene.add(new THREE.HemisphereLight(0xffc890, 0x3a3060, 0.75));
const sun = new THREE.DirectionalLight(0xffb070, 1.0);
sun.position.set(-40, 22, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 140;
sun.shadow.bias = -0.0006;
scene.add(sun);

function radialTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
const glowTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

// the setting sun on the horizon
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ color: 0xff9a5a, fog: false }));
sunDisc.position.set(-150, 14, -112);
sunDisc.lookAt(0, 6, 0);
scene.add(sunDisc);
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a50, transparent: true, opacity: .55, fog: false, depthWrite: false }));
sunGlow.scale.set(90, 90, 1);
sunGlow.position.copy(sunDisc.position).multiplyScalar(1.01);
scene.add(sunGlow);

/* ---------- arena ---------- */
function floorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8f6d4a'; g.fillRect(0,0,256,256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < .5 ? 'rgba(60,40,25,.12)' : 'rgba(255,230,190,.08)';
    g.fillRect(Math.random()*256, Math.random()*256, 2+Math.random()*3, 2+Math.random()*3);
  }
  g.strokeStyle = 'rgba(50,34,22,.35)'; g.lineWidth = 3;
  g.strokeRect(1.5,1.5,253,253);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 24);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const HALF = 40;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF*2+10, HALF*2+10), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 1 }));
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);

const boxes = [], solids = [];
const matCache = {};
const boxMat = c => matCache[c] || (matCache[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .92 }));
const KIND_COLORS = { wall: 0xc9a26b, pillar: 0xb98f5c, crate: 0x7a5a3c, low: 0xa88257 };
function addBox(b) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), boxMat(KIND_COLORS[b.kind]));
  m.position.set(b.x, b.h/2, b.z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m); solids.push(m);
  boxes.push({ minX: b.x-b.w/2, maxX: b.x+b.w/2, minZ: b.z-b.d/2, maxZ: b.z+b.d/2, h: b.h });
}
generateLayout(7, HALF).forEach(addBox);
const collideCircle = (p, r, feet) => collideIn(p, r, feet, boxes);
const groundAt = (p, r, feet) => groundIn(p, r, feet, boxes);
const insideSolid = v => pointInSolid(v, boxes);

/* ---------- gun viewmodel ---------- */
const gun = new THREE.Group();
camera.add(gun);
const GUN_BASE = new THREE.Vector3(0.26, -0.24, -0.46);
gun.position.copy(GUN_BASE);
const gunMat = new THREE.MeshStandardMaterial({ color: 0x2c2838, roughness: .45, metalness: .5 });
const accMat = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0x6a4a08, roughness: .4 });
const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); gun.add(m); return m; };
part(new THREE.BoxGeometry(.09, .12, .42), gunMat, 0, 0, -.05);
const barrel = part(new THREE.CylinderGeometry(.024, .024, .26, 10), gunMat, 0, .015, -.36); barrel.rotation.x = Math.PI/2;
part(new THREE.BoxGeometry(.095, .022, .3), accMat, 0, .07, -.06);
const grip = part(new THREE.BoxGeometry(.07, .17, .08), gunMat, 0, -.12, .07); grip.rotation.x = .25;
part(new THREE.BoxGeometry(.06, .13, .07), accMat, 0, -.1, -.13);
const muzzle = new THREE.Object3D(); muzzle.position.set(0, .015, -.5); gun.add(muzzle);
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd36b, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
flash.scale.set(.32, .32, 1); muzzle.add(flash); flash.visible = false;
const flashLight = new THREE.PointLight(0xffb050, 0, 9); muzzle.add(flashLight);

/* ---------- effects ---------- */
const tracers = [];
for (let i = 0; i < 10; i++) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0 }));
  line.frustumCulled = false; scene.add(line); tracers.push({ line, life: 0 });
}
let tracerIdx = 0;
function tracer(a, b) {
  const t = tracers[tracerIdx++ % tracers.length], arr = t.line.geometry.attributes.position.array;
  arr[0]=a.x; arr[1]=a.y; arr[2]=a.z; arr[3]=b.x; arr[4]=b.y; arr[5]=b.z;
  t.line.geometry.attributes.position.needsUpdate = true; t.life = .07;
}
const sparkGeo = new THREE.BoxGeometry(.06, .06, .06);
const sparks = [];
for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })); m.visible = false; scene.add(m); sparks.push({ m, v: new THREE.Vector3(), life: 0 }); }
let sparkIdx = 0;
function burst(pos, color, n, power) {
  for (let i = 0; i < n; i++) {
    const s = sparks[sparkIdx++ % sparks.length];
    s.m.position.copy(pos); s.m.material.color.setHex(color); s.m.visible = true;
    s.v.set(Math.random()-.5, Math.random()*.8+.2, Math.random()-.5).normalize().multiplyScalar(power*(.5+Math.random()));
    s.life = .35 + Math.random()*.3;
  }
}

/* ---------- audio ---------- */
let actx = null, master = null, noiseBuf = null;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = .35; master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate*.3, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2-1;
  } catch (e) { actx = null; }
}
function tone(freq, dur, type, vol, slide) {
  if (!actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t+dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.02);
}
function noise(dur, vol, freq) {
  if (!actx) return;
  const t = actx.currentTime, s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t+dur);
}
const sfx = {
  shoot(){ noise(.11, .55, 2200); tone(150, .08, 'sine', .45, 50); },
  hit(){ tone(1150, .045, 'square', .1); },
  kill(){ tone(420, .16, 'triangle', .25, 1300); },
  hurt(){ tone(130, .22, 'sawtooth', .28, 55); },
  reload(){ tone(320, .05, 'square', .09); setTimeout(() => tone(460, .06, 'square', .09), 260); },
  pickup(){ tone(620, .16, 'sine', .25, 1100); },
  spit(){ tone(240, .14, 'triangle', .1, 520); },
  wave(){ tone(330, .25, 'triangle', .2, 660); }
};

/* ---------- game state ---------- */
const MAG = 24, RELOAD = 1.25, EYE = 1.65;
const player = { pos: yawObj.position, vel: new THREE.Vector3(), vy: 0, onGround: true, hp: 100, r: .45 };
let yaw = 0, pitch = 0, recoil = 0, kick = 0, shake = 0, hurtFlash = 0, bobT = 0;
let state = 'menu', score = 0, kills = 0, wave = 0, waveLive = false, intermission = 0;
let ammo = MAG, reloading = 0, fireCd = 0, firing = false, jumpQueued = false;
let spawnQueue = [], spawnTimer = 0;
let dragMode = false, dragging = false, lockEverWorked = false;
const keys = {};
const touchMove = { x: 0, y: 0 };
const enemies = [], orbs = [], pickups = [];
let best = 0;
try { best = +localStorage.getItem('duskArenaBest') || 0; } catch (e) {}

/* ---------- enemies ---------- */
const TYPES = {
  seeker:  { hp: 40,  speed: 4.6, r: .55, color: 0x3fe0c5, score: 100, contact: 12, y: 1.1, geo: new THREE.OctahedronGeometry(.55) },
  spitter: { hp: 60,  speed: 2.9, r: .6,  color: 0xff6b8b, score: 150, contact: 8,  y: 1.6, geo: new THREE.IcosahedronGeometry(.6, 0), ranged: true },
  brute:   { hp: 240, speed: 2.3, r: .95, color: 0x8f7dff, score: 400, contact: 25, y: 1.05, geo: new THREE.BoxGeometry(1.5, 2.1, 1.5) }
};
const eyeGeo = new THREE.SphereGeometry(.14, 12, 8);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });
const orbGeo = new THREE.SphereGeometry(.2, 12, 8);
const orbMat = new THREE.MeshBasicMaterial({ color: 0xff6b8b });

function spawnEnemy(type) {
  const T = TYPES[type];
  let x = 0, z = 0;
  for (let i = 0; i < 14; i++) {
    const a = Math.random()*Math.PI*2, rad = 30 + Math.random()*6;
    x = clamp(Math.cos(a)*rad, -HALF+2, HALF-2); z = clamp(Math.sin(a)*rad, -HALF+2, HALF-2);
    if (Math.hypot(x-player.pos.x, z-player.pos.z) > 18) break;
  }
  const p = { x, z }; collideCircle(p, T.r, 0);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: T.color, emissive: T.color, emissiveIntensity: .35, roughness: .4, metalness: .2 });
  const body = new THREE.Mesh(T.geo, mat); body.castShadow = true; g.add(body);
  const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.set(0, type === 'brute' ? .55 : .08, T.r*.92); g.add(eye);
  g.position.set(p.x, T.y, p.z); g.scale.setScalar(.01);
  scene.add(g);
  const e = { type, T, g, body, eye, mat, hp: enemyHp(T.hp, wave), x: p.x, z: p.z, vx: 0, vz: 0, cd: 0, fireCd: 1.5 + Math.random()*2, flash: 0, bob: Math.random()*6, spawn: 0 };
  body.userData.enemy = e; eye.userData.enemy = e; eye.userData.weak = true;
  enemies.push(e);
}
function removeEnemy(e) {
  scene.remove(e.g); e.mat.dispose();
  enemies.splice(enemies.indexOf(e), 1);
}
function damageEnemy(e, d) {
  e.hp -= d; e.flash = 1;
  if (e.hp <= 0) {
    score += e.T.score; kills++;
    burst(e.g.position, e.T.color, 16, 7);
    sfx.kill(); hitmark(true);
    if (Math.random() < (e.type === 'brute' ? .6 : .14)) spawnPickup(e.x, e.z);
    removeEnemy(e);
  } else { sfx.hit(); hitmark(false); }
}

const pickGeo1 = new THREE.BoxGeometry(.5, .16, .16), pickGeo2 = new THREE.BoxGeometry(.16, .5, .16);
const pickMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffe2a0, emissiveIntensity: .7 });
function spawnPickup(x, z) {
  const g = new THREE.Group(); g.add(new THREE.Mesh(pickGeo1, pickMat), new THREE.Mesh(pickGeo2, pickMat));
  g.position.set(x, .7, z); scene.add(g); pickups.push({ g, life: 20 });
}

/* ---------- HUD ---------- */
const hud = $('hud'), hpFill = $('hpFill'), hpBar = $('hpBar'), hpTxt = $('hpTxt'), ammoTxt = $('ammoTxt'), reloadTxt = $('reloadTxt');
const scoreTxt = $('scoreTxt'), waveTxt = $('waveTxt'), banner = $('banner'), vignette = $('vignette'), hm = $('hitmark');
let hmTimer, bannerTimer;
function hitmark(kill) {
  hm.classList.toggle('kill', kill); hm.classList.add('on');
  clearTimeout(hmTimer); hmTimer = setTimeout(() => hm.classList.remove('on'), kill ? 220 : 90);
}
function announce(text, ms = 1800) {
  banner.textContent = text; banner.classList.add('on');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => banner.classList.remove('on'), ms);
}
const last = {};
function setText(el, key, v) { if (last[key] !== v) { last[key] = v; el.textContent = v; } }
function updateHud() {
  const hp = Math.max(0, Math.ceil(player.hp));
  setText(hpTxt, 'hp', String(hp));
  hpFill.style.transform = `scaleX(${hp/100})`;
  hpBar.classList.toggle('low', hp <= 30);
  setText(ammoTxt, 'ammo', String(ammo));
  setText(reloadTxt, 'rl', reloading > 0 ? 'Reloading' : (ammo <= 5 ? 'Press R to reload' : ''));
  if (isTouch && reloading <= 0 && ammo <= 5) setText(reloadTxt, 'rl', 'Low ammo');
  setText(scoreTxt, 'score', score.toLocaleString());
  setText(waveTxt, 'wave', `Wave ${wave} · ${enemies.length + spawnQueue.length} left`);
  const low = hp <= 30 ? .35 + Math.sin(performance.now()/180)*.1 : 0;
  vignette.style.opacity = Math.max(low, hurtFlash).toFixed(3);
}

/* ---------- waves ---------- */
function nextWave() {
  wave++; waveLive = true;
  spawnQueue = waveComposition(wave);
  spawnQueue.sort(() => Math.random() - .5);
  spawnTimer = .8;
  announce(`Wave ${wave}`); sfx.wave();
}

/* ---------- player actions ---------- */
const raycaster = new THREE.Raycaster(), losRay = new THREE.Raycaster();
const ndc = new THREE.Vector2(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function look(dx, dy) { yaw -= dx*.0022; pitch = clamp(pitch - dy*.0022, -1.5, 1.5); }
function startReload() { if (reloading > 0 || ammo === MAG) return; reloading = RELOAD; sfx.reload(); }
function tryFire() {
  if (reloading > 0 || fireCd > 0) return;
  if (ammo <= 0) { startReload(); return; }
  ammo--; fireCd = .105; kick = 1; recoil += .014; flashT = .05;
  sfx.shoot();
  yawObj.updateMatrixWorld(true);
  const moving = Math.hypot(player.vel.x, player.vel.z) > 1 || !player.onGround;
  const spread = .006 + (moving ? .018 : 0);
  ndc.set((Math.random()-.5)*spread*2, (Math.random()-.5)*spread*2);
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = 120;
  const targets = solids.concat(floor);
  for (const e of enemies) targets.push(e.body, e.eye);
  const hits = raycaster.intersectObjects(targets, false);
  let end;
  if (hits.length) {
    const h = hits[0]; end = h.point;
    const e = h.object.userData.enemy;
    if (e) { burst(end, e.T.color, 5, 4); damageEnemy(e, h.object.userData.weak ? 44 : 22); }
    else burst(end, 0xffd36b, 4, 3);
  } else end = raycaster.ray.at(120, tmpB);
  muzzle.getWorldPosition(tmpA);
  tracer(tmpA, end);
  if (ammo === 0) startReload();
}
function hurt(d) {
  if (state !== 'playing') return;
  player.hp -= d; hurtFlash = .7; shake = .25; sfx.hurt();
  if (player.hp <= 0) gameOver();
}

/* ---------- overlay & flow ---------- */
const overlay = $('overlay'), ovTitle = $('ovTitle'), ovText = $('ovText'), ovStats = $('ovStats'), ovBtn = $('ovBtn');
function showOverlay(title, text, btn, stats) {
  ovTitle.textContent = title; ovText.textContent = text; ovBtn.textContent = btn;
  if (stats) { ovStats.innerHTML = stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join(''); ovStats.hidden = false; }
  else ovStats.hidden = true;
  overlay.hidden = false; hud.classList.remove('on'); $('touch').classList.remove('on');
  setTimeout(() => ovBtn.focus({ preventScroll: true }), 0);
}
function hideOverlay() { overlay.hidden = true; hud.classList.add('on'); $('touch').classList.add('on'); }
function requestLock() {
  if (isTouch || dragMode) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); }
  catch (e) { dragMode = true; }
}
function resetGame() {
  while (enemies.length) removeEnemy(enemies[0]);
  orbs.forEach(o => scene.remove(o.m)); orbs.length = 0;
  pickups.forEach(p => scene.remove(p.g)); pickups.length = 0;
  player.pos.set(0, 0, 0); player.vel.set(0, 0, 0); player.vy = 0; player.hp = 100;
  yaw = 0; pitch = 0; recoil = 0;
  score = 0; kills = 0; wave = 0; waveLive = false; intermission = 1.2;
  ammo = MAG; reloading = 0; spawnQueue = [];
}
function play() { initAudio(); state = 'playing'; hideOverlay(); requestLock(); }
function pause() {
  if (state !== 'playing') return;
  state = 'paused'; firing = false;
  showOverlay('Paused', 'The drones are waiting for you.', 'Resume', [[score.toLocaleString(), 'Score'], [wave, 'Wave']]);
}
function gameOver() {
  state = 'over'; firing = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const newBest = score > best;
  if (newBest) { best = score; try { localStorage.setItem('duskArenaBest', String(best)); } catch (e) {} }
  showOverlay('Overrun', newBest ? 'New best. You held the yard longer than ever.' : `You made it to wave ${wave}.`, 'Play again',
    [[score.toLocaleString(), 'Score'], [kills, 'Kills'], [best.toLocaleString(), 'Best']]);
}
ovBtn.addEventListener('click', () => {
  if (state === 'paused') play();
  else { resetGame(); play(); }
});

/* ---------- input ---------- */
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) lockEverWorked = true;
  else if (state === 'playing' && !dragMode) pause();
});
document.addEventListener('pointerlockerror', () => {
  if (lockEverWorked) { if (state === 'playing') pause(); }
  else dragMode = true;
});
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (state !== 'playing') return;
  if (e.code === 'Space') jumpQueued = true;
  if (e.code === 'KeyR') startReload();
  if ((e.code === 'Escape' || e.code === 'KeyP') && (dragMode || e.code === 'KeyP')) pause();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; if (dragMode || isTouch) pause(); });
canvas.addEventListener('mousedown', e => {
  if (state !== 'playing') return;
  if (!dragMode && document.pointerLockElement !== canvas) { requestLock(); return; }
  if (e.button === 0) firing = true;
  dragging = true;
});
window.addEventListener('mouseup', e => { if (e.button === 0) firing = false; dragging = false; });
window.addEventListener('mousemove', e => {
  if (state !== 'playing') return;
  if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
  else if (dragMode && dragging) look(e.movementX*1.3, e.movementY*1.3);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// touch controls
let stickId = null, lookId = null, stickO = { x: 0, y: 0 }, lookLast = { x: 0, y: 0 };
const knob = $('knob');
stage.addEventListener('touchstart', e => {
  if (state !== 'playing') return;
  for (const t of e.changedTouches) {
    if (t.target.closest('.tbtn')) continue;
    if (t.clientX < innerWidth/2 && stickId === null) { stickId = t.identifier; stickO = { x: t.clientX, y: t.clientY }; }
    else if (lookId === null) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; }
  }
}, { passive: true });
stage.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) {
      const dx = clamp(t.clientX - stickO.x, -50, 50), dy = clamp(t.clientY - stickO.y, -50, 50);
      touchMove.x = dx/50; touchMove.y = -dy/50;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (t.identifier === lookId) {
      look((t.clientX - lookLast.x)*2, (t.clientY - lookLast.y)*2);
      lookLast = { x: t.clientX, y: t.clientY };
    }
  }
  e.preventDefault();
}, { passive: false });
const endTouch = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) { stickId = null; touchMove.x = touchMove.y = 0; knob.style.transform = ''; }
    if (t.identifier === lookId) lookId = null;
  }
};
stage.addEventListener('touchend', endTouch); stage.addEventListener('touchcancel', endTouch);
const fireBtn = $('fireBtn'), jumpBtn = $('jumpBtn');
fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); firing = true; });
['pointerup','pointercancel','pointerleave'].forEach(ev => fireBtn.addEventListener(ev, () => { firing = false; }));
jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); jumpQueued = true; });

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

/* ---------- update ---------- */
let flashT = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
function update(dt, t) {
  // --- player movement
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touchMove.x;
  let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + touchMove.y;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  if (keys.ArrowLeft) yaw += 2.4*dt;
  if (keys.ArrowRight) yaw -= 2.4*dt;
  const speed = (keys.ShiftLeft || keys.ShiftRight) ? 10 : 7;
  const tx = (fwd.x*mz + right.x*mx)*speed, tz = (fwd.z*mz + right.z*mx)*speed;
  const acc = Math.min(1, dt*(player.onGround ? 12 : 4));
  player.vel.x += (tx - player.vel.x)*acc; player.vel.z += (tz - player.vel.z)*acc;
  player.pos.x += player.vel.x*dt; player.pos.z += player.vel.z*dt;
  collideCircle(player.pos, player.r, player.pos.y);
  if (jumpQueued && player.onGround) { player.vy = 7.4; player.onGround = false; }
  jumpQueued = false;
  player.vy -= 22*dt;
  player.pos.y += player.vy*dt;
  const gh = groundAt(player.pos, player.r, player.pos.y);
  if (player.pos.y <= gh) { player.pos.y = gh; player.vy = 0; player.onGround = true; }
  else player.onGround = player.pos.y - gh < .02;

  // --- camera & gun
  recoil *= Math.pow(.0005, dt);
  shake = Math.max(0, shake - dt);
  yawObj.rotation.y = yaw;
  camera.rotation.x = pitch + recoil;
  camera.position.x = (Math.random()-.5)*shake*.15;
  camera.position.y = EYE + (Math.random()-.5)*shake*.15;
  const moveAmt = player.onGround ? Math.min(1, Math.hypot(player.vel.x, player.vel.z)/7) : 0;
  bobT += dt*(6 + moveAmt*6);
  kick *= Math.pow(.0001, dt);
  gun.position.set(GUN_BASE.x + Math.cos(bobT)*.01*moveAmt, GUN_BASE.y + Math.abs(Math.sin(bobT))*.014*moveAmt, GUN_BASE.z + kick*.07);
  gun.rotation.x = reloading > 0 ? -.7*Math.sin(Math.PI*(1 - reloading/RELOAD)) : kick*.12;
  flashT -= dt;
  flash.visible = flashT > 0; flash.material.rotation = Math.random()*6;
  flashLight.intensity = flashT > 0 ? 3 : 0;

  // --- weapon
  fireCd -= dt;
  if (reloading > 0) { reloading -= dt; if (reloading <= 0) { reloading = 0; ammo = MAG; } }
  if (firing) tryFire();

  // --- waves
  if (waveLive) {
    if (spawnQueue.length && enemies.length < 14) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) { spawnEnemy(spawnQueue.pop()); spawnTimer = Math.max(.25, .65 - wave*.03); }
    }
    if (!spawnQueue.length && !enemies.length) { waveLive = false; intermission = 3.5; if (wave > 0) announce('Wave cleared', 2200); player.hp = Math.min(100, player.hp + 15); }
  } else {
    intermission -= dt;
    if (intermission <= 0) nextWave();
  }

  // --- enemies
  const px = player.pos.x, pz = player.pos.z;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i], T = e.T;
    e.spawn = Math.min(1, e.spawn + dt*2.5);
    const dx = px - e.x, dz = pz - e.z, dist = Math.hypot(dx, dz) || .001;
    let want = 1;
    if (T.ranged) want = dist < 9 ? -.6 : dist < 14 ? .1 : 1;
    let sx = 0, sz = 0;
    for (const o of enemies) {
      if (o === e) continue;
      const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz), min = T.r + o.T.r + .3;
      if (od < min && od > 0) { sx += ox/od*(min-od); sz += oz/od*(min-od); }
    }
    const sp = T.speed*(1 + wave*.03)*e.spawn;
    const dvx = dx/dist*sp*want + sx*3, dvz = dz/dist*sp*want + sz*3;
    const k = Math.min(1, dt*4);
    e.vx += (dvx - e.vx)*k; e.vz += (dvz - e.vz)*k;
    const p = { x: e.x + e.vx*dt, z: e.z + e.vz*dt };
    collideCircle(p, T.r, 0);
    e.x = clamp(p.x, -HALF+T.r, HALF-T.r); e.z = clamp(p.z, -HALF+T.r, HALF-T.r);
    const bob = e.type === 'brute' ? Math.abs(Math.sin(t*5 + e.bob))*.08 : Math.sin(t*3 + e.bob)*.18;
    e.g.position.set(e.x, T.y + bob, e.z);
    e.g.rotation.y = Math.atan2(dx, dz);
    if (e.type === 'seeker') e.body.rotation.z += dt*4;
    if (e.type === 'spitter') e.body.rotation.x += dt*1.5;
    e.g.scale.setScalar(.01 + e.spawn*.99);
    e.flash = Math.max(0, e.flash - dt*6);
    e.mat.emissiveIntensity = .35 + e.flash*2.2 + (T.ranged && e.fireCd < .45 ? 1.2 : 0);
    e.cd -= dt;
    if (dist < T.r + player.r + .2 && player.pos.y < T.y + 1 && e.cd <= 0 && e.spawn >= 1) {
      e.cd = .9; hurt(T.contact);
      player.vel.x -= dx/dist*-6; player.vel.z -= dz/dist*-6;
    }
    if (T.ranged && e.spawn >= 1) {
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        e.fireCd = 2.1 + Math.random()*.8 - Math.min(.8, wave*.05);
        if (dist < 28) {
          tmpA.set(e.x, T.y, e.z);
          tmpB.set(px, player.pos.y + 1.2, pz).sub(tmpA);
          const len = tmpB.length(); tmpB.normalize();
          losRay.set(tmpA, tmpB); losRay.far = len;
          if (!losRay.intersectObjects(solids, false).length) {
            const m = new THREE.Mesh(orbGeo, orbMat); m.position.copy(tmpA); scene.add(m);
            orbs.push({ m, v: tmpB.clone().multiplyScalar(13 + wave*.3), life: 4 });
            sfx.spit();
          }
        }
      }
    }
  }

  // --- orbs
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.m.position.addScaledVector(o.v, dt); o.life -= dt;
    const op = o.m.position;
    const hitPlayer = Math.hypot(op.x - px, op.z - pz) < .55 && op.y > player.pos.y - .1 && op.y < player.pos.y + 1.9;
    if (hitPlayer) hurt(10);
    if (hitPlayer || o.life <= 0 || insideSolid(op)) {
      if (!hitPlayer) burst(op, 0xff6b8b, 5, 3);
      scene.remove(o.m); orbs.splice(i, 1);
    }
  }

  // --- pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.g.rotation.y += dt*2; p.g.position.y = .7 + Math.sin(t*3 + i)*.12; p.life -= dt;
    p.g.visible = p.life > 4 || Math.sin(t*20) > 0;
    const got = Math.hypot(p.g.position.x - px, p.g.position.z - pz) < 1.2 && player.pos.y < 1.5 && player.hp < 100;
    if (got) { player.hp = Math.min(100, player.hp + 25); sfx.pickup(); burst(p.g.position, 0xfff1d6, 8, 3); }
    if (got || p.life <= 0) { scene.remove(p.g); pickups.splice(i, 1); }
  }

  hurtFlash = Math.max(0, hurtFlash - dt*1.6);
  updateHud();
}

function updateFx(dt) {
  for (const tr of tracers) { tr.life -= dt; tr.line.material.opacity = Math.max(0, tr.life/.07)*.85; }
  for (const s of sparks) {
    if (s.life <= 0) continue;
    s.life -= dt; s.v.y -= 14*dt; s.m.position.addScaledVector(s.v, dt);
    if (s.life <= 0) s.m.visible = false;
  }
}

/* ---------- loop ---------- */
let prev = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - prev)/1000); prev = now;
  const t = now/1000;
  if (state === 'playing') update(dt, t);
  else if (state === 'menu') {
    yawObj.rotation.y = t*.08; camera.rotation.x = -.05;
    yawObj.position.set(Math.sin(t*.08)*4, 0, Math.cos(t*.08)*4);
  }
  updateFx(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (best > 0) ovText.textContent += ` Your best is ${best.toLocaleString()}.`;
ovBtn.focus({ preventScroll: true });
})();
