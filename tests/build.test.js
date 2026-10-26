const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('../scripts/build.js');

const distFile = path.join(__dirname, '..', 'dist', 'index.html');

test('dist/index.html exists', () => {
  assert.ok(fs.existsSync(distFile), 'run "npm run build" to create it');
});

test('dist/index.html is up to date with src/', () => {
  assert.equal(fs.readFileSync(distFile, 'utf8'), build(),
    'src/ changed but dist/ was not rebuilt — run "npm run build"');
});

test('every placeholder was filled in', () => {
  assert.ok(!build().includes('@inline'));
});

test('the only external script is three.js from cdnjs', () => {
  const srcs = [...build().matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(srcs, ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js']);
});

test('the game logic and game code are both included', () => {
  const html = build();
  assert.ok(html.includes('root.DuskLogic = api'));
  assert.ok(html.includes('} = window.DuskLogic;'));
  assert.ok(html.indexOf('root.DuskLogic = api') < html.indexOf('} = window.DuskLogic;'), 'logic must load before the game');
});
