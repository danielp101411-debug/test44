/*
 * Dusk Arena — pure game logic.
 * No three.js and no DOM in here, so these functions can be unit-tested in Node.
 * In the browser they are available as window.DuskLogic.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DuskLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Small seeded random number generator: same seed, same sequence. */
  function mulberry32(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Push a circle (player or enemy, seen from above) out of any box it overlaps.
   * Boxes whose top is below the feet are ignored, so you can stand on crates.
   * Mutates p ({x, z}).
   */
  function collideCircle(p, r, feet, boxes) {
    for (const b of boxes) {
      if (feet >= b.h - 0.05) continue;
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // centre is inside the box: leave by the nearest side
        const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bb = b.maxZ - p.z;
        const m = Math.min(l, rr, t, bb);
        if (m === l) p.x = b.minX - r;
        else if (m === rr) p.x = b.maxX + r;
        else if (m === t) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
      }
    }
    return p;
  }

  /** Height of the floor under a circle: 0, or the top of a box you are standing over. */
  function groundAt(p, r, feet, boxes) {
    let g = 0;
    for (const b of boxes) {
      if (feet < b.h - 0.35) continue;
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
      if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < (r * 0.7) ** 2) g = Math.max(g, b.h);
    }
    return g;
  }

  /** True when a 3D point is below the floor or inside a box. */
  function pointInSolid(v, boxes) {
    return v.y < 0 || boxes.some(b => v.x > b.minX && v.x < b.maxX && v.z > b.minZ && v.z < b.maxZ && v.y < b.h);
  }

  /** The list of enemy types for a wave (before shuffling). */
  function waveComposition(wave) {
    const n = 4 + wave * 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      let t = 'seeker';
      if (wave >= 2 && i % 3 === 2) t = 'spitter';
      if (wave >= 3 && i % 7 === 6) t = 'brute';
      out.push(t);
    }
    return out;
  }

  /** Enemies get 7% tougher each wave. */
  function enemyHp(base, wave) {
    return base * (1 + (wave - 1) * 0.07);
  }

  /**
   * Build the arena: 4 outer walls, then pillars, crates and low walls placed with a seeded
   * random generator so every player gets the same map. Returns [{x, z, w, d, h, kind}].
   */
  function generateLayout(seed, half) {
    const rnd = mulberry32(seed);
    const out = [
      { x: 0, z: -half - 1, w: half * 2 + 4, d: 2, h: 6, kind: 'wall' },
      { x: 0, z: half + 1, w: half * 2 + 4, d: 2, h: 6, kind: 'wall' },
      { x: -half - 1, z: 0, w: 2, d: half * 2, h: 6, kind: 'wall' },
      { x: half + 1, z: 0, w: 2, d: half * 2, h: 6, kind: 'wall' }
    ];
    const placed = [];
    function freeSpot(w, d, margin) {
      for (let tries = 0; tries < 60; tries++) {
        const x = (rnd() * 2 - 1) * (half - 5), z = (rnd() * 2 - 1) * (half - 5);
        if (Math.hypot(x, z) < 8) continue; // keep the spawn area clear
        const fits = placed.every(p => Math.abs(p.x - x) > (p.w + w) / 2 + margin || Math.abs(p.z - z) > (p.d + d) / 2 + margin);
        if (fits) { placed.push({ x, z, w, d }); return { x, z }; }
      }
      return null;
    }
    for (let i = 0; i < 14; i++) {
      const w = 2 + rnd() * 1.6, d = 2 + rnd() * 1.6, s = freeSpot(w, d, 3);
      if (s) out.push({ x: s.x, z: s.z, w, d, h: 4 + rnd() * 5, kind: 'pillar' });
    }
    for (let i = 0; i < 18; i++) {
      const s = freeSpot(1.6, 1.6, 2.2);
      if (s) out.push({ x: s.x, z: s.z, w: 1.6, d: 1.6, h: 1.0, kind: 'crate' });
    }
    for (let i = 0; i < 6; i++) {
      const horiz = rnd() < 0.5, w = horiz ? 6 : 1, d = horiz ? 1 : 6, s = freeSpot(w, d, 3);
      if (s) out.push({ x: s.x, z: s.z, w, d, h: 1.6, kind: 'low' });
    }
    return out;
  }

  /** Convert a layout box ({x, z, w, d, h}) to the bounds format the collision functions use. */
  function toBounds(b) {
    return { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: b.h };
  }

  return { clamp, mulberry32, collideCircle, groundAt, pointInSolid, waveComposition, enemyHp, generateLayout, toBounds };
});
