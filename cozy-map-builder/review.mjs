import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const O = 'out';
const u = p => 'file://' + path.join(dir, p);

// a small isometric arrangement so the assets are judged together, not alone
const place = [];
const T = { w: 128, h: 64 };
function P(x, y) { return { sx: (x - y) * (T.w / 2), sy: (x + y) * (T.h / 2) }; }

for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) {
  const p = P(x, y);
  place.push({ z: x + y, img: `${O}/terrain/terrain_grass_v0${(x * 3 + y * 5) % 4}_base@2x.png`,
    w: 128, h: 64, l: p.sx - 64, t: p.sy });
}
function obj(x, y, file, w, h, ax, ay, zbias = 0) {
  const p = P(x, y);
  place.push({ z: x + y + zbias, img: `${O}/${file}`, w, h, l: p.sx - ax, t: p.sy - ay });
}
// shadows sit just under their object
obj(1.0, 1.0, 'house/house_cottage-starter_shadow@2x.png', 256, 320, 128, 184, -0.05);
obj(1.0, 1.0, 'house/house_cottage-starter_base@2x.png', 256, 320, 128, 184);
obj(4.6, 0.7, 'plant/plant_tree-oak_mature_shadow@2x.png', 192, 256, 96, 186, -0.05);
obj(4.6, 0.7, 'plant/plant_tree-oak_mature_base@2x.png', 192, 256, 96, 186);
obj(5.4, 3.2, 'plant/plant_tree-oak_young_shadow@2x.png', 192, 256, 96, 186, -0.05);
obj(5.4, 3.2, 'plant/plant_tree-oak_young_base@2x.png', 192, 256, 96, 186);
obj(2.0, 4.4, 'plant/plant_tree-oak_sapling_base@2x.png', 192, 256, 96, 186);
obj(0.5, 3.6, 'decor/decor_bench-wooden_shadow@2x.png', 128, 96, 64, 34, -0.05);
obj(0.5, 3.6, 'decor/decor_bench-wooden_base@2x.png', 128, 96, 64, 34);

place.sort((a, b) => a.z - b.z);
const layers = place.map(p =>
  `<img src="${u(p.img)}" style="position:absolute;left:${p.l + 700}px;top:${p.t + 120}px;width:${p.w}px;height:${p.h}px">`).join('');

const sheet = files => files.map(([f, w, h, label]) =>
  `<div class="cell"><div class="chip" style="width:${w}px;height:${h}px"><img src="${u(O + '/' + f)}" style="width:${w}px;height:${h}px"></div><span>${label}</span></div>`).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
 body{margin:0;background:#F6F1E7;font:13px/1.4 system-ui,sans-serif;color:#3F3A34}
 h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;margin:26px 24px 12px}
 .scene{position:relative;height:760px;overflow:hidden;background:linear-gradient(180deg,#FBF8F1,#EDE4D0)}
 .row{display:flex;flex-wrap:wrap;gap:20px;padding:0 24px;align-items:flex-end}
 .cell{text-align:center;font-size:11px;opacity:.75}
 .chip{background:repeating-conic-gradient(#EDE4D0 0 25%,#FBF8F1 0 50%) 0 0/16px 16px;
   border:1px solid rgba(63,58,52,.15);border-radius:6px;overflow:hidden;margin-bottom:5px}
 .dark{background:#3F3A34;color:#F6F1E7}
</style>
<h2>Composed scene &mdash; the only honest test</h2>
<div class="scene">${layers}</div>
<h2>Cottage &mdash; base / customisation mask / shadow</h2>
<div class="row">${sheet([
  ['house/house_cottage-starter_base@2x.png', 256, 320, 'base'],
  ['house/house_cottage-starter_mask@2x.png', 256, 320, 'mask (R wall · G roof · B trim)'],
  ['house/house_cottage-starter_shadow@2x.png', 256, 320, 'shadow'],
])}</div>
<h2>Oak &mdash; three growth stages, and the season mask</h2>
<div class="row">${sheet([
  ['plant/plant_tree-oak_sapling_base@2x.png', 192, 256, 'sapling'],
  ['plant/plant_tree-oak_young_base@2x.png', 192, 256, 'young'],
  ['plant/plant_tree-oak_mature_base@2x.png', 192, 256, 'mature'],
  ['plant/plant_tree-oak_mature_seasonmask@2x.png', 192, 256, 'season mask'],
])}</div>
<h2>Grass variants &mdash; and the bench</h2>
<div class="row">${sheet([
  ['terrain/terrain_grass_v00_base@2x.png', 128, 64, 'v00'],
  ['terrain/terrain_grass_v01_base@2x.png', 128, 64, 'v01'],
  ['terrain/terrain_grass_v02_base@2x.png', 128, 64, 'v02'],
  ['terrain/terrain_grass_v03_base@2x.png', 128, 64, 'v03'],
  ['decor/decor_bench-wooden_base@2x.png', 128, 96, 'bench'],
  ['decor/decor_bench-wooden_mask@2x.png', 128, 96, 'bench mask'],
])}</div>
<h2>At @1x &mdash; the density most phones actually get</h2>
<div class="row">${sheet([
  ['house/house_cottage-starter_base@1x.png', 256, 320, 'cottage @1x'],
  ['plant/plant_tree-oak_mature_base@1x.png', 192, 256, 'oak @1x'],
  ['decor/decor_bench-wooden_base@1x.png', 128, 96, 'bench @1x'],
])}</div>
<div style="height:30px"></div>`;

fs.writeFileSync(path.join(dir, 'review.html'), html);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 1 });
await page.goto(u('review.html'));
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(dir, 'review.png'), fullPage: true });
await browser.close();
console.log('ok');
