const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/logic.js');

const crate = L.toBounds({ x: 0, z: 0, w: 2, d: 2, h: 1 });

test('clamp keeps numbers inside a range', () => {
  assert.equal(L.clamp(5, 0, 10), 5);
  assert.equal(L.clamp(-3, 0, 10), 0);
  assert.equal(L.clamp(42, 0, 10), 10);
});

test('seeded random is repeatable and between 0 and 1', () => {
  const a = L.mulberry32(7), b = L.mulberry32(7);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(L.mulberry32(1)(), L.mulberry32(2)());
});

test('a circle touching a box is pushed out to exactly its radius', () => {
  const p = L.collideCircle({ x: 1.3, z: 0 }, 0.5, 0, [crate]);
  assert.ok(Math.abs(p.x - 1.5) < 1e-9, `expected x=1.5, got ${p.x}`);
  assert.equal(p.z, 0);
});

test('a circle far from a box is not moved', () => {
  const p = L.collideCircle({ x: 5, z: 5 }, 0.5, 0, [crate]);
  assert.deepEqual(p, { x: 5, z: 5 });
});

test('a circle whose centre is inside a box leaves by the nearest side', () => {
  const p = L.collideCircle({ x: 0.9, z: 0.1 }, 0.5, 0, [crate]);
  assert.equal(p.x, 1.5);
});

test('standing on top of a box means no sideways collision', () => {
  const p = L.collideCircle({ x: 0.5, z: 0 }, 0.5, 1.0, [crate]);
  assert.deepEqual(p, { x: 0.5, z: 0 });
});

test('ground height is the crate top when above it, 0 beside it', () => {
  assert.equal(L.groundAt({ x: 0, z: 0 }, 0.5, 1.0, [crate]), 1);
  assert.equal(L.groundAt({ x: 3, z: 0 }, 0.5, 1.0, [crate]), 0);
  assert.equal(L.groundAt({ x: 0, z: 0 }, 0.5, 0, [crate]), 0, 'too low to step up');
});

test('pointInSolid detects boxes and the floor', () => {
  assert.equal(L.pointInSolid({ x: 0, y: 0.5, z: 0 }, [crate]), true);
  assert.equal(L.pointInSolid({ x: 0, y: 1.5, z: 0 }, [crate]), false);
  assert.equal(L.pointInSolid({ x: 5, y: -0.1, z: 5 }, [crate]), true);
});

test('wave size grows by 2 each wave', () => {
  for (let w = 1; w <= 10; w++) assert.equal(L.waveComposition(w).length, 4 + w * 2);
});

test('wave 1 is only seekers, spitters arrive at wave 2, brutes at wave 3', () => {
  assert.ok(L.waveComposition(1).every(t => t === 'seeker'));
  assert.ok(L.waveComposition(2).includes('spitter'));
  assert.ok(!L.waveComposition(2).includes('brute'));
  assert.ok(L.waveComposition(3).includes('brute'));
});

test('enemies get tougher each wave', () => {
  assert.equal(L.enemyHp(100, 1), 100);
  assert.ok(L.enemyHp(100, 5) > L.enemyHp(100, 4));
});

test('the arena layout is the same every time for a seed', () => {
  assert.deepEqual(L.generateLayout(7, 40), L.generateLayout(7, 40));
});

test('the arena has 4 walls, keeps the centre clear and stays in bounds', () => {
  const layout = L.generateLayout(7, 40);
  assert.equal(layout.filter(b => b.kind === 'wall').length, 4);
  const inner = layout.filter(b => b.kind !== 'wall');
  assert.ok(inner.length > 20, 'expected a reasonably full arena');
  for (const b of inner) {
    assert.ok(Math.hypot(b.x, b.z) >= 8, 'spawn area must be clear');
    assert.ok(Math.abs(b.x) + b.w / 2 < 40 && Math.abs(b.z) + b.d / 2 < 40, 'inside the walls');
  }
});

test('obstacles in the arena never overlap', () => {
  const inner = L.generateLayout(7, 40).filter(b => b.kind !== 'wall');
  for (let i = 0; i < inner.length; i++) {
    for (let j = i + 1; j < inner.length; j++) {
      const a = inner[i], b = inner[j];
      const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
      assert.ok(!overlap, `boxes ${i} and ${j} overlap`);
    }
  }
});
