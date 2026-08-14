/* SVG -> PNG batch rasterizer.
 *
 * There is no cairo/rsvg/ImageMagick in this environment, but Chromium is a
 * complete SVG renderer and Playwright can drive it at an exact device scale.
 * One browser, one page, many screenshots — spinning a browser per sprite
 * would make a 4,000-file build take hours.
 *
 * Reads a JSON job file: [{ svg, out, w, h, scales:[1,2,3] }, ...]
 * Writes {out}@1x.png / @2x.png / @3x.png with a transparent background.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const jobFile = process.argv[2];
if (!jobFile) { console.error('usage: rasterize.mjs <jobs.json>'); process.exit(1); }
const jobs = JSON.parse(fs.readFileSync(jobFile, 'utf8'));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--force-color-profile=srgb', '--disable-lcd-text']
});

// Group by scale so we only rebuild the page context when density changes.
const scales = [...new Set(jobs.flatMap(j => j.scales || [1, 2, 3]))].sort();
let written = 0;

for (const scale of scales) {
  const page = await browser.newPage({ deviceScaleFactor: scale });
  for (const job of jobs) {
    if (!(job.scales || [1, 2, 3]).includes(scale)) continue;
    await page.setViewportSize({ width: Math.ceil(job.w), height: Math.ceil(job.h) });
    await page.setContent(
      '<!doctype html><meta charset="utf-8">' +
      '<style>html,body{margin:0;padding:0;background:transparent;' +
      'width:' + job.w + 'px;height:' + job.h + 'px;overflow:hidden}' +
      'svg{display:block}</style>' + job.svg,
      { waitUntil: 'load' });
    const outPath = job.out + '@' + scale + 'x.png';
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, omitBackground: true });
    written++;
  }
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, files: written }));
